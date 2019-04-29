<template lang="pug">
.drawing-chat-container
  drawing-container(
    ref="drawing"
    :toolType="toolType"
    :toolColor="toolColor"
    :toolWidth="toolWidth"
    :activeLayer="activeLayer"
    @draw="handleDraw"
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
        option(value="layer 0") Layer 0
        option(value="layer 1") Layer 1
    .control
      .color-sample(v-for="color in ['royalblue', 'darkorange']" :style="{ backgroundColor: color }" @click="toolColor=color")
  .chat-control
    input(v-model="roomName" :disabled="joined")
    button.call-button(v-if="joined" @click="leaveRoom") Leave
    button.call-button(v-else @click="joinRoom") Join
  .chat-infomation
    p ID : {{ id }}
</template>

<script lang="ts">
import { Watch, Component, Prop, Vue } from 'vue-property-decorator'
import Peer, { SFURoom, MeshRoom } from 'skyway-js'
import DrawingContainer, { DrawingPayload } from '@/components/DrawingContainer.vue'

type Data = CanvasRequest | CanvasData | DrawingData

interface DrawingData {
  type: 'drawing'
  payload: DrawingPayload
}

interface CanvasData {
  type: 'canvas'
  payload: CanvasPayload
}

interface CanvasRequest {
  type: 'request'
  payload: null
}

interface CanvasPayload {
  data: Record<string, string>
  layerOrder: string[]
}

@Component({
  components: {
    DrawingContainer,
  },
})
export default class DrawingChat extends Vue {
  private activeLayer = 'layer 0'
  private toolType: 'pencil' | 'eraser' = 'pencil'
  private toolColor = '#333333'
  private toolWidth = 3

  private id = ''
  private roomName = ''
  private joined = false

  private isMasterPeer = false

  private peer?: Peer
  private room?: SFURoom

  private localStream: MediaStream | null = null
  private remoteStreams: MediaStreamWithPeerId[] = []

  @Watch('toolType')
  public onToolTypeChange(val: 'pencil' | 'eraser') {
    if (val === 'eraser') {
      this.toolWidth = 30
    } else {
      this.toolWidth = 3
    }
  }

  public joinRoom() {
    if (!this.peer || !this.peer.open) {
      return
    }
    const room = this.peer.joinRoom(this.roomName, {
      mode: 'sfu',
    }) as SFURoom

    if (!room) {
      return
    }

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
    this.joined = true
  }

  public leaveRoom() {
    if (!this.room) {
      return
    }
    this.room.close()
    this.joined = false
  }

  public handleDraw(payload: DrawingPayload) {
    this.sendData({
      type: 'drawing',
      payload,
    })
  }

  public async mounted() {
    const peer = new Peer({
      key: process.env.VUE_APP_SKYWAY_API_KEY,
      debug: 0,
    })

    if (peer) {
      peer.on('open', () => {
        this.id = this.peer ? this.peer.id : ''
      })
      peer.on('error', console.error)
      peer.on('close', () => { return })
      peer.on('disconnected', () => { return })
      this.peer = peer
    }
  }

  private sendData(data: Data) {
    if (!this.room) {
      return
    }
    this.room.send(data)
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

  private async handleRoomOpen() {
    console.log('=== You joined ===')
    if (!this.room) {
      return
    }
    this.sendData({
      type: 'request',
      payload: null,
    })
    try {
      await this.dummyRoomJoin()
    } catch (err) {
      console.error(err)
    }
  }
  private handleRoomPeerJoin(peerId: string) {
    console.log(`=== ${peerId} joined ===`)
  }
  private handleRoomPeerLeave(peerId: string) {
    console.log(`=== ${peerId} left ===`)
  }
  private async handleRoomStream(stream: MediaStreamWithPeerId) {
    this.remoteStreams.push(stream)
  }
  private handleRoomData(data: DataObject) {
    const src = data.src
    const dataType = data.data.type
    const payload = data.data.payload

    if (dataType === 'request') {
      this.handleRequest()
    } else if (dataType === 'canvas') {
      this.handleCanvas(payload)
    } else if (dataType === 'drawing') {
      this.handleDrawing(payload)
    }
  }
  private handleRoomClose() {
    this.remoteStreams = []
    console.log(`=== you left ===`)
  }

  // handler for recieved data
  private handleRequest() {
    // send all canvases as data url
    const canvasesData = (this.$refs.drawing as DrawingContainer).getDrawingCanvasesData()
    this.sendData({
      type: 'canvas',
      payload: {
        data: canvasesData,
        layerOrder: [],
      },
    })
  }
  private handleCanvas(payload: CanvasPayload) {
    (this.$refs.drawing as DrawingContainer).setDrawingCanvasesData(payload.data)
  }
  private handleDrawing(payload: DrawingPayload) {
    (this.$refs.drawing as DrawingContainer).pushDrawingToLayer(payload)
  }
}
</script>

<style scoped lang="scss">
.video-container {
  width: 100%;
  margin: 0 auto;
  max-width: 600px;
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
