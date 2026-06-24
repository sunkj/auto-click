import type { AgentState, EngineExecutionResult, StepResultItem } from '../types'
import type { EngineStep } from '../../script-engine/types'
import { StepExecutor } from '../../script-engine/step-executor'
import { createExecutionContext } from '../../script-engine/execution-context'
import { loadConfig } from '../../config'

const stepExecutor = new StepExecutor()

/**
 * 引擎执行节点
 *
 * 调用 StepExecutor 执行转换后的 EngineStep[]，返回执行结果。
 * 不经过 ScriptEngine.runFullScript 的数据库加载流程，
 * 直接使用 StepExecutor 逐条执行。
 */
export async function scriptEngineExecutorNode(state: AgentState): Promise<Partial<AgentState>> {
  const { engineSteps, deviceSerial } = state

  if (!engineSteps || engineSteps.length === 0) {
    throw new Error('没有可执行的步骤')
  }

  console.log('[AiAgent] 开始执行步骤:', JSON.stringify(engineSteps), '设备:', deviceSerial)

  const config = loadConfig()
  const scriptId = `ai-agent-${Date.now()}`
  const stepInterval = config.stepInterval || 0
  const maxRetries = config.maxRetries || 0

  const ctx = createExecutionContext(scriptId, deviceSerial, engineSteps, stepInterval)
  const totalSteps = engineSteps.length
  let completedSteps = 0
  const startTime = Date.now()
  const stepResults: StepResultItem[] = []

  for (let i = 0; i < totalSteps; i++) {
    ctx.currentIndex = i

    // 执行步骤（带重试）
    let result = await stepExecutor.execute(engineSteps[i], ctx as any)
    for (let retry = 0; retry < maxRetries && !result.success; retry++) {
      result = await stepExecutor.execute(engineSteps[i], ctx as any)
    }

    stepResults.push({
      index: i,
      success: result.success,
      error: result.error,
      duration: result.duration,
    })

    if (!result.success) {
      return {
        result: {
          success: false,
          totalSteps,
          completedSteps,
          duration: Date.now() - startTime,
          error: result.error || '步骤执行失败',
          stepResults,
        },
      }
    }

    completedSteps++

    // 步骤间延迟
    if (i < totalSteps - 1) {
      const delay = engineSteps[i].delay ?? stepInterval
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay * 1000))
      }
    }
  }

  const executionResult: EngineExecutionResult = {
    success: true,
    totalSteps,
    completedSteps,
    duration: Date.now() - startTime,
    stepResults,
  }

  return { result: executionResult }
}
