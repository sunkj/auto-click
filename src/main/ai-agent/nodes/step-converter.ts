import type { AgentState } from '../types'
import { convertToEngineSteps } from '../tools/step-converter'

/**
 * 步骤转换节点
 *
 * 将 AI 解析结果（IntentResult + CalibratedCoord）映射为 ScriptEngine 的 EngineStep[]。
 */
export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, calibratedCoords, availableTools } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法转换步骤')
  }

  const engineSteps = convertToEngineSteps(intent, calibratedCoords, availableTools)

  return { engineSteps }
}
