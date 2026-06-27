import { adbExec } from './adb-executor'
import type { EngineStep, ExecutionContext, StepResult } from './types'
import { ScriptEngineError, ErrorCode } from './errors'
import { findElementByUiAutomator } from './uiautomator-service'
import { loadConfig } from '../config'
import { createParseGraph } from '../ai-agent/graph'

/** 步骤执行器 — 通过 adb shell 直接执行命令，不依赖 screen-mirror */
export class StepExecutor {
  async execute(step: EngineStep, context: ExecutionContext): Promise<StepResult> {
    const start = Date.now()
    try {
      switch (step.type) {
        case 'click':
          await this.executeClick(step.data, context.serial)
          break
        case 'type':
          await this.executeType(step.data, context.serial)
          break
        case 'swipe':
          await this.executeSwipe(step.data, context.serial)
          break
        case 'longpress':
          await this.executeLongPress(step.data, context.serial)
          break
        case 'home':
          await this.executeHome(context.serial)
          break
        case 'ai':
          await this.executeAi(step.data, context)
          break
        case 'openApp':
          await this.executeOpenApp(step.data, context.serial)
          break
        default:
          throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `不支持的步骤类型: ${step.type}`)
      }
      return { success: true, stepIndex: context.currentIndex, duration: Date.now() - start }
    } catch (err: any) {
      return {
        success: false,
        stepIndex: context.currentIndex,
        error: err.message || '执行失败',
        duration: Date.now() - start,
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

  /** 执行 AI 步骤 — 通过 ai-agent 子图解析 → 转为 engine steps → 逐条执行 */
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
      screenshotBase64: null,
      screenCheckResult: null,
      engineSteps: [],
    }

    const { engineSteps: subSteps } = await parseGraph.invoke(parseState)

    if (!subSteps || subSteps.length === 0) return

    const config = loadConfig()
    const stepInterval = config.stepInterval || 3

    for (let i = 0; i < subSteps.length; i++) {
      const result = await this.execute(subSteps[i], context)
      if (!result.success) {
        throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `AI 子步骤失败: ${result.error}`)
      }
      if (i < subSteps.length - 1 && stepInterval > 0) {
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
}
