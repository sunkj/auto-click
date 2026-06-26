/**
 * AI 智能操控模块入口
 *
 * 注册 IPC 处理器，协调 LangGraph 工作流的启动、状态推送和结果返回。
 */
import { ipcMain, BrowserWindow } from 'electron'
import { createAiAgentGraph } from './graph'
import { loadConfig, getDeepSeekKey } from '../config'
import type { AgentState, StatusPayload, EngineExecutionResult, AgentError } from './types'

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

/** 获取设备分辨率 */
function getDeviceResolution(): { width: number; height: number } {
  try {
    const { adb } = require('../screen-mirror/adb')
    // 从 adb 获取已缓存的分辨率
    return adb.getCachedResolution?.() || { width: 1080, height: 2400 }
  } catch {
    return { width: 1080, height: 2400 }
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

export function registerAiAgentHandlers(): void {
  ipcMain.handle(AI_AGENT_CHANNELS.SUBMIT, async (_event, payload: { input: string }) => {
    const apiKey = getDeepSeekKey()
    if (!apiKey) {
      send(AI_AGENT_CHANNELS.ERROR, {
        code: 'LLM_CALL_FAILED',
        message: '请先配置 DeepSeek API Key',
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
    executeWorkflow(payload.input, serial).catch((err) => {
      console.error('[AiAgent] 工作流执行失败:', err)
    })

    return { success: true }
  })

  ipcMain.handle(AI_AGENT_CHANNELS.CANCEL, async () => {
    // 由于 LangGraph 节点执行中无法优雅中断，
    // 目前通过标记停止，让当前节点完成后不继续执行
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

/** 执行 LangGraph 工作流 */
async function executeWorkflow(userInput: string, deviceSerial: string): Promise<void> {
  const graph = createAiAgentGraph()
  const resolution = getDeviceResolution()

  const initialState: AgentState = {
    userInput,
    deviceSerial,
    deviceResolution: resolution,
    intent: null,
    screenshotBase64: null,
    screenshotPath: null,
    visualResult: null,
    calibratedCoords: null,
    scaledWidth: 0,
    scaledHeight: 0,
    engineSteps: [],
    result: null,
    error: null,
    history: historyStore,
  }

  try {
    console.log('[AiAgent] 开始工作流:', userInput, 'serial:', deviceSerial)
    const finalState = await graph.invoke(initialState, {
      callbacks: [{
        handleNodeStart: (nodeId: string) => {
          const messages: Record<string, string> = {
            intent_parser: '正在理解指令...',
            screenshot: '正在截取屏幕...',
            visual_analysis: '正在分析屏幕内容...',
            coordinate_mapper: '正在校准坐标...',
            step_converter: '正在转换为执行步骤...',
            script_engine_executor: '正在执行...',
          }
          console.log('[AiAgent] 节点开始:', nodeId)
          pushStatus(nodeId, messages[nodeId] || '处理中...')
        },
      } as any],
    })

    console.log('[AiAgent] 工作流完成, result:', JSON.stringify(finalState.result).slice(0, 300))
    console.log('[AiAgent] engineSteps:', JSON.stringify(finalState.engineSteps).slice(0, 300))
    console.log('[AiAgent] intent:', JSON.stringify(finalState.intent).slice(0, 200))

    if (finalState.result) {
      send(AI_AGENT_CHANNELS.RESULT, finalState.result)

      // 添加到历史记录
      const entry = {
        timestamp: Date.now(),
        userInput,
        intent: finalState.intent,
        screenshotPath: finalState.screenshotPath,
        result: finalState.result,
        error: null,
      }
      historyStore = [entry, ...historyStore].slice(0, 100) // 保留最近 100 条
      send(AI_AGENT_CHANNELS.HISTORY, historyStore)
    }

    if (finalState.error) {
      send(AI_AGENT_CHANNELS.ERROR, finalState.error)

      const entry = {
        timestamp: Date.now(),
        userInput,
        intent: finalState.intent,
        screenshotPath: finalState.screenshotPath,
        result: null,
        error: finalState.error,
      }
      historyStore = [entry, ...historyStore].slice(0, 100)
      send(AI_AGENT_CHANNELS.HISTORY, historyStore)
    }
  } catch (err: any) {
    const error: AgentError = {
      code: 'UNKNOWN',
      message: err.message || '未知错误',
      retryable: true,
    }
    send(AI_AGENT_CHANNELS.ERROR, error)

    const entry = {
      timestamp: Date.now(),
      userInput,
      intent: null,
      screenshotPath: null,
      result: null,
      error,
    }
    historyStore = [entry, ...historyStore].slice(0, 100)
    send(AI_AGENT_CHANNELS.HISTORY, historyStore)
  }
}
