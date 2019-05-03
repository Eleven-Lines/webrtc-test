<template lang="pug">
.tool-panel(:style="toolPanelStyle")
  transition(name="slide")
    .tool-panel-main(v-if="isOpened" key="main" :style="toolPanelStyle")
      .tool-panel-close(@click="isOpened = false")
      .controls
        .control
          input#pencil(
            type="radio"
            :checked="value.toolType === 'pencil'"
            @input="changeProperty('toolType', 'pencil')")
          label(for="pencil") ペン
        .control
          input#eraser(
            type="radio"
            :checked="value.toolType === 'eraser'"
            @input="changeProperty('toolType', 'eraser')")
          label(for="eraser") 消しゴム
        .control
          label(for="width") 線幅
          input#width(
            :value="value.toolWidth"
            @input="changePropertyAsNumber('toolWidth', $event.target.value)")
        .control
          label(for="color") 色
          .color-sample(
            :style="{ backgroundColor: value.toolColor }")
          input#color(
            :value="value.toolColor"
            @input="changeProperty('toolColor', $event.target.value)")
        .control
          label(for="layer") レイヤー
          select#layer(
            :value="value.activeLayer"
            @input="changeProperty('activeLayer', $event.target.value)")
            option(v-for="id in layerOrder" :value="id") {{ id }}
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
        .control
          .color-sample(
            v-for="color in ['royalblue', 'darkorange']"
            :style="{ backgroundColor: color }"
            @click="changeProperty('toolColor', color)")
      .chat-control
        input(v-model="roomName" :disabled="joined")
        button.call-button(v-if="joined" @click="$emit('leave-room')") Leave
        button.call-button(v-else @click="$emit('join-room', roomName)") Join
      .chat-infomation
        p ID : {{ id }}
    .tool-panel-collapsed(v-else @click="isOpened = true" key="expand")
</template>

<script lang="ts">
import { Watch, Component, Prop, Vue } from 'vue-property-decorator'
import { ToolProperties, LayerPayload } from '../lib/interface'

const generateRandomString = (validator?: (arg0: string) => boolean): string => {
  const str = Math.random().toString(36).slice(-8)
  return !validator || validator(str) ? str : generateRandomString(validator)
}

@Component
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

  private isOpened = false
  private roomName = ''

  public changeProperty<T extends keyof ToolProperties>(prop: T, value: ToolProperties[T]) {
    const newValue =  { ...this.value }
    newValue[prop] = value
    this.$emit('input', newValue)
  }

  public changePropertyAsNumber<T extends keyof ToolProperties>(prop: T, value: string) {
    const parsed = Number.parseFloat(value)
    if (!parsed) return
    this.changeProperty(prop, parsed)
  }

  get toolPanelStyle() {
    return {
      height: this.isOpened ? `${this.containerHeight}px` : '2rem',
      width: this.isOpened ? '15rem' : '2rem'
    }
  }

  private addLayer() {
    const layerId = generateRandomString((id) => !this.layerOrder.find(l => l === id))
    this.$emit('layer-change',  {
      operation: 'add',
      layerOrder: [layerId, ...this.layerOrder],
      layerId,
    })
  }
  private deleteLayer(layerId: string) {
    if (!this.layerOrder.find(l => l === layerId)) {
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
$panel-width: 15rem;
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
}

.control {
  margin: 0.5rem 0;
}

.tool-panel-close {
  width: $panel-width-collapsed;
  height: $panel-width-collapsed;
  background: white;
  margin-left: auto;
}

.tool-panel-collapsed {
  position: absolute;
  width: $panel-width-collapsed;
  height: $panel-width-collapsed;
  background: $primary-color;
}

.controls {
  display: flex;
  flex-direction: column;
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
