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
    :width="width"
    :height="height"
    :active="state.active"
    :drawings="state.drawings"
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
  position: [number, number],
  positionHistory: [number, number][]
  painter: string
}

interface LayerState {
  active: boolean
  drawings: DrawingPayload[],
}

@Component({
  components: {
    DrawingCanvas,
  },
})
export default class Drawing extends Vue {
  @Prop({ type: String, default: 'pencil' })
  private toolType!: ToolType

  @Prop({ type: String, default: '#333333' })
  private toolColor!: string

  @Prop({ type: Number, default: 3})
  private toolWidth!: number

  @Prop({ type: String, default: 'default' })
  private defaultPainterId!: string

  @Prop({ type: Number, default: 0})
  private activeLayer!: number

  private layerStates: LayerState[] = [{
    active: false,
    drawings: [],
  },{
    active: false,
    drawings: [],
  }
  ]
  private isDrawing = false
  private width = 960
  private height = 540

  // previous position for default painter.
  private positionHistory: [number, number][] = []

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
      width: this.toolWidth
    }
  }

  public handleMousedown(event: MouseEvent) {
    this.isDrawing = true
    this.positionHistory = [[event.layerX, event.layerY]]
  }

  public handleMouseup() {
    this.isDrawing = false
    this.layerStates[this.activeLayer].active = false
    this.layerStates[this.activeLayer].drawings = []
  }

  public handleMousemove(event: MouseEvent) {
    if (!this.isDrawing) {
      return
    }
    this.layerStates[this.activeLayer].active = true
    this.layerStates[this.activeLayer].drawings.push({
      tool: this.tool,
      position: [event.layerX, event.layerY],
      positionHistory: [...this.positionHistory],
      painter: this.defaultPainterId,
    })
    if (this.positionHistory.length >= 2) {
      this.positionHistory.splice(0, 1)
    }
    this.positionHistory.push([event.layerX, event.layerY])

  }
  public handleRenderDone(layerIndex: number) {
    this.layerStates[this.activeLayer].drawings = []
  }
}
</script>

<style scoped lang="scss">
.drawing {
  position: relative;
}
</style>
