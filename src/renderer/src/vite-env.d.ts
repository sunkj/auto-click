/// <reference types="vite/client" />

/** IPC 调用返回的通用包装 */
interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 渲染进程使用的步骤数据模型 */
interface RendererStep {
  id: string
  index: number
  type: 'click' | 'type' | 'swipe' | 'script' | 'home' | 'openApp' | 'ai'
  params: Record<string, string>
  description: string
  name: string
}

/** 渲染进程使用的脚本数据模型 */
interface RendererScript {
  id: string
  name: string
  type: 'folder' | 'script'
  parentId: string | null
  steps?: RendererStep[]
}

interface ElectronScriptAPI {
  createScript: (args: {
    name: string
    filePath: string
    description?: string
    parentId?: string | null
  }) => Promise<IpcResult<RendererScript>>
  getAllScripts: () => Promise<IpcResult<RendererScript[]>>
  getScriptById: (id: string) => Promise<IpcResult<RendererScript | null>>
  updateScript: (id: string, updates: Record<string, unknown>) => Promise<IpcResult<RendererScript | null>>
  deleteScript: (id: string) => Promise<IpcResult<boolean>>
  updateScriptsOrder: (scriptIds: string[]) => Promise<IpcResult<void>>

  createFolder: (name: string) => Promise<IpcResult<RendererScript>>
  getAllFolders: () => Promise<IpcResult<RendererScript[]>>
  deleteFolder: (id: string) => Promise<IpcResult<boolean>>

  addStep: (args: {
    scriptId: string
    type: string
    params: Record<string, string>
    insertIndex?: number
    name?: string
  }) => Promise<IpcResult<RendererStep>>
  getStepsByScriptId: (scriptId: string) => Promise<IpcResult<RendererStep[]>>
  updateStep: (stepId: number, type: string, params: Record<string, string>, name?: string) => Promise<IpcResult<RendererStep | null>>
  deleteStep: (stepId: number) => Promise<IpcResult<boolean>>
  replaceSteps: (scriptId: string, steps: Array<{ type: string; params: Record<string, string> }>) => Promise<IpcResult<RendererStep[]>>
  updateStepsOrder: (scriptId: string, stepIds: number[]) => Promise<IpcResult<void>>

  /** 导入：打开文件对话框 → 解析 → 入库 → 返回新脚本 */
  importScript: () => Promise<IpcResult<RendererScript>>
  /** 导出：生成 .js 文件 → 保存对话框 → 写入 */
  exportScript: (scriptId: string) => Promise<IpcResult<string>>

  syncToFile: (scriptId: string) => Promise<IpcResult<boolean>>
  loadFromFile: (filePath: string) => Promise<IpcResult<{
    script: RendererScript
    steps: RendererStep[]
  }>>
}

/** 投屏帧事件 */
interface FramePayload {
  type: 'config' | 'frame' | 'meta'
  data: number[]
  keyframe?: boolean
  pts?: number
  meta?: { width: number; height: number; codec?: string }
}

interface ElectronScreenMirrorAPI {
  getDevices: () => Promise<IpcResult<Array<{ serial: string; model: string; resolution: string }>>>
  getStatus: () => Promise<IpcResult<{ status: string; serial: string | null }>>
  connect: (serial?: string) => Promise<IpcResult<{ serial: string; model: string; resolution: string }>>
  disconnect: () => Promise<IpcResult<void>>
  tap: (x: number, y: number) => Promise<IpcResult<void>>
  swipe: (x1: number, y1: number, x2: number, y2: number, duration?: number) => Promise<IpcResult<void>>
  swipeUp: () => Promise<IpcResult<void>>
  swipeDown: () => Promise<IpcResult<void>>
  back: () => Promise<IpcResult<void>>
  home: () => Promise<IpcResult<void>>
  text: (t: string) => Promise<IpcResult<void>>
  screenshot: () => Promise<IpcResult<{ path: string }>>
  onFrame: (callback: (event: FramePayload) => void) => () => void
  onConnected: (callback: (status: string) => void) => () => void
  onDisconnected: (callback: () => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

// =============================================================================
// AI Agent 类型定义
// =============================================================================

type AiAgentActionType = 'tap' | 'swipe' | 'longPress' | 'input' | 'keyEvent' | 'sequence'

interface AiAgentIntentResult {
  action: AiAgentActionType
  target: string
  params?: {
    direction?: 'up' | 'down' | 'left' | 'right'
    text?: string
    key?: 'HOME' | 'BACK' | 'MENU' | 'POWER' | 'APP_SWITCH'
    duration?: number
    steps?: AiAgentIntentResult[]
  }
  confidence: number
}

interface AiAgentStepResult {
  index: number
  success: boolean
  error?: string
  duration: number
}

interface AiAgentScriptEngineResult {
  success: boolean
  totalSteps: number
  completedSteps: number
  duration: number
  error?: string
  stepResults: AiAgentStepResult[]
}

interface AiAgentError {
  code: string
  message: string
  nodeId?: string
  retryable: boolean
}

interface AiAgentHistoryEntry {
  timestamp: number
  userInput: string
  intent: AiAgentIntentResult | null
  screenshotPath: string | null
  result: AiAgentScriptEngineResult | null
  error: AiAgentError | null
}

interface ElectronAiAgentAPI {
  submit: (input: string) => Promise<IpcResult<unknown>>
  cancel: () => Promise<IpcResult<unknown>>
  getHistory: () => Promise<IpcResult<AiAgentHistoryEntry[]>>
  onStatus: (callback: (event: { status: string; node: string; message: string }) => void) => () => void
  onResult: (callback: (result: AiAgentScriptEngineResult) => void) => () => void
  onError: (callback: (error: AiAgentError) => void) => () => void
  onHistory: (callback: (history: AiAgentHistoryEntry[]) => void) => () => void
}

interface Window {
  electronAPI: {
    platform: string
    script: ElectronScriptAPI
    screenMirror: ElectronScreenMirrorAPI
    engine?: {
      runScript: (scriptId: string, serial: string) => Promise<IpcResult<unknown>>
      runStep: (scriptId: string, stepIndex: number, serial: string) => Promise<IpcResult<unknown>>
      stopExecution: () => Promise<IpcResult<unknown>>
      getStatus: () => Promise<IpcResult<unknown>>
      onStepStart: (callback: (event: any) => void) => () => void
      onStepEnd: (callback: (event: any) => void) => () => void
      onStepError: (callback: (event: any) => void) => () => void
      onComplete: (callback: (event: any) => void) => () => void
    }
    recordedClick: {
      create: (params: { name: string; x: number; y: number; type: string; ext?: string | null }) => Promise<IpcResult<{ id: number; name: string; x: number; y: number; type: string; ext: string | null; createdAt: string; updatedAt: string }>>
      getAll: (page: number, pageSize: number) => Promise<IpcResult<{ items: Array<{ id: number; name: string; x: number; y: number; type: string; ext: string | null; createdAt: string; updatedAt: string }>; total: number; page: number; pageSize: number; totalPages: number }>>
      update: (id: number, updates: { name?: string }) => Promise<IpcResult<{ id: number; name: string; x: number; y: number; type: string; ext: string | null; createdAt: string; updatedAt: string }>>
      delete: (id: number) => Promise<IpcResult<boolean>>
    }
    config?: {
      load: () => Promise<IpcResult<unknown>>
      save: (config: any) => Promise<IpcResult<unknown>>
    }
    window?: {
      resizeToScreen: (width: number, height: number) => Promise<IpcResult<unknown>>
      restoreSize: () => Promise<IpcResult<unknown>>
    }
    aiAgent?: ElectronAiAgentAPI
  }
}
