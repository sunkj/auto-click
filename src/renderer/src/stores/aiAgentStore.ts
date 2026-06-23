import { create } from 'zustand'

// =============================================================================
// 类型定义
// =============================================================================

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface WorkflowNode {
  id: string
  label: string
  description: string
}

/** 工作流节点映射（用于展示进度） */
export const WORKFLOW_NODES: Record<string, WorkflowNode> = {
  intent_parser: {
    id: 'intent_parser',
    label: '意图理解',
    description: '正在理解指令...',
  },
  screenshot: {
    id: 'screenshot',
    label: '截取屏幕',
    description: '正在截取屏幕...',
  },
  visual_analysis: {
    id: 'visual_analysis',
    label: '视觉分析',
    description: '正在分析屏幕内容...',
  },
  coordinate_mapper: {
    id: 'coordinate_mapper',
    label: '坐标映射',
    description: '正在校准坐标...',
  },
  step_converter: {
    id: 'step_converter',
    label: '步骤转换',
    description: '正在转换为执行步骤...',
  },
  script_engine_executor: {
    id: 'script_engine_executor',
    label: '引擎执行',
    description: '正在执行...',
  },
}

// =============================================================================
// Store 定义
// =============================================================================

interface AiAgentStore {
  // 状态
  workflowStatus: WorkflowStatus
  currentNode: string | null
  statusMessage: string
  inputText: string

  // 结果
  lastResult: AiAgentScriptEngineResult | null
  lastError: AiAgentError | null

  // 历史
  history: AiAgentHistoryEntry[]

  // 配置（UI 本地状态）
  quickCommands: string[]

  // Actions
  setInputText: (text: string) => void
  submit: () => Promise<void>
  cancel: () => Promise<void>
  clearHistory: () => void
  setWorkflowStatus: (status: WorkflowStatus) => void
  setCurrentNode: (nodeId: string | null) => void
  setStatusMessage: (message: string) => void
  setLastResult: (result: AiAgentScriptEngineResult | null) => void
  setLastError: (error: AiAgentError | null) => void
  appendHistory: (entry: AiAgentHistoryEntry) => void
  setHistory: (history: AiAgentHistoryEntry[]) => void
}

function getAPI() {
  return window.electronAPI?.aiAgent
}

export const useAiAgentStore = create<AiAgentStore>((set, get) => ({
  // ---- 初始状态 ----
  workflowStatus: 'idle',
  currentNode: null,
  statusMessage: '',
  inputText: '',
  lastResult: null,
  lastError: null,
  history: [],
  quickCommands: [
    '点击微信',
    '滑动到下一屏',
    '长按支付宝',
    '返回桌面',
    '打开设置',
  ],

  // ---- Actions ----
  setInputText: (text) => set({ inputText: text }),

  submit: async () => {
    const { inputText } = get()
    if (!inputText.trim()) return

    const api = getAPI()
    if (!api) {
      // 无 electronAPI（开发模式），模拟执行
      set({
        workflowStatus: 'running',
        currentNode: 'intent_parser',
        statusMessage: '正在理解指令...',
        lastResult: null,
        lastError: null,
      })

      // 模拟进度动画
      const nodes = ['intent_parser', 'screenshot', 'visual_analysis', 'coordinate_mapper', 'step_converter', 'script_engine_executor']
      for (let i = 0; i < nodes.length; i++) {
        await new Promise((r) => setTimeout(r, 600))
        const node = WORKFLOW_NODES[nodes[i]]
        set({ currentNode: nodes[i], statusMessage: node.description })
      }

      // 模拟执行
      await new Promise((r) => setTimeout(r, 800))

      const mockResult: AiAgentScriptEngineResult = {
        success: true,
        totalSteps: 1,
        completedSteps: 1,
        duration: 350,
        stepResults: [{ index: 0, success: true, duration: 350 }],
      }

      const historyEntry: AiAgentHistoryEntry = {
        timestamp: Date.now(),
        userInput: inputText,
        intent: {
          action: 'tap',
          target: inputText,
          confidence: 0.92,
        },
        screenshotPath: null,
        result: mockResult,
        error: null,
      }

      set({
        workflowStatus: 'completed',
        currentNode: null,
        statusMessage: '执行完成',
        lastResult: mockResult,
        inputText: '',
        history: [historyEntry, ...get().history],
      })
      return
    }

    // 真实 IPC 调用
    set({
      workflowStatus: 'running',
      currentNode: 'intent_parser',
      statusMessage: '正在理解指令...',
      lastResult: null,
      lastError: null,
    })

    try {
      await api.submit(inputText)
      set({ inputText: '' })
    } catch (error: any) {
      set({
        workflowStatus: 'failed',
        statusMessage: '提交失败',
        lastError: { code: 'SUBMIT_FAILED', message: String(error), retryable: true },
      })
    }
  },

  cancel: async () => {
    const api = getAPI()
    if (api) {
      await api.cancel()
    }
    set({
      workflowStatus: 'idle',
      currentNode: null,
      statusMessage: '已取消',
    })
  },

  clearHistory: () => {
    set({ history: [] })
  },

  setWorkflowStatus: (status) => set({ workflowStatus: status }),
  setCurrentNode: (nodeId) => set({ currentNode: nodeId }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setLastResult: (result) => set({ lastResult: result }),
  setLastError: (error) => set({ lastError: error }),
  appendHistory: (entry) => set({ history: [entry, ...get().history] }),
  setHistory: (history) => set({ history }),
}))
