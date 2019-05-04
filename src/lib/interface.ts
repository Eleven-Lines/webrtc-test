export type ToolType = 'pencil' | 'eraser'

/**
 * Properties to config in tool panel,
 */
export interface ToolProperties {
  activeLayer: string
  toolType: ToolType
  toolColor: string
  toolWidth: number
  viewScale: number
  enablePressure: boolean
}

export interface LayerState {
  drawings: DrawingPayload[],
  layerId: string
}

export interface DrawingTool {
  toolType: ToolType
  color: string
  width: number
  withPressure: boolean
}

/**
 * Payload for 'drawing' data.
 */
export interface DrawingPayload {
  state: 'start' | 'suppressed' | 'drawing' | 'end'
  tool: DrawingTool
  layerId: string
  position: [number, number]
  positionHistory: PositionHistoryPayload[]
  painter: string
}

export interface PositionHistoryPayload {
  position: [number, number]
  width: number
}

/**
 * Payload for layer change, or remote layer change.
 * @param operation  operation to perform.
 * @param layerOrder layer order after operation.
 * @param layerId    layerId to operate, for delete / add.
 */
export interface LayerPayload {
  operation: 'add' | 'delete' | 'reorder'
  layerOrder: string[]
  layerId?: string
}
