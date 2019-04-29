<template lang="pug">
.drawing(
  :style="containerStyle"
  @touchstart.prevent="handleMousedown"
  @touchmove.prevent="handleMousemove"
  @touchend.prevent="handleMouseup"
  @mousedown="handleMousedown"
  @mouseup="handleMouseup"
  @mousemove="handleMousemove"
)
  drawing-canvas(
    v-for="(state, i) in layerStates"
    :key="i"
    :ref="state.layerId"
    :width="width"
    :height="height"
    :drawings="state.drawings"
    :layerId="state.layerId"
    @render-done="handleRenderDone(i)"
  )
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import DrawingCanvas from '@/components/DrawingCanvas.vue';

export type ToolType = 'pencil' | 'eraser'

interface DrawingTool {
  toolType: ToolType
  color: string
  width: number
}

export interface DrawingPayload {
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

  private layerStateMap: Record<string, LayerState> = {
    'layer 0': { drawings: [], layerId: 'layer 0' },
    'layer 1': { drawings: [], layerId: 'layer 1' },
  }
  private layerOrder = ['layer 0', 'layer 1']
  private isDrawing = false
  private width = 640 * 1.5
  private height = 360 * 1.5

  // previous position for default painter.
  private positionHistory: Array<[number, number]> = []

  get layerStates(): LayerState[] {
    return this.layerOrder.map((id) => this.layerStateMap[id])
  }

  get containerStyle() {
    return {
      width: `${this.width}px`,
      height: `${this.height}px`,
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
      ctx.clearRect(0, 0, this.width, this.height)
      const image = new Image()
      image.onload = () => ctx.drawImage(image, 0, 0)
      image.src = canvasData
    })
  }

  public handleMousedown(event: MouseEvent) {
    this.isDrawing = true
    this.positionHistory = [[event.layerX, event.layerY]]
  }

  public handleMouseup() {
    this.isDrawing = false
    const activeLayerState = this.layerStateMap[this.activeLayer]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings = []
  }

  public handleMousemove(event: MouseEvent) {
    if (!this.isDrawing) {
      return
    }

    const payload: DrawingPayload = {
      tool: this.tool,
      layerId: this.activeLayer,
      position: [event.layerX, event.layerY],
      positionHistory: [...this.positionHistory],
      painter: this.defaultPainterId,
    }

    this.pushDrawingToLayer(payload)

    this.$emit('draw', payload)

    if (this.positionHistory.length >= 2) {
      this.positionHistory.splice(0, 1)
    }
    this.positionHistory.push([event.layerX, event.layerY])

  }
  public handleRenderDone(layerIndex: number) {
    const activeLayerState = this.layerStateMap[this.activeLayer]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings = []
  }
}
</script>

<style scoped lang="scss">
.drawing {
  position: relative;
}
</style>
