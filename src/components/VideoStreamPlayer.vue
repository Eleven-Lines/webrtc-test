<template lang="pug">
video.video-stream-player(autoplay playsinline :class="{ small }")
</template>

<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-property-decorator'
import Peer from 'skyway-js'
import { MediaConnection } from 'skyway-js'

@Component
export default class VideoStreamPlayer extends Vue {
  @Prop({ type: MediaStream, required: true })
  private stream!: MediaStream

  @Prop({ type: Boolean, default: false })
  private small!: boolean

  public updateSrcObject() {
    (this.$el as HTMLVideoElement).srcObject = this.stream
  }

  @Watch('stream')
  public onStreamChange(val: MediaStream, old: MediaStream) {
    this.updateSrcObject()
  }

  public mounted() {
    this.updateSrcObject()
  }
}
</script>

<style scoped lang="scss">
.video-stream-player {
  background-color: lightgray;
  width: 80%;
  &.small {
    width: 30%;
  }
}
</style>
