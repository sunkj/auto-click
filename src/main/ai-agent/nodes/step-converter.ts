import type { AgentState } from '../types'
import { convertToEngineSteps } from '../tools/step-converter'

/**
 * 步骤转换节点
 *
 * 将 AI 解析结果（IntentResult）映射为 ScriptEngine 的 EngineStep[]。
 * check_text 步骤已被 text_check 节点处理，此处跳过。
 */
export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, availableTools } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法转换步骤')
  }

  // sequence：跳过已处理过的 check_text 子步骤
  if (intent.action === 'sequence' && intent.params?.steps) {
    const allEngineSteps: any[] = []
    for (const subIntent of intent.params.steps) {
      if (subIntent.action === 'check_text') continue // 已由 text_check 处理
      const steps = convertToEngineSteps(subIntent, null, availableTools)
      allEngineSteps.push(...steps)
    }
    return { engineSteps: allEngineSteps }
  }

  // 纯 check_text：已在 text_check 中处理，无 engine steps
  if (intent.action === 'check_text') {
    return { engineSteps: [] }
  }

  // 普通动作
  const engineSteps = convertToEngineSteps(intent, null, availableTools)
  return { engineSteps }
}
