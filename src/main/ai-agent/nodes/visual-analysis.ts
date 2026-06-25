import type { AgentState } from '../types'
import { findElementByUiAutomator } from '../services/uiautomator-service'

/**
 * 视觉分析节点
 *
 * 使用 UI Automator dump 获取精确坐标（基于原生控件布局，像素级精度）。
 * VLM 视觉分析代码保留在 big-model-service.ts 中，暂未启用。
 */
export async function visualAnalysisNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, deviceResolution, deviceSerial } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法进行视觉分析')
  }

  if (!deviceSerial) {
    throw new Error('缺少设备序列号')
  }

  if (!intent.target) {
    throw new Error('意图缺少目标元素描述')
  }

  // 使用 UI Automator 获取精确坐标
  const uiResult = await findElementByUiAutomator(
    deviceSerial,
    intent.target,
    deviceResolution.width,
    deviceResolution.height,
  )

  if (uiResult.elements.length === 0) {
    throw new Error(`UI Automator 未找到目标元素: ${intent.target}`)
  }

  console.log('[AiAgent] UI Automator 命中:', intent.target,
    '坐标:', JSON.stringify(uiResult.elements[0].center))

  return { visualResult: uiResult }
}
