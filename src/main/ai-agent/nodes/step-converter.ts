import type { AgentState } from '../../common/types'
import { convertToEngineSteps } from '../tools/step-converter'

export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, availableTools } = state
  if (!intent) throw new Error('缺少意图数据')

  if (intent.action === 'check_text') return { engineSteps: [] }

  if (intent.action === 'sequence' && intent.params?.steps) {
    const allEngineSteps: any[] = []
    for (const subIntent of intent.params.steps) {
      if (subIntent.action === 'check_text') continue
      const steps = convertToEngineSteps(subIntent, null, availableTools)
      allEngineSteps.push(...steps)
    }
    return { engineSteps: allEngineSteps }
  }

  const engineSteps = convertToEngineSteps(intent, null, availableTools)
  return { engineSteps }
}
