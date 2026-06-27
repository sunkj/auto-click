import type { AgentState } from '../../common/types'
import { convertToEngineSteps } from '../tools/step-converter'

export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, availableTools, screenCheckResult } = state
  if (!intent) throw new Error('缺少意图数据')

  if (intent.action === 'check_text') return { engineSteps: [] }

  if (intent.action === 'sequence' && intent.params?.steps) {
    const allEngineSteps: any[] = []
    const subSteps = intent.params.steps

    for (let i = 0; i < subSteps.length; i++) {
      const subIntent = subSteps[i]

      // check_text → 条件分支处理（使用 ifMatched / ifNotMatched）
      if (subIntent.action === 'check_text') {
        const ifMatched = subIntent.params?.ifMatched
        const ifNotMatched = subIntent.params?.ifNotMatched

        if (screenCheckResult?.matched) {
          console.log(`[步骤转换] check_text 匹配，展开 ifMatched 分支 (${ifMatched?.length || 0} 步)`)
          if (ifMatched) {
            for (const s of ifMatched) {
              allEngineSteps.push(...convertToEngineSteps(s, null, availableTools))
            }
          }
        } else {
          console.log(`[步骤转换] check_text 不匹配，展开 ifNotMatched 分支 (${ifNotMatched?.length || 0} 步)`)
          if (ifNotMatched) {
            for (const s of ifNotMatched) {
              allEngineSteps.push(...convertToEngineSteps(s, null, availableTools))
            }
          }
        }
        continue // 跳过 check_text 本身
      }

      const steps = convertToEngineSteps(subIntent, null, availableTools)
      allEngineSteps.push(...steps)
    }
    return { engineSteps: allEngineSteps }
  }

  const engineSteps = convertToEngineSteps(intent, null, availableTools)
  return { engineSteps }
}
