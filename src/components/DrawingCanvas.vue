<template lang="pug">
canvas.drawing-canvas(:width="width" :height="height" :data-layer-id="layerId")
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { DrawingPayload } from './DrawingContainer.vue'

const cosFromPoints = (x3: number, y3: number, x2: number, y2: number, x1: number, y1: number) => {
  const dx1 = x1 - x2
  const dx2 = x2 - x3
  const dy1 = y1 - y2
  const dy2 = y2 - y3
  return (dx2 * dx1 + dy2 * dy1) / (Math.sqrt(dx2 ** 2 + dy2 ** 2) * Math.sqrt(dx1 ** 2 + dy1 ** 2))
}

@Component
export default class DrawingCanvas extends Vue {
  @Prop({ type: Number, required: true })
  private width!: number

  @Prop({ type: Number, required: true })
  private height!: number

  @Prop({ type: Array, required: true })
  private drawings!: DrawingPayload[]

  @Prop({ type: String, required: true })
  private layerId!: string

  private ctx!: CanvasRenderingContext2D

  public mounted() {
    this.renderCanvas()
    const ctx = (this.$el as HTMLCanvasElement).getContext('2d')
    if (!ctx) {
      throw new Error(('getContext failed'))
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    this.ctx = ctx
  }

  public renderCanvas() {
    requestAnimationFrame(this.renderCanvas)
    if (this.drawings.length === 0) {
      return
    }
    this.drawings.forEach((d) => {
      if (d.state !== 'drawing' && d.state !== 'end') {
        return
      }
      if (d.positionHistory.length < 2) {
        return
      }
      if (this.ctx.fillStyle !== d.tool.color) {
        this.ctx.fillStyle = d.tool.color
      }
      if (this.ctx.strokeStyle !== d.tool.color) {
        this.ctx.strokeStyle = d.tool.color
      }
      if (d.tool.toolType === 'pencil' && this.ctx.globalCompositeOperation !== 'source-over') {
        this.ctx.globalCompositeOperation = 'source-over'
      }
      if (d.tool.toolType === 'eraser' && this.ctx.globalCompositeOperation !== 'destination-out') {
        this.ctx.globalCompositeOperation = 'destination-out'
      }
      this.ctx.beginPath()
      // const p = d.position
      // const p1 = d.positionHistory[1]
      // const p2 = d.positionHistory[0]
      // this.ctx.moveTo((p1.position[0] + p2.position[0]) / 2, (p1.position[1] + p2.position[1]) / 2)
      // this.ctx.quadraticCurveTo(p1.position[0], p1.position[1], (p1.position[0] + p[0]) / 2, (p1.position[1] + p[1]) / 2)

      // event points
      const [p1x, p1y] = d.position
      const [p2x, p2y] = d.positionHistory[1].position
      const [p3x, p3y] = d.positionHistory[0].position

      // event points width
      const w1 = d.tool.width
      const w2 = d.positionHistory[1].width
      const w3 = d.positionHistory[0].width

      // control point base
      const [ax, ay] = [(p3x + p2x) / 2, (p3y + p2y) / 2]
      const [bx, by] = [(p2x + p1x) / 2, (p2y + p1y) / 2]

      //control point width
      const wa = (w3 + w2) / 2
      const wb = (w2 + w1) / 2

      // slope
      const s1 = (p1y - p2y) / (p1x - p2x)
      const s2 = (p2y - p3y) / (p2x - p3x)

      if (!isFinite(s1) && !isFinite(s2)) {
        this.ctx.moveTo(ax + wa, ay)
        this.ctx.lineTo(bx + wb, by)
        this.ctx.lineTo(bx - wb, by)
        this.ctx.lineTo(ax - wa, ay)
        this.ctx.lineTo(ax + wa, ay)
      }
      else if (Math.abs(cosFromPoints(p3x, p3y, p2x, p2y, p1x, p1y)) > 0.9995) {
        // normal length
        const lna = Math.sqrt(s2 **2 + 1)
        const lnb = Math.sqrt(s1 **2 + 1)

        const [apx, apy] = [ax + wa * s2 / lna, ay - 1 / lna]
        const [amx, amy] = [ax - wa * s2 / lna, ay + 1 / lna]
        const [bpx, bpy] = [bx + wb * s1 / lnb, by - 1 / lnb]
        const [bmx, bmy] = [bx - wb * s1 / lnb, by + 1 / lnb]

        this.ctx.moveTo(apx, apy)
        this.ctx.lineTo(bpx, bpy)
        this.ctx.lineTo(bmx, bmy)
        this.ctx.lineTo(amx, amy)
        this.ctx.lineTo(apx, apy)
      }
      else if (!isFinite(s1)) {
        // calculate coordinate for a, like above
        const lna = Math.sqrt(s2 **2 + 1)
        const [apx, apy] = [ax + wa * s2 / lna, ay - 1 / lna]
        const [amx, amy] = [ax - wa * s2 / lna, ay + 1 / lna]

        const [bpx, bpy] = [(p3x - p2x) * (p3y - p2y) <= 0 ? bx - wb : bx + wb, by]
        const [bmx, bmy] = [(p3x - p2x) * (p3y - p2y) <= 0 ? bx + wb : bx - wb, by]

        // control points
        const tp = bpx - apx
        const tm = bpx - apx
        const [cpx, cpy] = [apx + tp * 1, apy + tp * s2]
        const [cmx, cmy] = [amx + tm * 1, amy + tm * s2]

        this.ctx.moveTo(apx, apy)
        this.ctx.quadraticCurveTo(cpx, cpy, bpx, bpy)
        this.ctx.lineTo(bmx, bmy)
        this.ctx.quadraticCurveTo(cmx, cmy, amx, amy)
        this.ctx.lineTo(apx, apy)
      }
      else if (!isFinite(s2)) {
        // calculate coordinate for b, like above
        const lnb = Math.sqrt(s1 **2 + 1)
        const [bpx, bpy] = [bx + wb * s1 / lnb, by - 1 / lnb]
        const [bmx, bmy] = [bx - wb * s1 / lnb, by + 1 / lnb]

        const [apx, apy] = [(p2x - p1x) * (p2y - p1y) <= 0 ? ax - wa : ax + wa, ay]
        const [amx, amy] = [(p2x - p1x) * (p2y - p1y) <= 0 ? ax + wa : ax - wa, ay]

        // control points
        const up = apx - bpx
        const um = amx - bmx
        const [cpx, cpy] = [bpx + up * 1, bpy + up * s1]
        const [cmx, cmy] = [bmx + um * 1, bmy + um * s1]

        this.ctx.moveTo(apx, apy)
        this.ctx.quadraticCurveTo(cpx, cpy, bpx, bpy)
        this.ctx.lineTo(bmx, bmy)
        this.ctx.quadraticCurveTo(cmx, cmy, amx, amy)
        this.ctx.lineTo(apx, apy)
      }
      else {
        // normal length
        const lna = Math.sqrt(s2 **2 + 1)
        const lnb = Math.sqrt(s1 **2 + 1)

        // anchor points
        const [apx, apy] = [ax + wa * s2 / lna, ay - 1 / lna]
        const [amx, amy] = [ax - wa * s2 / lna, ay + 1 / lna]
        let [bpx, bpy] = [bx + wb * s1 / lnb, by - 1 / lnb]
        let [bmx, bmy] = [bx - wb * s1 / lnb, by + 1 / lnb]

        // swap bp and bm if position against line is inconsistent
        const tmpApSide = (p3x - p2x) * (apy - p2y) - (p3y - p2y) * (apx - p2x)
        const tmpBpSide = (p2x - p1x) * (bpy - p1y) - (p2y - p1y) * (bpx - p1x)
        if (tmpApSide * tmpBpSide < 0) {
          [bpx, bmx, bpy, bmy] = [bmx, bpx, bmy, bpy]
        }

        // control points
        const up = (s2 * apx - apy - s2 * bpx + bpy) / (s2 - s1)
        const um = (s2 * amx - amy - s2 * bmx + bmy) / (s2 - s1)
        const [cpx, cpy] = [bpx + up * 1, bpy + up * s1]
        const [cmx, cmy] = [bmx + um * 1, bmy + um * s1]

        if (ay - cpy > 50 && cpy < Math.min(apy, bpy)) {
          console.log("======")
          console.log("s1", s1)
          console.log("s2", s2)
          console.log("a", ax, ay)
          console.log("ap", apx, apy)
          console.log("am", amx, amy)
          console.log("b", bx, by)
          console.log("bp", bpx, bpy)
          console.log("bm", bmx, bmy)
          console.log("cp", cpx, cpy)
          console.log("cm", cmx, cmy)
          const fillPoint = (x: number, y: number, color: string) => {
            this.ctx.beginPath()
            this.ctx.fillStyle = color
            this.ctx.moveTo(x, y)
            this.ctx.arc(x, y, 3, 0, Math.PI * 2)
            this.ctx.fill()
          }
          fillPoint(p1x, p1y, "blue")
          fillPoint(p2x, p2y, "deepskyblue")
          fillPoint(p3x, p3y, "aqua")
          fillPoint(ax, ay, "lime")
          fillPoint(apx, apy, "darkcyan")
          fillPoint(amx, amy, "green")
          fillPoint(bx, by, "magenta")
          fillPoint(bpx, bpy, "red")
          fillPoint(bmx, bmy, "crimson")
          fillPoint(cpx, cpy, "black")
          fillPoint(cmx, cmy, "gray")

          this.ctx.fillStyle = "#333"
          this.ctx.strokeStyle = "#333"
          this.ctx.beginPath()
        }

        this.ctx.moveTo(apx, apy)
        this.ctx.quadraticCurveTo(cpx, cpy, bpx, bpy)
        this.ctx.lineTo(bmx, bmy)
        this.ctx.quadraticCurveTo(cmx, cmy, amx, amy)
        this.ctx.lineTo(apx, apy)
      }
      this.ctx.closePath()
      this.ctx.fill()
      this.ctx.stroke()
    })
    this.$emit('render-done')
  }

  public toDataURL() {
    return (this.$el as HTMLCanvasElement).toDataURL()
  }
}
</script>

<style scoped lang="scss">
.drawing-canvas {
  position: absolute;
  left: 0;
  top: 0;
  border: 1px solid #eeeeee;
}
</style>
