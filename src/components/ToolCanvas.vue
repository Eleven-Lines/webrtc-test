<template lang="pug">
canvas.tool-canvas(:width="width" :height="height")
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { DrawingPayload } from './Drawing.vue'

@Component
export default class DrawingCanvas extends Vue {
  @Prop({ type: Number, required: true })
  private width!: number

  @Prop({ type: Number, required: true })
  private height!: number

  @Prop({ type: Array, required: true })
  private drawings!: DrawingPayload[]

  @Prop({ type: Boolean, required: true })
  private active!: boolean

  private ctx!: CanvasRenderingContext2D

  public mounted() {
    this.renderCanvas()
    const ctx = (this.$el as HTMLCanvasElement).getContext('2d')
    if (!ctx) {
      throw('getContext failed')
    }
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    this.ctx = ctx
  }

  public renderCanvas() {
    requestAnimationFrame(this.renderCanvas)
    if (!this.active) {
      return
    }
    this.drawings.forEach(d => {
      if (d.tool.toolType === 'pencil' && this.ctx.globalCompositeOperation !== 'source-over') {
        this.ctx.globalCompositeOperation = 'source-over'
      }
      if (d.tool.toolType === 'eraser' && this.ctx.globalCompositeOperation !== 'destination-out') {
        this.ctx.globalCompositeOperation = 'destination-out'
      }
      this.ctx.beginPath()
      this.ctx.moveTo(...d.positionHistory)
      this.ctx.lineTo(...d.position)
      this.ctx.stroke()
    })
    this.$emit('render-done')
  }
}
</script>

<style scoped lang="scss">
.tool-canvas {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
