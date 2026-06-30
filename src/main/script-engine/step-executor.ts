import { adbExec } from './adb-executor'
import type { EngineStep, ExecutionContext, StepResult } from './types'
import type { IntentResult } from '../common/types'
import { ScriptEngineError, ErrorCode } from './errors'
import { findElementByUiAutomator } from './uiautomator-service'
import { loadConfig } from '../config'
import { createParseGraph } from '../ai-agent/graph'
import { captureScreenshot } from '../ai-agent/tools/screenshot'
import { checkScreenText } from '../ai-agent/tools/text-check'
import { checkTextWithVLM } from '../ai-agent/services/vlm-service'
import { convertToEngineSteps } from '../ai-agent/tools/step-converter'

// =============================================================================
// Context 工具函数
// =============================================================================

/** 解析 {{key}} 模板，将 data 中所有字符串值替换为 context 中的值 */
export function resolveTemplates(data: Record<string, any>, context: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, name) => context[name] ?? `{{${name}}}`
      )
    } else {
      result[key] = value
    }
  }
  return result
}

/** 检查前置条件 */
function checkCondition(
  condition: { key: string; value: string; onMatch: 'skip' | 'stop' } | undefined,
  resolvedData: Record<string, any>,
  context: Record<string, string>,
): { matched: boolean; action: 'skip' | 'stop' | null } {
  if (!condition) return { matched: false, action: null }
  const key = condition.key
  const targetValue = condition.value
  const actualValue = context[key]
  const matched = actualValue === targetValue
  if (matched) {
    console.log(`[Context] 条件匹配: context["${key}"]="${actualValue}" === "${targetValue}" → ${condition.onMatch}`)
    return { matched: true, action: condition.onMatch }
  }
  return { matched: false, action: null }
}

/** 写入 Context */
function applyContextOutput(
  ctxOutput: { key: string; value: string } | undefined,
  resolvedData: Record<string, any>,
  context: Record<string, string>,
): void {
  if (!ctxOutput) return
  const key = ctxOutput.key
  const value = ctxOutput.value
  if (key) {
    context[key] = value
    console.log(`[Context] 写入: context["${key}"] = "${value}"`)
  }
}

/** 步骤执行器 — 通过 adb shell 直接执行命令，不依赖 screen-mirror */
export class StepExecutor {
  async execute(step: EngineStep, context: ExecutionContext): Promise<StepResult> {
    const start = Date.now()

    // 1. 解析模板
    const resolvedData = resolveTemplates(step.data, context.context)

    // 2. 检查前置条件
    const condition = resolvedData._condition as { key: string; value: string; onMatch: 'skip' | 'stop' } | undefined
    const condResult = checkCondition(condition, resolvedData, context.context)
    if (condResult.matched) {
      const duration = Date.now() - start
      if (condResult.action === 'stop') {
        return { success: false, stepIndex: context.currentIndex, error: `条件匹配: 脚本已停止`, duration }
      }
      // skip: 记录跳过并返回成功
      console.log(`[StepExecutor] ⏭ 跳过步骤 #${context.currentIndex}: ${step.type}`)
      return { success: true, stepIndex: context.currentIndex, duration }
    }

    const name = step.data?.name || step.data?.description || ''
    const stepLabel = name ? `${step.type} (${name})` : step.type
    const stepDesc = `${stepLabel} ${JSON.stringify(resolvedData).slice(0, 80)}`
    console.log(`[StepExecutor] ▶ 执行步骤 #${context.currentIndex}: ${stepDesc}`)
    try {
      switch (step.type) {
        case 'click':
          await this.executeClick(resolvedData, context.serial)
          break
        case 'type':
          await this.executeType(resolvedData, context.serial)
          break
        case 'swipe':
          await this.executeSwipe(resolvedData, context.serial)
          break
        case 'longpress':
          await this.executeLongPress(resolvedData, context.serial)
          break
        case 'home':
          await this.executeHome(context.serial)
          break
        case 'wait':
          await this.executeWait(resolvedData)
          break
        case 'ai':
          await this.executeAi(resolvedData, context)
          break
        case 'openApp':
          await this.executeOpenApp(resolvedData, context.serial)
          break
        case 'checkText':
          await this.executeCheckText(resolvedData, context)
          break
        case 'visionClick':
          await this.executeVisionClick(resolvedData, context.serial)
          break
        default:
          throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `不支持的步骤类型: ${step.type}`)
      }

      // 3. 写入 Context
      const ctxOutput = resolvedData._context as { key: string; value: string } | undefined
      applyContextOutput(ctxOutput, resolvedData, context.context)

      const duration = Date.now() - start
      console.log(`[StepExecutor] ✔ 步骤 #${context.currentIndex} 完成 (${duration}ms): ${stepDesc}`)
      return { success: true, stepIndex: context.currentIndex, duration }
    } catch (err: any) {
      const duration = Date.now() - start
      console.log(`[StepExecutor] ✘ 步骤 #${context.currentIndex} 失败 (${duration}ms): ${err.message}`)
      return {
        success: false,
        stepIndex: context.currentIndex,
        error: err.message || '执行失败',
        duration,
      }
    }
  }

  private async executeClick(data: Record<string, any>, serial: string): Promise<void> {
    // 支持 keyEvent（如 KEYCODE_HOME / KEYCODE_BACK）
    if (data.keyEvent) {
      await adbExec.keyEvent(serial, data.keyEvent)
      return
    }
    const x = Number(data.x)
    const y = Number(data.y)
    if (isNaN(x) || isNaN(y)) {
      throw new ScriptEngineError(ErrorCode.COORD_OUT_OF_RANGE, '点击坐标无效')
    }
    await adbExec.tap(serial, x, y)
  }

  private async executeType(data: Record<string, any>, serial: string): Promise<void> {
    const content = String(data.content || '')
    if (!content) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, '输入内容为空')
    }
    await adbExec.type(serial, content)
  }

  private async executeSwipe(data: Record<string, any>, serial: string): Promise<void> {
    const direction = data.direction as string
    const distance = Number(data.distance) || 0
    // duration 从 UI 来的是秒（如 1.2），转为毫秒
    const durationMs = Math.round((Number(data.duration) || 0.4) * 1000)

    // 获取设备实际分辨率计算中心点和滑动距离
    const { width: dw, height: dh } = await adbExec.getResolution(serial)
    const centerX = Math.round(dw / 2)
    const centerY = Math.round(dh / 2)
    const defaultDist = Math.round(Math.min(dw, dh) * 0.3)
    const d = distance || defaultDist

    let x1: number, y1: number, x2: number, y2: number

    switch (direction) {
      case 'up':
        x1 = centerX; y1 = Math.min(centerY + d, dh)
        x2 = centerX; y2 = Math.max(centerY - d, 0)
        break
      case 'down':
        x1 = centerX; y1 = Math.max(centerY - d, 0)
        x2 = centerX; y2 = Math.min(centerY + d, dh)
        break
      case 'left':
        x1 = Math.min(centerX + d, dw); y1 = centerY
        x2 = Math.max(centerX - d, 0); y2 = centerY
        break
      case 'right':
        x1 = Math.max(centerX - d, 0); y1 = centerY
        x2 = Math.min(centerX + d, dw); y2 = centerY
        break
      default:
        throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `不支持的方向: ${direction}`)
    }

    await adbExec.swipe(serial, x1, y1, x2, y2, durationMs)
  }

  private async executeLongPress(data: Record<string, any>, serial: string): Promise<void> {
    const x = Number(data.x)
    const y = Number(data.y)
    if (isNaN(x) || isNaN(y)) {
      throw new ScriptEngineError(ErrorCode.COORD_OUT_OF_RANGE, '长按坐标无效')
    }
    // duration 从 UI 来的是秒，转为毫秒
    const durationMs = Math.round((Number(data.duration) || 1) * 1000)
    await adbExec.longPress(serial, x, y, durationMs)
  }

  /** 执行回主屏幕操作 */
  private async executeHome(serial: string): Promise<void> {
    await adbExec.keyEvent(serial, 'KEYCODE_HOME')
  }

  /** 执行等待步骤 — 通过延时等待指定时长 */
  private async executeWait(data: Record<string, any>): Promise<void> {
    const durationSec = Number(data.duration) || 0
    if (durationSec <= 0) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, '等待时长必须大于 0')
    }

    const durationMs = Math.round(durationSec * 1000)
    console.log(`[StepExecutor] ⏳ 等待 ${durationSec} 秒...`)

    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs)
    })

    console.log(`[StepExecutor] ✔ 等待完成 (${durationSec} 秒)`)
  }

  /** 执行 AI 步骤 — 通过 ai-agent 子图解析 → 转为 engine steps → 逐条执行（含运行时check_text检查点） */
  private async executeAi(data: Record<string, any>, context: ExecutionContext): Promise<void> {
    const description = String(data.description || '')
    if (!description) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, 'AI 执行描述不能为空')
    }

    const parseGraph = createParseGraph()
    const parseState: any = {
      userInput: description,
      deviceSerial: context.serial,
      deviceResolution: { width: 1080, height: 2400 },
      intent: null,
      availableTools: [],
      engineSteps: [],
    }

    const { engineSteps: subSteps } = await parseGraph.invoke(parseState)

    if (!subSteps || subSteps.length === 0) return

    const config = loadConfig()
    const stepInterval = config.stepInterval || 3
    const mutableSteps = [...subSteps]

    console.log(`[StepExecutor] AI 步骤展开: ${mutableSteps.length} 个子步骤`)

    let i = 0
    while (i < mutableSteps.length) {
      const step = mutableSteps[i]
      context.currentIndex = i

      // ── check_text 检查点：运行时截图 + VLM 判断 ──
      if (step.data?._checkpoint) {
        const target = step.data.checkTarget
        const checkMode = step.data.checkMode || 'text'
        const ifMatched = step.data.ifMatched as IntentResult[] | undefined
        const ifNotMatched = step.data.ifNotMatched as IntentResult[] | undefined
        console.log(`[StepExecutor]   ▶ 检查点: 检测 "${target}" (ifMatched=${ifMatched?.length ?? 0}, ifNotMatched=${ifNotMatched?.length ?? 0})`)

        // 实时截图
        const screenshot = await captureScreenshot(context.serial)
        // 调用 VLM
        const screenCheckResult = await checkScreenText(screenshot.base64, target, checkMode)
        console.log(`[StepExecutor]     检测结果: matched=${screenCheckResult.matched}`)

        // 选择分支注入
        const branchSteps: EngineStep[] = []
        const tools = step.data._availableTools as any[] | undefined
        if (screenCheckResult.matched && ifMatched) {
          console.log(`[StepExecutor]     ↪ 展开 ifMatched 分支`)
          for (const sub of ifMatched) branchSteps.push(...convertToEngineSteps(sub, null, tools))
        } else if (!screenCheckResult.matched && ifNotMatched) {
          console.log(`[StepExecutor]     ↪ 展开 ifNotMatched 分支`)
          for (const sub of ifNotMatched) branchSteps.push(...convertToEngineSteps(sub, null, tools))
        }

        if (branchSteps.length > 0) {
          mutableSteps.splice(i + 1, 0, ...branchSteps)
        }
        mutableSteps.splice(i, 1) // 移除检查点
        continue
      }

      // ── 正常执行 ──
      const result = await this.execute(step, context)
      if (!result.success) {
        throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `AI 子步骤失败: ${result.error}`)
      }
      i++

      if (i < mutableSteps.length && stepInterval > 0 && !mutableSteps[i]?.data?._checkpoint) {
        await new Promise((r) => setTimeout(r, stepInterval * 1000))
      }
    }
  }

  /** 执行打开App操作 — 先回主屏幕 → 逐页扫描找到应用图标并点击 */
  private async executeOpenApp(data: Record<string, any>, serial: string): Promise<void> {
    const appName = String(data.appName || '')
    if (!appName) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, '应用名称不能为空')
    }

    // 先回主屏幕
    await adbExec.keyEvent(serial, 'KEYCODE_HOME')
    await new Promise((r) => setTimeout(r, 800))

    const { width: dw, height: dh } = await adbExec.getResolution(serial)
    const config = loadConfig()
    const maxPages = config.aiAgent?.workflow?.appScanPages ?? 3
    const centerX = Math.round(dw / 2)
    const centerY = Math.round(dh / 2)
    const swipeDist = Math.round(dw * 0.4)

    // 辅助：滑动并等待
    const swipeLeft = () => adbExec.swipe(serial, centerX, centerY, centerX - swipeDist, centerY, 300)
    const swipeRight = () => adbExec.swipe(serial, centerX, centerY, centerX + swipeDist, centerY, 300)
    const searchApp = async (): Promise<boolean> => {
      const result = await findElementByUiAutomator(serial, appName, dw, dh)
      if (result.elements && result.elements.length > 0) {
        await adbExec.tap(serial, result.elements[0].center.x, result.elements[0].center.y)
        return true
      }
      return false
    }
    const delay = () => new Promise((r) => setTimeout(r, 1000))

    // 1. 从首页开始，先查找当前页
    if (await searchApp()) return

    // 2. 左滑查找右侧页面（每滑一次查一次）
    for (let i = 0; i < maxPages; i++) {
      await swipeLeft()
      await delay()
      if (await searchApp()) return
    }

    // 3. 右滑查找左侧页面（每滑一次查一次）
    for (let i = 0; i < maxPages; i++) {
      await swipeRight()
      await delay()
      if (await searchApp()) return
    }

    // 4. 原路返回首页：左滑 N 次
    for (let i = 0; i < maxPages; i++) {
      await swipeLeft()
      await delay()
    }

    throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `未找到应用 "${appName}"`)
  }

  /** 执行图像识别点击 — 截图 → VLM 定位元素 → 点击 */
  private async executeVisionClick(data: Record<string, any>, serial: string): Promise<void> {
    const target = String(data.target || '')
    if (!target) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, '目标描述不能为空')
    }

    console.log(`[StepExecutor]   ▶ 图像识别点击: "${target}"`)

    // 1. 截图
    const screenshot = await captureScreenshot(serial)
    const { originalWidth, originalHeight } = screenshot

    // 2. 调用 VLM 定位元素（归一化坐标）
    const vlmPrompt = `在屏幕截图中找到"${target}"的位置。只返回JSON：如果找到返回{"found":true,"x":归一化X,"y":归一化Y}（归一化坐标范围0~1，x=0是左边缘，y=0是上边缘），否则返回{"found":false}。不要解释。`
    const raw = await checkTextWithVLM(screenshot.base64, vlmPrompt)
    const m = raw.match(/\{[\s\S]*?\}/)
    if (!m) throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `VLM 未返回有效坐标`)

    const r = JSON.parse(m[0])
    if (!r.found || typeof r.x !== 'number' || typeof r.y !== 'number') {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `未在屏幕上找到 "${target}"`)
    }

    // 3. 归一化坐标 → 设备坐标
    const deviceX = Math.round(r.x * originalWidth)
    const deviceY = Math.round(r.y * originalHeight)
    console.log(`[StepExecutor]     识别结果: 归一化(${r.x}, ${r.y}) → 设备(${deviceX}, ${deviceY})`)

    // 4. 点击
    await adbExec.tap(serial, deviceX, deviceY)
  }

  /** 执行屏幕文本检测 — 截图 → VLM 检测 → 匹配时写入上下文 */
  private async executeCheckText(data: Record<string, any>, context: ExecutionContext): Promise<void> {
    const target = String(data.text || '')
    if (!target) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, '检测文本不能为空')
    }

    console.log(`[StepExecutor]   ▶ 屏幕文本检测: "${target}"`)

    // 1. 截图
    const screenshot = await captureScreenshot(context.serial)

    // 2. 调用 VLM 检测文本
    const screenCheckResult = await checkScreenText(screenshot.base64, target, 'text')
    console.log(`[StepExecutor]     检测结果: matched=${screenCheckResult.matched}, desc="${screenCheckResult.description}"`)

    // 3. 未匹配时清空 _context，阻止后续通用写入
    if (!screenCheckResult.matched) {
      delete data._context
      console.log(`[StepExecutor]     文本未匹配，跳过上下文写入`)
    }
  }
}
