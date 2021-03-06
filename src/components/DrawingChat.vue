<template lang="pug">
.drawing-chat-container
  drawing-container.drawing-container(
    ref="drawing"
    :activeLayer="toolProperties.activeLayer"
    :toolType="toolProperties.toolType"
    :toolColor="toolProperties.toolColor"
    :toolWidth="toolProperties.toolWidth"
    :viewScale="toolProperties.viewScale"
    :layerStateMap="layerStateMap"
    :layerOrder="layerOrder"
    :userNameMap="userNameMap"
    :userPositionMap="userPositionMap"
    @draw="handleDraw"
    @zoom="handleZoom"
    @cursor-move="handleCursorMove"
  )
  tool-panel(
    v-model="toolProperties"
    :layerOrder="layerOrder"
    :containerHeight="540"
    :id="id"
    :joined="joined"
    @property-change="handleToolPropertyChange"
    @layer-change="handleLayerChange"
    @join-room="joinRoom"
    @leave-room="leaveRoom"
    @change-name="setAndNotifyUsername"
  )
</template>

<script lang="ts">
import { Watch, Component, Prop, Vue } from 'vue-property-decorator'
import Peer, { SFURoom, MeshRoom } from 'skyway-js'
import {
  ToolProperties,
  DrawingPayload,
  LayerState,
  LayerPayload,
} from '../lib/interface'
import DrawingContainer from '@/components/DrawingContainer.vue'
import ToolPanel from '@/components/ToolPanel.vue'

type Data = CanvasRequest | CanvasData | DrawingData | LayerData | CursorData | UserData

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

interface CursorData {
  type: 'cursor'
  payload: CursorPayload
}

interface UserData {
  type: 'user'
  payload: UserPayload
}

/**
 * @param data       map of layer id to canvas base64-encoded data.
 * @param layerOrder current layer order.
 */
interface CanvasPayload {
  data: Record<string, string>
  layerOrder: string[]
}

interface CursorPayload {
  user: string
  position: [number, number]
}

interface UserPayload {
  user: string
  name: string
}

@Component({
  components: {
    DrawingContainer,
    ToolPanel,
  },
})
export default class DrawingChat extends Vue {
  private toolProperties: ToolProperties = {
    activeLayer: 'initial_0',
    toolType: 'pencil',
    toolColor: '#263238',
    toolWidth: 5,
    viewScale: 1,
    enablePressure: true,
    enableAlphaPressure: false,
  }

  private id = ''
  private roomName = ''
  private username = ''
  private joined = false

  private isMasterPeer = false

  private peer?: Peer
  private room?: SFURoom

  private localStream: MediaStream | null = null
  private remoteStreams: MediaStreamWithPeerId[] = []

  private cursorThrottleCounter = 0
  private cursorThrottleRate = 5
  private lastCursorPosition: [number, number] = [0, 0]

  private hasRequestedCanvas = false
  private hasRecievedCanvas = false

  private userNameMap : Record<string, string> = {}

  private layerStateMap: Record<string, LayerState> = {
    initial_0: { drawings: [], layerId: 'initial_0' },
    initial_1: { drawings: [], layerId: 'initial_1' },
  }
  private layerOrder = ['initial_0', 'initial_1']

  private userPositionMap: Record<string, [number, number]> = {}

  public joinRoom(payload: [string]) {
    this.roomName = payload[0]
    if (!this.peer || !this.peer.open) {
      return
    }
    const room = this.peer.joinRoom(this.roomName, this.localStream ? {
      mode: 'sfu',
      stream: this.localStream,
    } : {
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
  public setAndNotifyUsername(username?: string) {
    if (username) {
      this.username = username
    }
    this.sendData({
      type: 'user',
      payload: {
        user: this.id,
        name: this.username
      }
    })
  }
  public setAndNotifyCursor(position?: [number, number]) {
    if (position) {
      this.lastCursorPosition = position
    }
    this.sendData({
      type: 'cursor',
      payload: {
        user: this.id,
        position: this.lastCursorPosition,
      },
    })
  }

  public handleToolPropertyChange(payload: ToolProperties) {

  }

  public handleDraw(payload: DrawingPayload) {
    this.pushDrawingToLayer(payload)
    this.sendData({
      type: 'drawing',
      payload,
    })
  }
  public handleCursorMove(position: [number, number]) {
    this.cursorThrottleCounter = (this.cursorThrottleCounter + 1) % this.cursorThrottleRate
    if (this.cursorThrottleCounter !== 0) {
      return
    }
    this.setAndNotifyCursor(position)
  }
  public handleZoom(scale: number) {
    this.toolProperties.viewScale = scale
  }

  public pushDrawingToLayer(payload: DrawingPayload) {
    const activeLayerState = this.layerStateMap[payload.layerId]
    if (!activeLayerState) {
      return
    }
    activeLayerState.drawings.push(payload)
  }

  public async mounted() {
    // try {
    //   this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    // } catch (error) {
    //   console.error(error)
    // }
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
  private handleLayerChange(payload: LayerPayload) {
    this.handleRecieveLayer(payload)
    this.sendData({
      type: 'layer',
      payload
    })
  }

  private sendData(data: Data) {
    if (!this.room) {
      return
    }
    this.room.send(data)
  }

  // handler for recieved data
  private handleRecieveRequest() {
    // send all canvases as data url
    const canvasesData = (this.$refs.drawing as DrawingContainer).getDrawingCanvasesData()
    this.sendData({
      type: 'canvas',
      payload: {
        data: canvasesData,
        layerOrder: this.layerOrder,
      },
    })
    this.setAndNotifyUsername()
    this.setAndNotifyCursor()
  }
  private async handleRecieveCanvas(payload: CanvasPayload) {
    payload.layerOrder.forEach((layerId) => {
      this.$set(this.layerStateMap, layerId, { drawings: [], layerId })
    })
    this.layerOrder = payload.layerOrder;
    this.hasRecievedCanvas = true;
    await this.$nextTick;
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
  private handleRecieveCursor(payload: CursorPayload) {
    this.$set(this.userPositionMap, payload.user, payload.position)
  }
  private handleRecieveUser(payload: UserPayload) {
    this.$set(this.userNameMap, payload.user, payload.name)
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
    this.setAndNotifyUsername()
    this.hasRequestedCanvas = true
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
    this.$delete(this.userPositionMap, peerId)
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
    } else if (dataType === 'cursor') {
      this.handleRecieveCursor(payload)
    } else if (dataType === 'user') {
      this.handleRecieveUser(payload)
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
.drawing-chat-container {
  position: relative;
}
.drawing-container {
  position: absolute;
  top: 0;
  bottom: 0;
}
</style>
