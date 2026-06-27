/**
 * AutoClick — 公共类型定义
 *
 * 合并 script-engine、script、ai-agent 三模块的类型定义，
 * 各模块的 types.ts 仅做 re-export。
 */

// =============================================================================
// 步骤类型 & 引擎步骤
// =============================================================================

export type StepType = 'click' | 'type' | 'swipe' | 'script' | 'longpress' | 'home' | 'openApp' | 'ai'

/** 脚本步骤（引擎内部使用的标准格式） */
export interface EngineStep {
  type: StepType
  data: Record<string, any>
  delay?: number
}

/** 引擎执行的脚本对象 */
export interface ScriptObject {
  name?: string
  description?: string
  stepInterval?: number
  steps: EngineStep[]
}

// =============================================================================
// 步骤参数（脚本管理模块）
// =============================================================================

export interface ClickStepData {
  x: number
  y: number
  description?: string
}

export interface TypeStepData {
  content: string
  description?: string
}

export interface SwipeStepData {
  direction: 'up' | 'down' | 'left' | 'right'
  duration: number
  description?: string
}

export interface ScriptStepData {
  scriptName: string
  description?: string
}

export interface LongPressStepData {
  x: number
  y: number
  duration: number
  description?: string
}

export interface HomeStepData {
  description?: string
}

export interface OpenAppStepData {
  appName: string
  description?: string
}

export interface AiStepData {
  description?: string
}

export type StepData =
  | ClickStepData
  | TypeStepData
  | SwipeStepData
  | ScriptStepData
  | LongPressStepData
  | HomeStepData
  | OpenAppStepData
  | AiStepData

/** 脚本类型 */
export type ScriptType = 'folder' | 'script'

/** 创建脚本时的请求参数 */
export interface CreateScriptParams {
  type?: ScriptType
  parentId?: string | null
  name: string
  filePath?: string | null
  description?: string
  sortOrder?: number
}

/** 更新脚本时的请求参数 */
export interface UpdateScriptParams {
  name?: string
  type?: ScriptType
  parentId?: string | null
  filePath?: string
  description?: string
  sortOrder?: number
}

/** 创建步骤时的请求参数 */
export interface CreateStepParams {
  type: StepType
  data: StepData
  name?: string
}

/** 更新步骤时的请求参数 */
export interface UpdateStepParams {
  type?: StepType
  data?: StepData
  name?: string
}

/** 从文件加载脚本的返回结构 */
export interface LoadFromFileResult {
  script: {
    name: string
    filePath: string
    description?: string
  }
  steps: CreateStepParams[]
}

// =============================================================================
// 引擎执行相关
// =============================================================================

/** 单步执行结果 */
export interface StepResult {
  success: boolean
  stepIndex: number
  error?: string
  duration: number
}

/** 脚本执行结果 */
export interface ExecutionResult {
  success: boolean
  scriptId: string
  totalSteps: number
  completedSteps: number
  duration: number
  error?: string
}

/** 执行状态 */
export interface ExecutionStatus {
  isExecuting: boolean
  currentScriptId: string | null
  currentStepIndex: number
  totalSteps: number
}

/** 执行上下文 */
export interface ExecutionContext {
  executionId: string
  scriptId: string
  serial: string
  steps: EngineStep[]
  stepInterval: number
  currentIndex: number
  startTime: number
}

/** 队列任务 */
export interface PendingTask {
  scriptId: string
  serial: string
  mode: 'full' | 'single'
  stepIndex?: number
  resolve: (result: ExecutionResult) => void
  reject: (error: Error) => void
}

/** IPC 进度事件负载 */
export interface StepProgressEvent {
  scriptId: string
  stepIndex: number
  totalSteps: number
  status: 'start' | 'end' | 'error'
  error?: string
}

// =============================================================================
// AI Agent — 工作流状态
// =============================================================================

export interface Resolution {
  width: number
  height: number
}

export type ActionType =
  | 'tap' | 'swipe' | 'longPress' | 'input' | 'keyEvent'
  | 'sequence' | 'home' | 'openApp' | 'call_tool' | 'check_text'

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
  explicitCoords?: { x: number; y: number }
  checkMode?: 'text' | 'app'
}

export interface ScreenCheckResult {
  matched: boolean
  description: string
}

// =============================================================================
// AI Agent — 视觉分析
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

export interface CalibratedCoord {
  action: string
  points: Point[]
  params: Record<string, any>
}

// =============================================================================
// AI Agent — 执行结果
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
// AI Agent — 错误 & 历史
// =============================================================================

export type ErrorCode =
  | 'DEVICE_NOT_FOUND' | 'SCREENSHOT_FAILED'
  | 'LLM_CALL_FAILED' | 'VLM_CALL_FAILED'
  | 'COORDINATE_INVALID' | 'STEP_CONVERSION_FAILED'
  | 'ENGINE_EXECUTION_FAILED' | 'TIMEOUT' | 'UNKNOWN'

export interface AgentError {
  code: ErrorCode
  message: string
  nodeId?: string
  retryable: boolean
}

export interface HistoryEntry {
  timestamp: number
  userInput: string
  intent: IntentResult | null
  screenshotPath: string | null
  result: EngineExecutionResult | null
  error: AgentError | null
}

export type WorkflowStatus = 'running' | 'completed' | 'failed'

export interface StatusPayload {
  status: WorkflowStatus
  node: string
  message: string
}

// =============================================================================
// AI Agent — 完整状态
// =============================================================================

export interface AgentState {
  userInput: string
  deviceSerial: string
  deviceResolution: Resolution
  intent: IntentResult | null
  availableTools: any[]
  screenshotBase64: string | null
  screenCheckResult: ScreenCheckResult | null
  engineSteps: EngineStep[]
  result: EngineExecutionResult | null
  error: AgentError | null
  history: HistoryEntry[]
}

export type ToolSource = 'recorded_click' | 'builtin'

export interface DynamicToolDef {
  /** 工具唯一标识 */
  id: string
  /** 工具名称（AI 匹配用） */
  name: string
  /** 工具描述 */
  description: string
  /** 来源类型 */
  source: ToolSource
  /** 内置动作类型（source=builtin 时有效） */
  builtinAction?: 'home' | 'openApp'
  /** 内置动作的目标 App 名称（openApp 时有效） */
  appName?: string
  /** 录制的点击坐标（source=recorded_click 时有效） */
  clickPos?: { x: number; y: number }
}
