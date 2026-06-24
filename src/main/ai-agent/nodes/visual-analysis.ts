import type { AgentState, VisualResult } from '../types'
import { ZhipuAIService } from '../services/big-model-service'

const zhipuAI = new ZhipuAIService()

/**
 * 视觉分析节点
 *
 * 基于 LLM 的文本启发式估算 + 设备分辨率，
 * 估算目标元素在屏幕上的大致位置。
 * 当前为纯文本方案（DeepSeek 暂不支持多模态），
 * 后续可接入 OpenAI Vision / Claude 等支持图像识别的 API。
 */
export async function visualAnalysisNode(state: AgentState): Promise<Partial<AgentState>> {
  const { screenshotBase64, intent, deviceResolution } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法进行视觉分析')
  }

  // 传递分辨率供 LLM 估算坐标
  zhipuAI.setLastResolution(deviceResolution)

  const visualResult: VisualResult = await zhipuAI.analyzeScreenshot(screenshotBase64 || '', intent)

  return { visualResult }
}
