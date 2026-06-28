import type { EngineStep, IntentResult } from '../common/types'
import { createParseGraph } from '../ai-agent/graph'
import { StepExecutor } from '../script-engine/step-executor'
import { createExecutionContext } from '../script-engine/execution-context'
import { loadConfig } from '../config'
import { captureScreenshot } from '../ai-agent/tools/screenshot'
import { checkScreenText } from '../ai-agent/tools/text-check'
import { convertToEngineSteps } from '../ai-agent/tools/step-converter'

const stepExecutor = new StepExecutor()

export interface AiWorkflowResult {
  success: boolean
  engineSteps: EngineStep[]
  stepResults?: Array<{ success: boolean; error?: string; duration: number }>
  error?: string
  duration: number
  description?: string
}

/** 步骤进度回调 */
export type StepProgressCallback = (description: string, index: number, total: number) => void
export type CancelCheck = () => boolean

/**
 * 执行 AI 工作流
 *
 * 1. 调用 parseGraph 解析意图 → 转换为 engine steps
 * 2. 逐条执行 steps，遇到 check_text 检查点时实时截图+调用VLM决策分支
 * 3. 返回执行结果
 */
export async function executeAiWorkflow(
  userInput: string,
  deviceSerial: string,
  onStep?: StepProgressCallback,
  isCancelled?: CancelCheck,
): Promise<AiWorkflowResult> {
  const parseGraph = createParseGraph()

  const parseState: any = {
    userInput,
    deviceSerial,
    deviceResolution: { width: 1080, height: 2400 },
    intent: null,
    availableTools: [],
    engineSteps: [],
  }

  const { engineSteps, intent } = await parseGraph.invoke(parseState)

  // 打印意图解析结果
  console.log(`[AiWorkflow] 意图解析完成:`)
  if (intent) {
    console.log(`[AiWorkflow]   action: ${intent.action}, target: ${intent.target}`)
    if (intent.params) console.log(`[AiWorkflow]   params: ${JSON.stringify(intent.params)}`)
    if (intent.action === 'sequence' && intent.params?.steps) {
      ;(intent.params.steps as IntentResult[]).forEach((s: IntentResult, i: number) => {
        console.log(`[AiWorkflow]     step ${i + 1}: ${s.action} -> ${s.target}`)
      })
    }
  }
  console.log(`[AiWorkflow] 转换结果: ${engineSteps?.length || 0} 个步骤`)

  if (!engineSteps || engineSteps.length === 0) {
    return { success: true, engineSteps: [], duration: 0 }
  }

  // 执行 steps（使用可变的步骤列表，运行时可能插入分支步骤）
  const config = loadConfig()
  const stepInterval = config.stepInterval || 3
  const maxRetries = config.maxRetries || 0
  const ctx = createExecutionContext(`ai-${Date.now()}`, deviceSerial, engineSteps, stepInterval)
  const stepResults: Array<{ success: boolean; error?: string; duration: number }> = []
  const startTime = Date.now()
  const mutableSteps = [...engineSteps]

  console.log(`[AiWorkflow] ▶ 开始执行 ${mutableSteps.length} 个步骤`)

  let i = 0
  while (i < mutableSteps.length) {
    // 检查取消
    if (isCancelled?.()) {
      console.log('[AiWorkflow] 用户取消执行')
      return {
        success: false,
        engineSteps: mutableSteps,
        stepResults,
        error: '执行已取消',
        duration: Date.now() - startTime,
      }
    }

    const step = mutableSteps[i]
    ctx.currentIndex = i

    // ── check_text 检查点：运行时截图 + VLM 判断 ──
    if (step.data?._checkpoint) {
      const target = step.data.checkTarget
      const checkMode = step.data.checkMode || 'text'
      const ifMatched = step.data.ifMatched as IntentResult[] | undefined
      const ifNotMatched = step.data.ifNotMatched as IntentResult[] | undefined
      onStep?.(`📷 检测: ${target}`, i + 1, mutableSteps.length)
      console.log(`[AiWorkflow]   ▶ 检查点 ${i + 1}/${mutableSteps.length}: 检测 "${target}"`)
      console.log(`[AiWorkflow]     ifMatched=${ifMatched?.length ?? 0} 步, ifNotMatched=${ifNotMatched?.length ?? 0} 步`)

      // 实时截图
      const screenshot = await captureScreenshot(deviceSerial)
      console.log(`[AiWorkflow]     截图完成 (${screenshot.scaledWidth}x${screenshot.scaledHeight})`)

      // 调用 VLM 检测
      const screenCheckResult = await checkScreenText(screenshot.base64, target, checkMode)
      console.log(`[AiWorkflow]     检测结果: matched=${screenCheckResult.matched}`)

      stepResults.push({
        success: true,
        duration: Date.now() - startTime,
      })

      // 选择分支
      const branchSteps: EngineStep[] = []
      const availableTools = step.data._availableTools as any[] | undefined
      if (screenCheckResult.matched && ifMatched) {
        console.log(`[AiWorkflow]     ↪ 展开 ifMatched 分支`)
        for (const subIntent of ifMatched) {
          branchSteps.push(...convertToEngineSteps(subIntent, null, availableTools))
        }
      } else if (!screenCheckResult.matched && ifNotMatched) {
        console.log(`[AiWorkflow]     ↪ 展开 ifNotMatched 分支`)
        for (const subIntent of ifNotMatched) {
          branchSteps.push(...convertToEngineSteps(subIntent, null, availableTools))
        }
      } else {
        console.log(`[AiWorkflow]     无对应分支，跳过`)
      }

      if (branchSteps.length > 0) {
        console.log(`[AiWorkflow]     ↪ 注入 ${branchSteps.length} 个分支步骤`)
        mutableSteps.splice(i + 1, 0, ...branchSteps)
      }

      // 移除检查点本身（不执行）
      mutableSteps.splice(i, 1)
      continue // 不递增 i，处理刚注入的分支步骤
    }

    // ── 正常步骤执行 ──
    const stepLabel = step.data?.description || `${step.type} ${JSON.stringify(step.data).slice(0, 50)}`
    onStep?.(stepLabel, i + 1, mutableSteps.length)
    const stepDesc = `${step.type} ${JSON.stringify(step.data).slice(0, 60)}`
    console.log(`[AiWorkflow]   ▶ 步骤 ${i + 1}/${mutableSteps.length}: ${stepDesc}`)

    let result = await stepExecutor.execute(step, ctx as any)
    for (let retry = 0; retry < maxRetries && !result.success; retry++) {
      console.log(`[AiWorkflow]   ↻ 重试步骤 ${i + 1} (第 ${retry + 1} 次)`)
      result = await stepExecutor.execute(step, ctx as any)
    }

    stepResults.push({
      success: result.success,
      error: result.error,
      duration: result.duration,
    })

    if (!result.success) {
      console.log(`[AiWorkflow] ✘ 步骤 ${i + 1}/${mutableSteps.length} 失败: ${result.error}`)
      return {
        success: false,
        engineSteps: mutableSteps,
        stepResults,
        error: result.error || '步骤执行失败',
        duration: Date.now() - startTime,
      }
    }

    console.log(`[AiWorkflow]   ✔ 步骤 ${i + 1}/${mutableSteps.length} 完成 (${result.duration}ms)`)
    i++

    // 步骤间延迟（跳过检查点后的第一个延迟，避免分支步骤前的不必要等待）
    if (i < mutableSteps.length && stepInterval > 0 && !mutableSteps[i]?.data?._checkpoint) {
      await new Promise((r) => setTimeout(r, stepInterval * 1000))
    }
  }

  const totalDuration = Date.now() - startTime
  console.log(`[AiWorkflow] ✔ 全部步骤执行完成 (${totalDuration}ms)`)
  return {
    success: true,
    engineSteps: mutableSteps,
    stepResults,
    duration: totalDuration,
  }
}
