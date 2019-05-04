<template lang="pug">
// Just a window for canvases
.drawing-container(
  :style="containerStyle"
  @wheel.prevent="handleWheel"
)
  drawing-tool-canvas(
    :width="containerWidth"
    :height="containerHeight"
    :position="position"
    :toolWidth="toolWidth * toolWidthScale"
    :usernamePositionMap="usernamePositionMap"
    :topleft="innerPosContainerTopLeft"
    :bottomright="innerPosContainerBottomRight"
    :scale="innerContainerScale"
  )
  .drawing-inner-container(
    ref="innerContainer"
    :style="innerContainerStyle"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
    @pointerup.prevent="handlePointerUp"
    @pointermove.prevent="handlePointerMove"
    @pointerdown.prevent="handlePointerDown"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
  )
    drawing-canvas(
      v-for="(state, i) in layerStates"
      :key="i"
      :ref="state.layerId"
      :width="canvasWidth"
      :height="canvasHeight"
      :drawings="state.drawings"
      :layerId="state.layerId"
      @render-done="handleRenderDone(i)"
    )
</template>

<script lang="ts">
import { Watch, Component, Prop, Vue } from 'vue-property-decorator'
import { ToolType, DrawingTool, PositionHistoryPayload, DrawingPayload, LayerState  } from '../lib/interface'
import DrawingCanvas from '@/components/DrawingCanvas.vue';
import DrawingToolCanvas from '@/components/DrawingToolCanvas.vue';

@Component({
  components: {
    DrawingCanvas,
    DrawingToolCanvas,
  },
})
export default class DrawingContainer extends Vue {

  get layerStates(): LayerState[] {
    return this.layerOrder.map((id) => this.layerStateMap[id])
  }

  get containerStyle() {
    return {
      width: `${this.containerWidth}px`,
      height: `${this.containerHeight}px`,
    }
  }
  get innerContainerStyle() {
    return {
      width: `${this.canvasWidth}px`,
      height: `${this.canvasHeight}px`,
      transform: `translate(${this.innerContainerX}px, ${this.innerContainerY}px) scale(${this.innerContainerScale})`,
    }
  }

  get tool(): DrawingTool {
    return {
      toolType: this.toolType,
      color: this.toolColor,
      width: this.toolWidth * this.toolWidthScale,
      withPressure: false,
    }
  }

  get innerPosContainerTopLeft() {
    return [
      -this.innerContainerX / this.innerContainerScale,
      -this.innerContainerY / this.innerContainerScale,
    ]
  }
  get innerPosContainerBottomRight() {
    return [
      -(this.innerContainerX + this.containerWidth) / this.innerContainerScale,
      -(this.innerContainerY + this.containerHeight) / this.innerContainerScale,
    ]
  }
  @Prop({ type: String, default: 'pencil' })
  private toolType!: ToolType

  @Prop({ type: String, default: '#333333' })
  private toolColor!: string

  @Prop({ type: Number, default: 3})
  private toolWidth!: number

  @Prop({ type: String, default: 'default' })
  private defaultPainterId!: string

  @Prop({ type: String, default: 'layer 0'})
  private activeLayer!: string

  @Prop({ type: Number, default: 1})
  private viewScale!: number

  @Prop({ type: Object, required: true })
  private layerStateMap!: Record<string, LayerState>

  @Prop({ type: Array, required: true })
  private layerOrder!: string[]

  @Prop({ type: Object, required: true })
  private usernamePositionMap!: Record<string, [number, number]>

  private isDrawing = false
  private currentDrawingFrames = 0

  private position: [number, number] | null = null


  private minPressure = 0.3
  private maxPressure = 1.0
  private initialToolWidthScale = 0.75
  private toolWidthScale = 0.75

  private containerWidth = 640 * 1.5
  private containerHeight = 360 * 1.5
  private canvasWidth = 1280 * 4
  private canvasHeight = 720 * 4

  private innerContainerRect?: DOMRect = undefined
  private innerContainerX = 0
  private innerContainerY = 0
  private innerContainerScale = 1

  private isDragging = false
  private previousTouchX = 0
  private previousTouchY = 0
  private previousTouchDist = 0

  private positionHistory: PositionHistoryPayload[] = [] // previous position for default painter.

  public pressureResponse(rawPressure: number) {
    if (rawPressure < 0) { return this.minPressure }
    if (rawPressure > 1) { return this.maxPressure }
    return (this.maxPressure - this.minPressure) * rawPressure + this.minPressure
  }

  public setPressure(pressure: number) {
    this.toolWidthScale = this.pressureResponse(pressure)
  }
  public resetPressure() {
    this.toolWidthScale = this.pressureResponse(this.initialToolWidthScale)
  }

  public getDrawingCanvasesData(): Record<string, string> {
    const canvasDataMap: Record<string, string> = {}
    this.layerStates.forEach((s) => {
      const canvasElement = document.querySelector(`canvas[data-layer-id="${s.layerId}"]`) as HTMLCanvasElement
      this.$set(canvasDataMap, s.layerId, canvasElement.toDataURL())
    })
    return canvasDataMap
  }

  public setDrawingCanvasesData(data: Record<string, string>) {
    this.layerStates.forEach((s) => {
      const canvasData = data[s.layerId]
      const canvasElement = document.querySelector(`canvas[data-layer-id="${s.layerId}"]`) as HTMLCanvasElement
      if (!canvasData || !canvasElement) {
        return
      }
      const ctx = canvasElement.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const image = new Image()
      image.onload = () => ctx.drawImage(image, 0, 0)
      image.src = canvasData
    })
  }

  public zoomtoLayerPos(position: [number, number], scale: number) {
    if (scale < 0.1 || scale > 10) {
      return
    }
    const oldX = this.innerContainerX
    const oldY = this.innerContainerY
    const oldScale = this.innerContainerScale
    this.innerContainerScale = scale
    this.innerContainerX = (1 - scale / oldScale) * (position[0] - oldX) + oldX
    this.innerContainerY = (1 - scale / oldScale) * (position[1] - oldY) + oldY
  }

  public draw(position: [number, number], state: 'start' | 'drawing' | 'end') {
    const _state = state === 'drawing' && this.currentDrawingFrames < 3 ? 'suppressed' : state
    const positionHistory = state === 'start' ? [] : [...this.positionHistory]
    const payload: DrawingPayload = {
      tool: this.tool,
      state: _state,
      layerId: this.activeLayer,
      position,
      positionHistory,
      painter: this.defaultPainterId,
    }
    this.position = position
    this.$emit('draw', payload)
    this.currentDrawingFrames += 1

    if (state === 'start') {
      this.isDrawing = true
      this.positionHistory = [{
        position,
        width: this.toolWidth,
      }]
    }
    if (state === 'drawing') {
      if (this.positionHistory.length >= 2) {
        this.positionHistory.splice(0, 1)
      }
      this.positionHistory.push({
        position,
        width: this.toolWidth * this.toolWidthScale,
      })
    }
    if (state === 'end') {
      this.isDrawing = false
      this.currentDrawingFrames = 0
    }
  }

  public clientPosToOffsetPos([clientX, clientY]: [number, number]): [number, number] {
    if (!this.innerContainerRect) { return [0, 0] }
    const top = this.innerContainerRect.top
    const left = this.innerContainerRect.left
    return [(clientX - left) / this.innerContainerScale, (clientY - top) / this.innerContainerScale]
  }

  public handleTouchStart(event: TouchEvent) {
    this.updateInnerContainerRect()
    if (event.touches.length == 2) {
      this.isDrawing = false
      this.isDragging = true
      const [x, y] = [...event.touches]
        .reduce((acc, cur) => [acc[0] + cur.clientX, acc[1] + cur.clientY], [0, 0])
        .map((v) => v / event.touches.length)
      this.previousTouchX = x
      this.previousTouchY = y
    }
    if (event.touches.length == 1) {
      const touch = event.touches[0]
      this.setPressure(touch.force)
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'start')
    }
  }
  public handleTouchEnd(event: TouchEvent) {
    if (event.changedTouches.length == 2) {
      this.isDragging = false
      this.isDrawing = false
    }
    if (event.changedTouches.length == 1 && !this.isDragging) {
      const touch = event.changedTouches[0]
      this.setPressure(touch.force)
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'end')
      this.resetPressure()
    }
  }
  public handleTouchMove(event: TouchEvent) {
    if (event.touches.length == 2 && this.isDragging) {
      const [x, y] = [...event.touches]
        .reduce((acc, cur) => [acc[0] + cur.pageX, acc[1] + cur.pageY], [0, 0])
        .map((v) => v / event.touches.length)
      this.innerContainerX += x - this.previousTouchX
      this.innerContainerY += y - this.previousTouchY
      this.previousTouchX = x
      this.previousTouchY = y
    }
    if (event.touches.length == 1) {
      this.$emit('cursor-move', this.position)
      const touch = event.touches[0]
      this.setPressure(touch.force)
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'drawing')
    }
  }
  public handlePointerDown(event: PointerEvent) {
    this.setPressure(event.pressure)
    this.draw([event.offsetX, event.offsetY], 'start')
  }
  public handlePointerUp(event: PointerEvent) {
    this.setPressure(event.pressure)
    this.draw([event.offsetX, event.offsetY], 'end')
    this.resetPressure()
  }
  public handlePointerMove(event: PointerEvent) {
    this.position = [event.offsetX, event.offsetY]
    this.$emit('cursor-move', this.position)
    if (!this.isDrawing) {
      return
    }
    this.toolWidthScale = this.pressureResponse(event.pressure)
    this.draw([event.offsetX, event.offsetY], 'drawing')
  }

  public handleMouseDown(event: MouseEvent) {
    this.draw([event.offsetX, event.offsetY], 'start')
  }
  public handleMouseUp(event: MouseEvent) {
    this.draw([event.offsetX, event.offsetY], 'end')
  }
  public handleMouseMove(event: MouseEvent) {
    this.position = [event.offsetX, event.offsetY]
    this.$emit('cursor-move', this.position)
    if (!this.isDrawing) {
      return
    }
    this.draw([event.offsetX, event.offsetY], 'drawing')
  }

  public handleWheel(event: WheelEvent) {
    if (this.isDrawing) {
      return
    }
    if (event.ctrlKey) {
      this.zoomtoLayerPos([event.clientX, event.clientY], this.innerContainerScale - event.deltaY / 100)
      this.$emit('zoom', this.innerContainerScale - event.deltaY / 100)
    } else {
      this.innerContainerX -= event.deltaX
      this.innerContainerY -= event.deltaY
    }
  }

  public handleRenderDone(layerIndex: number) {
    const activeLayerState = this.layerStateMap[this.activeLayer]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings = []
  }

  @Watch('viewScale')
  public handleScaleChange(s: number) {
    this.zoomtoLayerPos([this.containerWidth / 2, this.containerHeight / 2], s)
    this.updateInnerContainerRect()
  }

  public mounted() {
    this.updateInnerContainerRect()
  }

  @Watch('innerContainerX')
  @Watch('innerContainerY')
  private updateInnerContainerRect() {
    this.innerContainerRect = (this.$refs.innerContainer as Element).getBoundingClientRect() as DOMRect
  }
}
</script>

<style scoped lang="scss">
.drawing-container {
  position: relative;
  border: 1px solid lightgray;
  overflow: hidden;
  background: lightgray;
}
.drawing-inner-container {
  transform-origin: top left;
  position: relative;
  background: white;
  cursor: none;
}
</style>
