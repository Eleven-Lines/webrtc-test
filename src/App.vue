<template lang="pug">
#app
  drawing(
    :toolType="toolType"
    :toolColor="toolColor"
    :toolWidth="toolWidth"
    :activeLayer="activeLayer"
  )
  .controls
    .control
      input#pencil(type="radio" value="pencil" v-model="toolType")
      label(for="pencil") ペン
    .control
      input#eraser(type="radio" value="eraser" v-model="toolType")
      label(for="eraser") 消しゴム
    .control
      label(for="width") 線幅
      input#width(v-model.number="toolWidth")
    .control
      label(for="color") 色
      .color-sample(:style="{ backgroundColor: toolColor }")
      input#color(v-model="toolColor")
    .control
      label(for="layer") レイヤー
      select#layer(v-model="activeLayer")
        option(:value="0") 0
        option(:value="1") 1
    .control
      .color-sample(v-for="color in ['royalblue', 'darkorange']" :style="{ backgroundColor: color }" @click="toolColor=color")
</template>

<script lang="ts">
import { Watch, Component, Vue } from 'vue-property-decorator';
import { ToolType } from './components/Drawing.vue';
import Drawing from './components/Drawing.vue';

@Component({
  components: {
    Drawing,
  },
})
export default class App extends Vue {
  private activeLayer = 0
  private toolType: ToolType = 'pencil'
  private toolColor = '#333333'
  private toolWidth = 5

  @Watch('toolType')
  public onToolTypeChange(val: 'pencil' | 'eraser') {
    if (val === 'eraser') {
      this.toolWidth = 30
    } else {
      this.toolWidth = 5
    }
  }
}
</script>

<style lang="scss">
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.controls {
  display: flex;
  padding: 1rem;
}
.control {
  margin: 0 1rem;
  display: flex;
  align-items: center;
}
.color-sample {
  width: 1rem;
  height: 1rem;
  margin: 0 0.5rem;
  display: inline-block;
}
</style>
