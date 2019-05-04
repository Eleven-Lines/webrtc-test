<template lang="pug">
.tool-panel(:style="toolPanelStyle")
  transition(name="slide")
    .tool-panel-main(v-if="isOpened" key="main" :style="toolPanelStyle")
      .tool-panel-close(@click="isOpened = false")
        .angle-right
      .controls
        .control
          input#pencil(
            type="radio"
            :checked="value.toolType === 'pencil'"
            @input="changeProperty('toolType', 'pencil')")
          label(for="pencil") ペン
          input#eraser(
            type="radio"
            :checked="value.toolType === 'eraser'"
            @input="changeProperty('toolType', 'eraser')")
          label(for="eraser") 消しゴム
        .control
          .line-width-circle.is-small(
            :style="lineWidthCircleStyle"
            @click="changePropertyAsNumber('toolWidth', 1)")
          input.width-slider#width-slider(
            type="range"
            min="1"
            max="50"
            step="1"
            :value="value.toolWidth"
            @input="changePropertyAsNumber('toolWidth', $event.target.value)")
          .line-width-circle.is-large(
            :style="lineWidthCircleStyle"
            @click="changePropertyAsNumber('toolWidth', 100)")
          input.width-input#width-input(
            :value="value.toolWidth"
            @input="changePropertyAsNumber('toolWidth', $event.target.value)")
        .control
          swatches-picker(
            :value="value.toolColor"
            @input="handleColorChange")
        .control
          select#layer(
            :value="value.activeLayer"
            @input="changeProperty('activeLayer', $event.target.value)")
            option(v-for="id in inversedLayerOrder" :value="id") {{ id }}
          button(@click="addLayer") 
            | +
          button(@click="deleteLayer(activeLayer)")
            | -
        .control
          input#scale(
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            :value="value.viewScale"
            @input="changePropertyAsNumber('viewScale', $event.target.value)")
      .chat-control
        input(v-model="roomName" :disabled="joined")
        button.call-button(v-if="joined" @click="$emit('leave-room')") Leave
        button.call-button(v-else @click="$emit('join-room', roomName)") Join
      .chat-infomation
        p ID : {{ id }}
    .tool-panel-collapsed(v-else @click="isOpened = true" key="expand")
      .angle-left
</template>

<script lang="ts">
import { Watch, Component, Prop, Vue } from 'vue-property-decorator'
import { Compact, Swatches } from 'vue-color'

import { ToolProperties, LayerPayload } from '../lib/interface'

const generateRandomString = (validator?: (arg0: string) => boolean): string => {
  const str = Math.random().toString(36).slice(-8)
  return !validator || validator(str) ? str : generateRandomString(validator)
}

@Component({
  components: {
    'compact-picker': Compact,
    'swatches-picker': Swatches,
  },
})
export default class ToolPanel extends Vue {
  @Prop({ type: Array, required: true})
  private layerOrder!: string[]

  @Prop({ type: Number, required: true})
  private containerHeight!: number

  @Prop({ type: Object, required: true})
  private value!: ToolProperties

  @Prop({ type: Boolean, required: true})
  private joined!: boolean

  @Prop({ type: String, required: true})
  private id!: string

  private isOpened = true
  private roomName = ''

  private penSize = 5
  private eraserSize = 30

  public changeProperty<T extends keyof ToolProperties>(prop: T, value: ToolProperties[T]) {
    const newValue =  { ...this.value }
    newValue[prop] = value

    if (prop === 'toolType' && value === 'eraser') {
      this.penSize = this.value.toolWidth
      newValue.toolWidth = this.eraserSize
    }
    if (prop === 'toolType' && value === 'pencil') {
      this.eraserSize = this.value.toolWidth
      newValue.toolWidth = this.penSize
    }

    this.$emit('input', newValue)
  }

  public changePropertyAsNumber<T extends keyof ToolProperties>(prop: T, value: string) {
    const parsed = Number.parseFloat(value)
    if (!parsed) { return }
    this.changeProperty(prop, parsed)
  }

  public handleColorChange(payload: any) {
    this.changeProperty('toolColor', payload.hex)
  }

  get toolPanelStyle() {
    return {
      height: this.isOpened ? `${this.containerHeight}px` : '2rem',
      width: this.isOpened ? '13rem' : '2rem',
    }
  }

  get lineWidthCircleStyle() {
    return this.value.toolType === 'pencil' ? {
      background: 'white',
      border: 'none',
    } : {
      border: '1px solid white',
      background: 'none',
    }
  }

  get inversedLayerOrder() {
    const l = [...this.layerOrder].reverse()
    return l
  }

  private addLayer() {
    const layerId = generateRandomString((id) => !this.layerOrder.find((l) => l === id))
    this.$emit('layer-change', {
      operation: 'add',
      layerOrder: [layerId, ...this.layerOrder],
      layerId,
    })
  }
  private deleteLayer(layerId: string) {
    if (!this.layerOrder.find((l) => l === layerId)) {
      throw new Error(('invalid layer'))
    }
    this.$emit('layer-change', {
      operation: 'delete',
      layerOrder: this.layerOrder,
      layerId,
    })
  }
}
</script>

<style lang="scss" scoped>
$primary-color: #0d67ea;
$panel-width: 13rem;
$panel-width-collapsed: 2rem;

.tool-panel {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  overflow: hidden;
  width: $panel-width;
  transition: all .3s ease;
}

.tool-panel-main {
  position: absolute;
  width: $panel-width;
  top: 0;
  left: 0;
  background: $primary-color;
  color: white;
  font-size: 0.8rem;
  overflow: scroll;
  -webkit-overflow-scrolling: touch;
}

.control {
  margin: 0.5rem 0;
}

input {
  background: none;
  border: 1px solid white;
  color: white;
  border-radius: 2px;
  padding: 0.25rem;
}

.tool-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: $panel-width-collapsed;
  height: $panel-width-collapsed;
  margin-left: auto;
}

.tool-panel-collapsed {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: $panel-width-collapsed;
  height: $panel-width-collapsed;
  background: $primary-color;
}

.controls {
  display: flex;
  flex-direction: column;
}


.angle-left {
  width: .75rem;
  height: .75rem;
  border: {
    left: 2px solid white;
    top: 2px solid white;
  }
  transform: translateX(-2px) rotate(135deg);
}

.angle-right {
  width: .75rem;
  height: .75rem;
  border: {
    left: 2px solid white;
    top: 2px solid white;
  }
  transform: translateX(2px) rotate(-45deg);
}

.line-width-circle {
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
  margin: 0 0.125rem;
  &.is-small {
    width: 0.25rem;
    height: 0.25rem;
  }
  &.is-large {
    width: 1rem;
    height: 1rem;
  }
}

.width-input {
  width: 1.5rem;
  margin-left: 0.5rem;
}
.width-slider {
  width: 5.5rem;
}

.vc-swatches {
  height: 120px;
  -webkit-overflow-scrolling: touch;
}

.slide-enter-active {
  transition: all .3s ease;
}
.slide-leave-active {
  transition: all .3s cubic-bezier(1.0, 0.5, 0.8, 1.0);
}
.slide-enter, .slide-leave-to {
  transform: translateX(-100%);
}

</style>
