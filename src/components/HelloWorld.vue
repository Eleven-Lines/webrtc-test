<template lang="pug">
.hello
  .video-container
    div(v-for="stream in remoteStreams" :key="stream.peerId")
      // p ID: {{ stream.peerId }}
      video-stream-player(:stream="stream" :data-peer-id="stream.peerId" muted)
    video-stream-player(v-if="localStream" :stream="localStream" small muted)
  .controls
    input(v-model="roomName" :disabled="isTalking")
    button.call-button(v-if="isTalking" @click="leaveRoom") Leave
    button.call-button(v-else @click="joinRoom") Join
  // .chat
  //   input(v-model="chatText")
  //   button.call-button(@click="sendChat") Send
  .infomation
    p ID : {{ id }}
    .log
</template>

<script lang="ts">
interface Window {
  loadDisplayMedia: () => void
}
declare var window: Window

import { Component, Prop, Vue } from 'vue-property-decorator'
import Peer from 'skyway-js'
import { SFURoom, MeshRoom } from 'skyway-js'
import VideoStreamPlayer from '@/components/VideoStreamPlayer.vue'

@Component({
  components: {
    VideoStreamPlayer,
  },
})
export default class HelloWorld extends Vue {
  private id = ''
  private roomName = ''
  private chatText = ''
  private isTalking = false

  private peer?: Peer
  private room?: SFURoom

  private subpeer?: Peer
  private subroom?: SFURoom

  private localStream: MediaStream | null = null

  private remoteStreams: MediaStreamWithPeerId[] = []

  public log(s: string, color = '') {
    // const logArea = document.querySelector('.log')
    // if (!logArea) { return }
    // const newChild = document.createElement('p')
    // newChild.innerText = s
    // newChild.style.color = color
    // logArea.appendChild(newChild)
  }

  public error(s: string) {
    this.log(s, 'red')
  }

  public joinRoom() {
    if (!this.peer || !this.peer.open) {
      return
    }
    const room = this.peer.joinRoom(this.roomName, {
      mode: 'sfu',
      stream: this.localStream || undefined,
    }) as SFURoom
    if (!room) {
      return
    }
    this.setupRoomEventHandlers(room)
    this.room = room
    this.isTalking = true
  }

  public leaveRoom() {
    if (!this.room) {
      return
    }
    this.room.close()
    this.isTalking = false
  }

  public sendChat() {
    if (!this.room) {
      return
    }
    this.room.send(this.chatText)
    this.log(`You: ${this.chatText}`)
  }

  public async mounted() {
    window.loadDisplayMedia = async () => {
      this.localStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false })
    }

    this.peer = new Peer({
      key: process.env.VUE_APP_SKYWAY_API_KEY,
      debug: 0,
    })

    if (this.peer) {
      this.setupPeerEventHandlers(this.peer)
    }
  }

  private dummyRoomJoin() {
    return new Promise((resolve, reject) => {
      const dummyPeer = new Peer({ key: process.env.VUE_APP_SKYWAY_API_KEY })
      dummyPeer.on('open', () => {
        const dummyRoom = dummyPeer.joinRoom(this.roomName, { mode: 'sfu' })
        dummyRoom.on('open', () => dummyRoom.close())
        dummyRoom.on('close', () => {
          dummyPeer.destroy()
          resolve()
        })
        dummyRoom.on('error', (error: Error) => reject(error))
      })
    })
  }

  private setupPeerEventHandlers(peer: Peer) {
    peer.on('open', () => {
      this.id = this.peer ? this.peer.id : ''
    })
    peer.on('error', this.error)
    peer.on('close', () => { return })
    peer.on('disconnected', () => { return })
  }

  private setupRoomEventHandlers(room: SFURoom) {
    if (this.room) {
        this.room.close()
    }
    room.on('open', this.handleRoomOpen)
    room.on('peerJoin', this.handleRoomPeerJoin)
    room.on('peerLeave', this.handleRoomPeerLeave)
    room.on('stream', this.handleRoomStream)
    room.on('data', this.handleRoomData)
    room.on('close', this.handleRoomClose)
    this.room = room
  }

  private async handleRoomOpen() {
    this.log('=== You joined ===')
    try {
        await this.dummyRoomJoin()
    } catch (err) {
        this.error(err)
    }
  }
  private handleRoomPeerJoin(peerId: string) {
    this.log(`=== ${peerId} joined ===`)
  }
  private handleRoomPeerLeave(peerId: string) {
//     const idx = this.remoteStreams.findIndex(s => s.peerId === peerId)
//     this.remoteStreams.splice(idx, 1)
    this.log(`=== ${peerId} left ===`)
  }
  private async handleRoomStream(stream: MediaStreamWithPeerId) {
    this.remoteStreams.push(stream)
    this.log(`${stream.peerId}: stream set`)
  }
  private handleRoomData(data: DataObject) {
    this.log(`${data.src}: ${data.data}`)
  }
  private handleRoomClose() {
    this.remoteStreams = []
    this.log(`=== you left ===`)
  }
}
</script>

<style scoped lang="scss">
.video-container {
  width: 100%;
  margin: 0 auto;
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
</style>
