<template lang="pug">
// Just a window for canvases
.drawing-container(
  :style="containerStyle"
  @wheel.prevent="handleWheel"
)
  .drawing-inner-container(
    ref="innerContainer"
    :style="innerContainerStyle"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mousemove="handleMouseMove"
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
import DrawingCanvas from '@/components/DrawingCanvas.vue';

export type ToolType = 'pencil' | 'eraser'

interface DrawingTool {
  toolType: ToolType
  color: string
  width: number
}

export interface DrawingPayload {
  state: 'start' | 'suppressed' | 'drawing' | 'end' 
  tool: DrawingTool
  layerId: string
  position: [number, number]
  positionHistory: Array<[number, number]>
  painter: string
}

interface LayerState {
  drawings: DrawingPayload[],
  layerId: string
}

@Component({
  components: {
    DrawingCanvas,
  },
})
export default class DrawingContainer extends Vue {
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
  private viewScale! : number

  private layerStateMap: Record<string, LayerState> = {
    'layer 0': { drawings: [], layerId: 'layer 0' },
    'layer 1': { drawings: [], layerId: 'layer 1' },
  }
  private layerOrder = ['layer 0', 'layer 1']
  private isDrawing = false

  private containerWidth = 640 * 1.5
  private containerHeight = 360 * 1.5
  private canvasWidth = 1280 * 2
  private canvasHeight = 720 * 2

  private innerContainerRect?: DOMRect = undefined
  private innerContainerX = 0
  private innerContainerY = 0

  private isDragging = false
  private previousTouchX = 0
  private previousTouchY = 0

  private get innerContainerScale() { return Math.min(2, Math.max(0.1, this.viewScale)) }

  private positionHistory: Array<[number, number]> = [] // previous position for default painter.

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
      transform: `scale(${this.innerContainerScale}) translate(${this.innerContainerX}px, ${this.innerContainerY}px)` 
      // top: `${this.innerContainerY}px`,
      // left: `${this.innerContainerX}px`,
    }
  }

  get tool(): DrawingTool {
    return {
      toolType: this.toolType,
      color: this.toolColor,
      width: this.toolWidth,
    }
  }

  public getDrawingCanvasesData(): Record<string, string> {
    const canvasDataMap: Record<string, string> = {}
    this.layerStates.forEach((s) => {
      const canvasElement = document.querySelector(`canvas[data-layer-id="${s.layerId}"]`) as HTMLCanvasElement
      this.$set(canvasDataMap, s.layerId, canvasElement.toDataURL())
    })
    return canvasDataMap
  }

  public pushDrawingToLayer(payload: DrawingPayload) {
    const activeLayerState = this.layerStateMap[payload.layerId]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings.push(payload)
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

  public draw(position: [number, number], state: 'start' | 'drawing' | 'end') {
    const _state = state === 'drawing' && this.positionHistory.length < 2 ? 'suppressed' : state
    const positionHistory = state === 'start' ? [] : [...this.positionHistory]
    const payload: DrawingPayload = {
      tool: this.tool,
      state: _state,
      layerId: this.activeLayer,
      position,
      positionHistory,
      painter: this.defaultPainterId,
    }
    this.pushDrawingToLayer(payload)
    this.$emit('draw', payload)

    if (state === 'start') {
      this.isDrawing = true
      this.positionHistory = [position]
    }
    if (state === 'drawing') {
      if (this.positionHistory.length >= 2) {
        this.positionHistory.splice(0, 1)
      }
      this.positionHistory.push(position)
    }
    if (state === 'end') {
      this.isDrawing = false
    }
  }

  public clientPosToOffsetPos([clientX, clientY]: [number, number]): [number, number] {
    if (!this.innerContainerRect) return [0, 0]
    const top = this.innerContainerRect.top
    const left = this.innerContainerRect.left
    return [(clientX - left) / this.innerContainerScale, (clientY - top) / this.innerContainerScale]
  }

  public handleTouchStart(event: TouchEvent) {
    if (event.touches.length == 2) {
      this.isDragging = true
      const [x, y] = [...event.touches]
        .reduce((acc, cur) => [acc[0] + cur.clientX, acc[1] + cur.clientY], [0, 0])
        .map(v => v / event.touches.length)
      this.previousTouchX = x
      this.previousTouchY = y
    }
    if (event.touches.length == 1) {
      const touch = event.touches[0]
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'start')
    }
  }
  public handleTouchEnd(event: TouchEvent) {
    if (event.touches.length == 2) {
      this.isDragging = false
    }
    if (event.touches.length == 1) {
      const touch = event.touches[0]
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'end')
    }
  }
  public handleTouchMove(event: TouchEvent) {
    if (event.touches.length == 2 && this.isDragging) {
      const [x, y] = [...event.touches]
        .reduce((acc, cur) => [acc[0] + cur.clientX, acc[1] + cur.clientY], [0, 0])
        .map(v => v / event.touches.length)
      this.innerContainerX += x - this.previousTouchX
      this.innerContainerY += y - this.previousTouchY
      this.previousTouchX = x
      this.previousTouchY = y
    }
    if (event.touches.length == 1) {
      const touch = event.touches[0]
      this.draw(this.clientPosToOffsetPos([touch.clientX, touch.clientY]), 'drawing')
    }
  }
  public handleMouseDown(event: MouseEvent) {
    this.draw([event.offsetX, event.offsetY], 'start')
  }
  public handleMouseUp(event: MouseEvent) {
    this.draw([event.offsetX, event.offsetY], 'end')
  }
  public handleMouseMove(event: MouseEvent) {
    if (!this.isDrawing) {
      return
    }
    this.draw([event.offsetX, event.offsetY], 'drawing')
  }
  public handleWheel(event: WheelEvent) {
    this.innerContainerX -= event.deltaX
    this.innerContainerY -= event.deltaY
  }

  public handleRenderDone(layerIndex: number) {
    const activeLayerState = this.layerStateMap[this.activeLayer]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings = []
  }

  @Watch('innerContainerX')
  @Watch('innerContainerY')
  @Watch('viewScale')
  private updateInnerContainerRect() {
    this.innerContainerRect = (this.$refs.innerContainer as Element).getBoundingClientRect() as DOMRect
  }

  public mounted() {
    this.updateInnerContainerRect()
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
}
</style>
