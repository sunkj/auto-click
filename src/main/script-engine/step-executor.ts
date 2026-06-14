import { adbExec } from './adb-executor'
import type { EngineStep, ExecutionContext, StepResult } from './types'
import { ScriptEngineError, ErrorCode } from './errors'

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
}
