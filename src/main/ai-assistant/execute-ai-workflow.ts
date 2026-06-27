import type { EngineStep } from '../common/types'
import { createParseGraph } from '../ai-agent/graph'
import { StepExecutor } from '../script-engine/step-executor'
import { createExecutionContext } from '../script-engine/execution-context'
import { loadConfig } from '../config'

const stepExecutor = new StepExecutor()

export interface AiWorkflowResult {
  success: boolean
  engineSteps: EngineStep[]
  stepResults?: Array<{ success: boolean; error?: string; duration: number }>
  error?: string
  duration: number
  description?: string
}

/**
 * 执行 AI 工作流
 *
 * 1. 调用 parseGraph 解析意图 → 转换为 engine steps
 * 2. 逐条执行 steps
 * 3. 返回执行结果
 */
export async function executeAiWorkflow(
  userInput: string,
  deviceSerial: string,
): Promise<AiWorkflowResult> {
  const parseGraph = createParseGraph()

  const parseState: any = {
    userInput,
    deviceSerial,
    deviceResolution: { width: 1080, height: 2400 },
    intent: null,
    availableTools: [],
    screenshotBase64: null,
    screenCheckResult: null,
    engineSteps: [],
  }

  const { engineSteps, screenCheckResult } = await parseGraph.invoke(parseState)

  // 纯 check_text（无其他步骤）返回检测结果
  if (screenCheckResult && (!engineSteps || engineSteps.length === 0)) {
    return {
      success: screenCheckResult.matched,
      description: screenCheckResult.description,
      engineSteps: [],
      duration: 0,
    }
  }

  if (!engineSteps || engineSteps.length === 0) {
    return { success: true, engineSteps: [], duration: 0 }
  }

  // 执行 steps
  const config = loadConfig()
  const stepInterval = config.stepInterval || 3
  const maxRetries = config.maxRetries || 0
  const ctx = createExecutionContext(`ai-${Date.now()}`, deviceSerial, engineSteps, stepInterval)
  const stepResults: Array<{ success: boolean; error?: string; duration: number }> = []
  const startTime = Date.now()

  for (let i = 0; i < engineSteps.length; i++) {
    ctx.currentIndex = i

    let result = await stepExecutor.execute(engineSteps[i], ctx as any)
    for (let retry = 0; retry < maxRetries && !result.success; retry++) {
      result = await stepExecutor.execute(engineSteps[i], ctx as any)
    }

    stepResults.push({
      success: result.success,
      error: result.error,
      duration: result.duration,
    })

    if (!result.success) {
      return {
        success: false,
        engineSteps,
        stepResults,
        error: result.error || '步骤执行失败',
        duration: Date.now() - startTime,
      }
    }

    if (i < engineSteps.length - 1 && stepInterval > 0) {
      await new Promise((r) => setTimeout(r, stepInterval * 1000))
    }
  }

  return {
    success: true,
    engineSteps,
    stepResults,
    duration: Date.now() - startTime,
  }
}
