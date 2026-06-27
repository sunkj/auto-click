import type { AgentState } from '../../common/types'
import { DeepSeekService } from '../services/deepseek-service'
import { loadDynamicTools } from '../tools/dynamic-tools'

const deepseek = new DeepSeekService()

export async function intentParserNode(state: AgentState): Promise<Partial<AgentState>> {
  const { userInput } = state
  if (!userInput.trim()) throw new Error('指令不能为空')

  const availableTools = await loadDynamicTools()
  const intent = await deepseek.parseIntent(userInput, availableTools)

  return { intent, availableTools }
}
