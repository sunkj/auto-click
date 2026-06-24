import { BrowserWindow } from 'electron'
import { ScriptService } from '../script/services/script-service'
import { ScriptLoader } from './script-loader'
import { ScriptValidator } from './script-validator'
import { StepExecutor } from './step-executor'
import { ExecutionQueue } from './execution-queue'
import { createExecutionContext } from './execution-context'
import { ScriptEngineError, ErrorCode } from './errors'
import { adbExec } from './adb-executor'
import type {
  ExecutionResult,
  ExecutionStatus,
  StepProgressEvent,
  EngineStep,
  ExecutionContext,
  PendingTask,
} from './types'

/** Script 执行引擎通道 */
export const ENGINE_IPC = {
  STEP_START: 'engine:stepStart',
  STEP_END: 'engine:stepEnd',
  STEP_ERROR: 'engine:stepError',
  COMPLETE: 'engine:complete',
}

/** 脚本执行引擎核心类 */
export class ScriptEngine {
  private scriptLoader: ScriptLoader
  private validator: ScriptValidator
  private stepExecutor: StepExecutor
  private queue: ExecutionQueue
  private shouldStop = false

  constructor(scriptService: ScriptService) {
    this.scriptLoader = new ScriptLoader(scriptService)
    this.validator = new ScriptValidator()
    this.stepExecutor = new StepExecutor()
    this.queue = new ExecutionQueue()
  }

  /** 全量执行脚本 */
  async runFullScript(scriptId: string, serial: string): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        scriptId,
        serial,
        mode: 'full',
        resolve,
        reject,
      })
      this.executeNext()
    })
  }

  /** 单步执行 */
  async runSingleStep(scriptId: string, stepIndex: number, serial: string): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        scriptId,
        serial,
        mode: 'single',
        stepIndex,
        resolve,
        reject,
      })
      this.executeNext()
    })
  }

  /** 停止执行 */
  stopExecution(): void {
    this.shouldStop = true
    this.queue.stopCurrent()
  }

  /** 获取状态 */
  getStatus(): ExecutionStatus {
    return this.queue.getStatus()
  }

  private async executeNext(): Promise<void> {
    this.shouldStop = false

    try {
      const task = this.getCurrentTask()
      if (!task) return

      const { scriptId, serial, mode, stepIndex } = task

      // 0. 预取设备分辨率 + 加载配置
      adbExec.getResolution(serial).catch(() => {})
      const { loadConfig } = await import('../config')
      const config = loadConfig()
      const stepInterval = config.stepInterval || 0
      const scriptTimeout = config.scriptTimeout || 0
      const maxRetries = config.maxRetries || 0

      // 1. 加载脚本
      const scriptObj = await this.scriptLoader.load(scriptId)

      // 2. 校验
      this.validator.validate(scriptObj)

      // 3. 确定要执行的步骤列表
      let stepsToRun: EngineStep[]
      if (mode === 'single' && stepIndex !== undefined) {
        const step = scriptObj.steps[stepIndex]
        if (!step) throw new ScriptEngineError(ErrorCode.SCRIPT_FORMAT_ERROR, `步骤 ${stepIndex} 不存在`)
        stepsToRun = [step]
      } else {
        stepsToRun = scriptObj.steps
      }

      // 4. 创建上下文
      const ctx = createExecutionContext(scriptId, serial, stepsToRun, stepInterval)

      // 5. 顺序执行
      const totalSteps = stepsToRun.length
      let completedSteps = 0
      const startTime = Date.now()

      for (let i = 0; i < totalSteps; i++) {
        // 检查超时
        if (scriptTimeout > 0 && Date.now() - startTime > scriptTimeout * 1000) {
          this.sendProgress({ scriptId, stepIndex: ctx.currentIndex, totalSteps, status: 'error', error: '脚本执行超时' })
          this.queue.complete({
            success: false, scriptId, totalSteps, completedSteps,
            duration: Date.now() - startTime, error: '脚本执行超时',
          })
          this.executeNext()
          return
        }

        if (this.shouldStop) {
          this.queue.complete({
            success: false, scriptId, totalSteps, completedSteps,
            duration: Date.now() - startTime, error: '执行已停止',
          })
          this.executeNext()
          return
        }

        ctx.currentIndex = mode === 'single' ? (stepIndex ?? 0) : i

        // 发送 step-start
        this.sendProgress({ scriptId, stepIndex: ctx.currentIndex, totalSteps, status: 'start' })

        // 执行步骤（带重试）
        let result = await this.stepExecutor.execute(stepsToRun[i], ctx)
        for (let retry = 0; retry < maxRetries && !result.success; retry++) {
          this.sendProgress({ scriptId, stepIndex: ctx.currentIndex, totalSteps, status: 'start' })
          result = await this.stepExecutor.execute(stepsToRun[i], ctx)
        }

        if (!result.success) {
          this.sendProgress({ scriptId, stepIndex: ctx.currentIndex, totalSteps, status: 'error', error: result.error })
          this.queue.complete({
            success: false, scriptId, totalSteps, completedSteps,
            duration: Date.now() - startTime, error: result.error,
          })
          this.executeNext()
          return
        }

        completedSteps++
        this.sendProgress({ scriptId, stepIndex: ctx.currentIndex, totalSteps, status: 'end' })

        // 步骤间延迟（优先步骤级 delay，其次配置的 stepInterval）
        if (i < totalSteps - 1) {
          const delay = stepsToRun[i].delay ?? stepInterval
          if (delay > 0) await this.sleep(delay * 1000)
        }
      }

      // 完成
      this.queue.complete({
        success: true,
        scriptId,
        totalSteps,
        completedSteps,
        duration: Date.now() - startTime,
      })
      this.sendProgress({ scriptId, stepIndex: -1, totalSteps, status: 'end' })
      // 处理队列中下一个任务
      this.executeNext()
    } catch (err: any) {
      const result: ExecutionResult = {
        success: false,
        scriptId: '',
        totalSteps: 0,
        completedSteps: 0,
        duration: 0,
        error: err.message || '执行失败',
      }
      this.queue.complete(result)
      this.executeNext()
    }
  }

  private getCurrentTask(): PendingTask | null {
    return this.queue.currentTask
  }

  private sendProgress(event: StepProgressEvent): void {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send(ENGINE_IPC.STEP_START, event),
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
