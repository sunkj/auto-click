import type { EngineStep } from '../script-engine/types'
import type { DynamicToolDef } from './tools/dynamic-tools'

export type { DynamicToolDef }

// =============================================================================
// Agent 工作流状态
// =============================================================================

export interface AgentState {
  // 输入
  userInput: string
  deviceSerial: string
  deviceResolution: Resolution

  // 中间状态
  intent: IntentResult | null
  /** 可供 AI 调用的动态工具列表 */
  availableTools: DynamicToolDef[]
  screenshotBase64: string | null
  screenshotPath: string | null
  /** 缩放后图片的实际宽度（传给 VLM 的尺寸） */
  scaledWidth: number
  /** 缩放后图片的实际高度（传给 VLM 的尺寸） */
  scaledHeight: number
  visualResult: VisualResult | null
  calibratedCoords: CalibratedCoord | null
  /** 打开 App 前是否需要先回桌面 */
  needsHomeFirst: boolean
  engineSteps: EngineStep[]

  // 输出
  result: EngineExecutionResult | null
  error: AgentError | null

  // 上下文
  history: HistoryEntry[]
}

export interface Resolution {
  width: number
  height: number
}

// =============================================================================
// 意图理解
// =============================================================================

export type ActionType = 'tap' | 'swipe' | 'longPress' | 'input' | 'keyEvent' | 'sequence' | 'home' | 'openApp' | 'call_tool'

export interface IntentResult {
  action: ActionType
  target: string
  params?: IntentParams
  confidence: number
}

export interface IntentParams {
  direction?: 'up' | 'down' | 'left' | 'right'
  text?: string
  key?: 'HOME' | 'BACK' | 'MENU' | 'POWER' | 'APP_SWITCH'
  duration?: number
  steps?: IntentResult[]
  /** 用户显式指定的坐标，格式：{ x, y } */
  explicitCoords?: { x: number; y: number }
}

// =============================================================================
// 视觉分析
// =============================================================================

export interface VisualResult {
  elements: VisualElement[]
  rawDescription: string
}

export interface VisualElement {
  label: string
  bounds: Bounds
  center: Point
  confidence: number
  text?: string
  type?: string
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

// =============================================================================
// 坐标映射
// =============================================================================

export interface CalibratedCoord {
  action: string
  points: Point[]
  params: Record<string, any>
}

// =============================================================================
// 执行结果
// =============================================================================

export interface StepResultItem {
  index: number
  success: boolean
  error?: string
  duration: number
}

export interface EngineExecutionResult {
  success: boolean
  totalSteps: number
  completedSteps: number
  duration: number
  error?: string
  stepResults: StepResultItem[]
}

// =============================================================================
// 错误
// =============================================================================

export interface AgentError {
  code: ErrorCode
  message: string
  nodeId?: string
  retryable: boolean
}

export type ErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'SCREENSHOT_FAILED'
  | 'LLM_CALL_FAILED'
  | 'VLM_CALL_FAILED'
  | 'COORDINATE_INVALID'
  | 'STEP_CONVERSION_FAILED'
  | 'ENGINE_EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN'

// =============================================================================
// 历史记录
// =============================================================================

export interface HistoryEntry {
  timestamp: number
  userInput: string
  intent: IntentResult | null
  screenshotPath: string | null
  result: EngineExecutionResult | null
  error: AgentError | null
}

// =============================================================================
// IPC 消息类型
// =============================================================================

export type WorkflowStatus = 'running' | 'completed' | 'failed'

export interface StatusPayload {
  status: WorkflowStatus
  node: string
  message: string
}
