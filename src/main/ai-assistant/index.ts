/**
 * AI 智能操控模块入口
 *
 * 注册 IPC 处理器，协调 LangGraph 工作流的启动、状态推送和结果返回。
 */
import { ipcMain, BrowserWindow } from 'electron'
import { executeAiWorkflow } from './execute-ai-workflow'
import { loadConfig, getLLMKey } from '../config'
import type { StatusPayload, AgentError, AgentState } from './types'

/** IPC 通道常量 */
export const AI_AGENT_CHANNELS = {
  SUBMIT: 'ai-agent:submit',
  CANCEL: 'ai-agent:cancel',
  GET_HISTORY: 'ai-agent:get-history',
  STATUS: 'ai-agent:status',
  RESULT: 'ai-agent:result',
  ERROR: 'ai-agent:error',
  HISTORY: 'ai-agent:history',
} as const

/** 获取当前已连接设备的 serial（从 screen-mirror 状态读取） */
function getCurrentDeviceSerial(): string | null {
  // 通过 screen-mirror 的 control 模块获取
  try {
    const { ctrl } = require('../screen-mirror/control')
    return ctrl.getSerial() || null
  } catch {
    return null
  }
}

/** 向所有窗口发送事件 */
function send(channel: string, data?: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data))
}

/** 工作流状态推送辅助 */
function pushStatus(node: string, message: string) {
  const payload: StatusPayload = { status: 'running', node, message }
  send(AI_AGENT_CHANNELS.STATUS, payload)
}

// 历史记录（内存存储，后续可持久化到 SQLite）
let historyStore: AgentState['history'] = []

// ── 取消执行标记 ──
let cancelRequested = false

/** 检查是否请求取消 */
export function isCancelRequested(): boolean {
  return cancelRequested
}

/** 重置取消标记 */
export function resetCancelFlag(): void {
  cancelRequested = false
}

export function registerAiAgentHandlers(): void {
  ipcMain.handle(AI_AGENT_CHANNELS.SUBMIT, async (_event, payload: { input: string }) => {
    const apiKey = getLLMKey()
    if (!apiKey) {
      send(AI_AGENT_CHANNELS.ERROR, {
        code: 'LLM_CALL_FAILED',
        message: '请先配置 LLM API Key（意图解析）',
        retryable: false,
      } as AgentError)
      return { success: false, error: 'API Key 未配置' }
    }

    const serial = getCurrentDeviceSerial()
    if (!serial) {
      send(AI_AGENT_CHANNELS.ERROR, {
        code: 'DEVICE_NOT_FOUND',
        message: '设备未连接，请先连接设备',
        retryable: true,
      } as AgentError)
      return { success: false, error: '设备未连接' }
    }

    // 异步执行，不等待完成
    resetCancelFlag()
    executeWorkflow(payload.input, serial).catch((err) => {
      console.error('[AiAgent] 工作流执行失败:', err)
    })

    return { success: true }
  })

  ipcMain.handle(AI_AGENT_CHANNELS.CANCEL, async () => {
    cancelRequested = true
    send(AI_AGENT_CHANNELS.STATUS, {
      status: 'failed',
      node: '',
      message: '已取消',
    } as StatusPayload)
    return { success: true }
  })

  ipcMain.handle(AI_AGENT_CHANNELS.GET_HISTORY, async () => {
    return { success: true, data: historyStore }
  })
}

/** 执行 AI 工作流 */
async function executeWorkflow(userInput: string, deviceSerial: string): Promise<void> {
  try {
    pushStatus('intent_parser', '正在理解指令...')
    console.log('[AiAgent] 开始工作流:', userInput, 'serial:', deviceSerial)

    const result = await executeAiWorkflow(userInput, deviceSerial, (desc, idx, total) => {
      send(AI_AGENT_CHANNELS.STATUS, {
        status: 'running',
        node: 'step_executor',
        message: desc,
        stepIndex: idx,
        totalSteps: total,
      } as StatusPayload)
    }, isCancelRequested)

    console.log('[AiAgent] 工作流完成:', JSON.stringify(result).slice(0, 300))

    // check_text 检测结果
    if (result.description) {
      send(AI_AGENT_CHANNELS.RESULT, {
        success: result.success,
        description: result.description,
        type: 'check_text',
      })
      historyStore = [{ timestamp: Date.now(), userInput, intent: null, screenshotPath: null, result: null, error: null }, ...historyStore].slice(0, 100)
      send(AI_AGENT_CHANNELS.HISTORY, historyStore)
      return
    }

    // 执行结果
    if (result.stepResults) {
      send(AI_AGENT_CHANNELS.RESULT, result)
      historyStore = [{
        timestamp: Date.now(), userInput, intent: null, screenshotPath: null,
        result: {
          success: result.success,
          totalSteps: result.engineSteps.length,
          completedSteps: result.stepResults.filter(r => r.success).length,
          duration: result.duration,
          error: result.error,
          stepResults: result.stepResults.map((r, i) => ({ index: i, ...r })),
        },
        error: null,
      }, ...historyStore].slice(0, 100)
      send(AI_AGENT_CHANNELS.HISTORY, historyStore)
    }

    // 错误
    if (result.error) {
      const agentErr: AgentError = { code: 'ENGINE_EXECUTION_FAILED', message: result.error, retryable: true }
      send(AI_AGENT_CHANNELS.ERROR, agentErr)
      historyStore = [{ timestamp: Date.now(), userInput, intent: null, screenshotPath: null, result: null, error: agentErr }, ...historyStore].slice(0, 100)
      send(AI_AGENT_CHANNELS.HISTORY, historyStore)
    }
  } catch (err: any) {
    const error: AgentError = { code: 'UNKNOWN', message: err.message || '未知错误', retryable: true }
    send(AI_AGENT_CHANNELS.ERROR, error)
    historyStore = [{ timestamp: Date.now(), userInput, intent: null, screenshotPath: null, result: null, error }, ...historyStore].slice(0, 100)
    send(AI_AGENT_CHANNELS.HISTORY, historyStore)
  }
}
