<template lang="pug">
.hello
  .video-container
    video-stream-player(v-if="remoteStream" :stream="remoteStream")
    video-stream-player(v-if="localStream" :stream="localStream" small)
  .controls
    input(v-model="toCallId")
    button.call-button(v-if="isTalking" @click="endCall") Stop
    button.call-button(v-else @click="makeCall") Call
  .infomation
    p ID : {{ id }}
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import Peer from 'skyway-js'
import { MediaConnection } from 'skyway-js'
import VideoStreamPlayer from '@/components/VideoStreamPlayer.vue'

@Component({
  components: {
    VideoStreamPlayer,
  },
})
export default class HelloWorld extends Vue {
  private id = ''
  private toCallId = ''
  private isTalking = false

  private peer?: Peer
  private call?: MediaConnection

  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null

  public makeCall() {
    if (!this.peer || !this.localStream) {
      return
    }
    const call = this.peer.call(this.toCallId, this.localStream)
    if (!call) {
      return
    }
    this.setupCallEventHandlers(call)
  }

  public endCall() {
    if (!this.call) {
      return
    }
    this.call.close()
  }

  public async mounted() {
    try {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true})
      } catch {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
    } catch (error) {
//       console.log('getUserMedia Error:', error)
      return
    }

    this.peer = new Peer({
      key: process.env.VUE_APP_SKYWAY_API_KEY,
      debug: 3,
    })

    if (this.peer) {
      this.peer.on('open', () => this.id = this.peer ? this.peer.id : '')
      this.peer.on('error', (err: any) => alert(err.message))
      this.peer.on('close', () => { return })
      this.peer.on('disconnected', () => { return })
      this.peer.on('call', this.handlePeerCall)
    }
  }

  private setupCallEventHandlers(call: MediaConnection) {
    if (this.call) {
      this.call.close()
    }
    this.call = call
    this.call.on('stream', this.handleCallStream)
    call.on('close', this.handleCallClose)
  }

  private handleCallStream(stream: MediaStream) {
    // ストリーム受け取りハンドラ
    this.remoteStream = stream
    this.isTalking = true
  }

  private handleCallClose() {
    // 通話切断ハンドラ
    this.remoteStream = null
    this.isTalking = false
  }

  private handlePeerCall(call: MediaConnection) {
    // 着信ハンドラ
    if (!this.localStream) {
      return
    }
    call.answer(this.localStream)
    this.setupCallEventHandlers(call)
  }
}
</script>

<style scoped lang="scss">
.video-container {
  width: 100%;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  video {
    margin-top: 1rem;
    background-color: lightgray;
    max-width: 100%;
  }
}
.video-main {
  width: 80%;
}
.video-sub {
  width: 30%;
}
</style>
