<template lang="pug">
.drawing-chat-container
  drawing-container(
    ref="drawing"
    :toolType="toolType"
    :toolColor="toolColor"
    :toolWidth="toolWidth"
    :activeLayer="activeLayer"
    :viewScale="viewScale"
    :layerStateMap="layerStateMap"
    :layerOrder="layerOrder"
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
        option(v-for="id in layerOrder") {{ id }}
      button(@click="addLayer") add
      button(@click="deleteLayer(activeLayer)") delete
    .control
      input#scale(type="range" min="0.1" max="2" step="0.05" v-model.number="viewScale")
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
import DrawingContainer, { DrawingPayload, LayerState } from '@/components/DrawingContainer.vue'

type Data = CanvasRequest | CanvasData | DrawingData | LayerData

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

interface LayerData {
  type: 'layer'
  payload: LayerPayload
}

/**
 * @param data       map of layer id to canvas base64-encoded data.
 * @param layerOrder current layer order.
 */
interface CanvasPayload {
  data: Record<string, string>
  layerOrder: string[]
}

/**
 * @param operation  operation to perform.
 * @param layerOrder layer order after operation.
 * @param layerId    layerId to operate, for delete / add.
 */
interface LayerPayload {
  operation: 'add' | 'delete' | 'reorder'
  layerOrder: string[]
  layerId?: string
}

const generateRandomString = (validator?: (arg0: string) => boolean): string => {
  const str = Math.random().toString(36).slice(-8)
  return !validator || validator(str) ? str : generateRandomString(validator)
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
  private toolWidth = 10
  private viewScale = 1

  private penSize = 10
  private eraserSize = 30

  private id = ''
  private roomName = ''
  private joined = false

  private isMasterPeer = false

  private peer?: Peer
  private room?: SFURoom

  private localStream: MediaStream | null = null
  private remoteStreams: MediaStreamWithPeerId[] = []

  private layerStateMap: Record<string, LayerState> = {
    'layer 0': { drawings: [], layerId: 'layer 0' },
    'layer 1': { drawings: [], layerId: 'layer 1' },
  }
  private layerOrder = ['layer 0', 'layer 1']

  @Watch('toolType')
  public onToolTypeChange(val: 'pencil' | 'eraser') {
    if (val === 'eraser') {
      this.penSize = this.toolWidth
      this.toolWidth = this.eraserSize
    } else {
      this.eraserSize = this.toolWidth
      this.toolWidth = this.penSize
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
    this.pushDrawingToLayer(payload)
    this.sendData({
      type: 'drawing',
      payload,
    })
  }

  public pushDrawingToLayer(payload: DrawingPayload) {
    const activeLayerState = this.layerStateMap[payload.layerId]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings.push(payload)
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

  private addLayer() {
    const layerId = generateRandomString(id => !this.layerStateMap[id])
    this.$set(this.layerStateMap, layerId, { drawings: [], layerId })
    this.layerOrder.push(layerId)
    this.sendData({
      type: 'layer',
      payload: {
        operation: 'add',
        layerOrder: this.layerOrder,
        layerId
      }
    })
  }
  private deleteLayer(layerId: string) {
    if (!this.layerStateMap[layerId]) {
      throw('invalid layer')
    }
    this.$delete(this.layerStateMap, layerId)
    this.layerOrder.splice(this.layerOrder.findIndex(l => l === layerId), 1)
    this.sendData({
      type: 'layer',
      payload: {
        operation: 'delete',
        layerOrder: this.layerOrder,
        layerId
      }
    })
  }

  // handler for recieved data
  private handleRecieveRequest() {
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
  private handleRecieveCanvas(payload: CanvasPayload) {
    (this.$refs.drawing as DrawingContainer).setDrawingCanvasesData(payload.data)
  }
  private handleRecieveDrawing(payload: DrawingPayload) {
    this.pushDrawingToLayer(payload)
  }
  private handleRecieveLayer(payload: LayerPayload) {
    if (payload.operation === 'add' && payload.layerId) {
      this.$set(this.layerStateMap, payload.layerId, { drawings: [], layerId: payload.layerId })
      this.layerOrder = payload.layerOrder
    } else if (payload.operation === 'delete' && payload.layerId) {
      this.$delete(this.layerStateMap, payload.layerId)
      this.layerOrder = payload.layerOrder
    } else if (payload.operation === 'reorder') {
      this.layerOrder = payload.layerOrder
    }
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
      this.handleRecieveRequest()
    } else if (dataType === 'canvas') {
      this.handleRecieveCanvas(payload)
    } else if (dataType === 'drawing') {
      this.handleRecieveDrawing(payload)
    } else if (dataType === 'layer') {
      this.handleRecieveLayer(payload)
    }
  }
  private handleRoomClose() {
    this.remoteStreams = []
    console.log(`=== you left ===`)
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
