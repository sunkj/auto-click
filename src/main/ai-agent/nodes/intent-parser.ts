import type { AgentState } from '../types'
import { DeepSeekService } from '../services/deepseek-service'
import { loadDynamicTools } from '../tools/dynamic-tools'

const deepseek = new DeepSeekService()

/**
 * 意图理解节点
 *
 * 1. 加载动态工具（录制记录 + 内置操作）
 * 2. 注入到提示词中，让 AI 知道有哪些快捷工具可用
 * 3. AI 可以返回 call_tool 直接调用已有工具，或返回常规动作
 */
export async function intentParserNode(state: AgentState): Promise<Partial<AgentState>> {
  const { userInput } = state

  if (!userInput.trim()) {
    throw new Error('指令不能为空')
  }

  // 加载动态工具
  const availableTools = await loadDynamicTools()

  const intent = await deepseek.parseIntent(userInput, availableTools)

  return {
    intent,
    availableTools,
  }
}
