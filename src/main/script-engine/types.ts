/** 步骤类型 */
export type StepType = 'click' | 'type' | 'swipe' | 'longpress' | 'home'

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
