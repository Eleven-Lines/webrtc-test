<template lang="pug">
.drawing-tool-canvas(:style="toolCanvasStyle")
  .my-tool(:style="myToolStyle")
  .user-cursor(v-for="(data) in userCursorData" :style="data.style")
    .user-cursor-indicator(:style="userCursorIndicatorStyle")
    .user-name(:style="userNameStyle")
      | {{ userNameMap[data.name] || data.name }}
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { DrawingPayload } from '../lib/interface'

@Component
export default class DrawingToolCanvas extends Vue {
  @Prop({ type: Number, required: true })
  private width!: number

  @Prop({ type: Number, required: true })
  private height!: number

  @Prop({ type: Array })
  private position?: [number, number]

  @Prop({ type: Number })
  private toolWidth?: number

  @Prop({ type: Object, required: true })
  private userPositionMap!: Record<string, [number, number]>

  @Prop({ type: Object, required: true })
  private userNameMap!: Record<string, [number, number]>

  @Prop({ type: Array, required: true })
  private topleft!: [number, number]

  @Prop({ type: Array, required: true })
  private bottomright!: [number, number]

  @Prop({ type: Number, required: true })
  private scale!: number

  private toolColor = '#aaa'
  private userColor = 'crimson'
  private userCircleRadius = 8

  get widthInCanvas() {
    return this.bottomright[0] - this.topleft[0]
  }
  get heightInCanvas() {
    return this.bottomright[1] - this.topleft[1]
  }

  get scaledToolWidth() {
    return this.toolWidth ? this.toolWidth * this.scale : 0
  }

  get toolCanvasStyle() {
    return {
      width: `${this.width}px`,
      height: `${this.height}px`,
    }
  }

  get myToolStyle() {
    return this.position && this.toolWidth ? {
      width: `${this.scaledToolWidth}px`,
      height: `${this.scaledToolWidth}px`,
      transform: `translate(${(this.topleft[0] - this.position[0]) / this.widthInCanvas * this.width - this.scaledToolWidth / 2}px,
                            ${(this.topleft[1] - this.position[1]) / this.heightInCanvas * this.height - this.scaledToolWidth / 2}px)`,
    } : {
      width: `${this.scaledToolWidth}px`,
      height: `${this.scaledToolWidth}px`,
    }
  }

  get userCursorData() {
    return Object.entries(this.userPositionMap).map((data) => {
      const [name, position] = data
      return {
        name,
        style: {
          transform: `translate(${(this.topleft[0] - position[0]) / this.widthInCanvas * this.width - this.userCircleRadius / 2}px,
                                ${(this.topleft[1] - position[1]) / this.heightInCanvas * this.height - this.userCircleRadius / 2}px) `,
        },
      }
    })
  }

  get userCursorIndicatorStyle() {
    return {
      width: `${this.userCircleRadius}px`,
      height: `${this.userCircleRadius}px`,
      border: `2px solid ${this.userColor}`,
    }
  }
  get userNameStyle() {
    return {
      top: `${this.userCircleRadius}px`,
      left: `${this.userCircleRadius}px`,
      background: `${this.userColor}`,
      transform: `scale(${this.scale})`,
    }
  }
}
</script>

<style scoped lang="scss">
.drawing-tool-canvas {
  position: absolute;
  left: 0;
  top: 0;
  border: 1px solid transparent;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
}
.my-tool {
  position: absolute;
  border-radius: 50%;
  border: 1px solid darkgray;
}

.user-cursor {
  position: absolute;
}
.user-cursor-indicator {
  position: absolute;
  border-radius: 50%;
}
.user-name {
  width: max-content;
  transform-origin: top left;
  position: absolute;
  padding: 0.25rem 0.5rem;
  color: white;
  font-weight: bold;
}
</style>
