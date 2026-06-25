import type { AgentState } from '../types'
import { DeepSeekService } from '../services/big-model-service'

const deepseek = new DeepSeekService()

/**
 * 意图理解节点
 *
 * 调用 DeepSeek Chat 将用户自然语言指令解析为结构化的动作指令。
 * keyEvent 类型的指令不需要后续视觉分析。
 */
export async function intentParserNode(state: AgentState): Promise<Partial<AgentState>> {
  const { userInput } = state

  if (!userInput.trim()) {
    throw new Error('指令不能为空')
  }

  const intent = await deepseek.parseIntent(userInput)

  return {
    intent,
    // 如果是 keyEvent 类型，后续不需要视觉分析
    // keyEvent 类型的参数不需要坐标，由 step-converter 直接处理
  }
}
