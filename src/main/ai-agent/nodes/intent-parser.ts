import type { AgentState } from '../../common/types'
import { LLMService } from '../services/llm-service'
import { loadDynamicTools } from '../tools/dynamic-tools'

const llm = new LLMService()

export async function intentParserNode(state: AgentState): Promise<Partial<AgentState>> {
  const { userInput } = state
  if (!userInput.trim()) throw new Error('指令不能为空')

  const availableTools = await loadDynamicTools()
  const intent = await llm.parseIntent(userInput, availableTools)

  return { intent, availableTools }
}
