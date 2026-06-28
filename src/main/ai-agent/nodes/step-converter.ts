import type { AgentState } from '../../common/types'
import { convertToEngineSteps } from '../tools/step-converter'

/**
 * 约束规范：check_text 不能平级后跟 call_tool。
 * call_tool 必须嵌套在 check_text 的 ifMatched/ifNotMatched 内部。
 * 如果 LLM 违规输出平级结构，或同时输出嵌套+平级重复，系统自动修正。
 */
function enforceCheckTextConstraint(steps: any[]): any[] {
  const result: any[] = []
  let i = 0
  while (i < steps.length) {
    const step = steps[i]

    if (step.action === 'check_text') {
      // 收集已嵌套在分支中的 call_tool target，用于去重
      const branchTargets = new Set<string>()
      const ifMatched = step.params?.ifMatched
      const ifNotMatched = step.params?.ifNotMatched
      if (ifMatched) for (const s of ifMatched) if (s.action === 'call_tool') branchTargets.add(s.target)
      if (ifNotMatched) for (const s of ifNotMatched) if (s.action === 'call_tool') branchTargets.add(s.target)

      // 如果没有嵌套分支，尝试从后续步骤中自动提取
      if (!ifMatched && !ifNotMatched) {
        const next = steps[i + 1]
        const nextNext = steps[i + 2]
        const hasNextTool = next?.action === 'call_tool'
        const hasNextNextTool = nextNext?.action === 'call_tool'

        if (hasNextTool || hasNextNextTool) {
          step.params = {
            ...step.params,
            ifMatched: hasNextTool ? [next] : undefined,
            ifNotMatched: hasNextNextTool ? [nextNext] : undefined,
          }
          if (hasNextTool) { branchTargets.add(next.target); i++ }
          if (hasNextNextTool) { branchTargets.add(nextNext.target); i++ }
          console.log(`[约束规范] check_text 违规平级 → 自动修正`)
        }
      }

      result.push(step)
      i++

      // 跳过后续与分支重复的 call_tool（LLM 常犯的重复错误）
      while (i < steps.length) {
        const next = steps[i]
        if (next.action === 'call_tool' && branchTargets.has(next.target)) {
          console.log(`[约束规范] 跳过重复 call_tool: ${next.target}`)
          i++
        } else {
          break
        }
      }
    } else {
      result.push(step)
      i++
    }
  }
  return result
}

export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, availableTools } = state
  if (!intent) throw new Error('缺少意图数据')

  if (intent.action === 'check_text') {
    const steps = convertToEngineSteps(intent, null, availableTools)
    return { engineSteps: steps }
  }

  if (intent.action === 'sequence' && intent.params?.steps) {
    // 先应用约束规范，修正 LLM 违规输出
    const corrected = enforceCheckTextConstraint(intent.params.steps)

    const allEngineSteps: any[] = []
    for (const subIntent of corrected) {
      const steps = convertToEngineSteps(subIntent, null, availableTools)
      allEngineSteps.push(...steps)
    }
    return { engineSteps: allEngineSteps }
  }

  const engineSteps = convertToEngineSteps(intent, null, availableTools)
  return { engineSteps }
}
