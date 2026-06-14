import type { PendingTask, ExecutionResult, ExecutionStatus } from './types'

/** 执行队列管理器 — 处理并发请求（FIFO） */
export class ExecutionQueue {
  private pendingTasks: PendingTask[] = []
  currentTask: PendingTask | null = null
  private isRunning = false

  /** 加入队列 */
  enqueue(task: PendingTask): void {
    if (!this.isRunning) {
      this.isRunning = true
      this.currentTask = task
      return
    }
    this.pendingTasks.push(task)
  }

  /** 当前任务完成 */
  complete(result: ExecutionResult): void {
    const task = this.currentTask
    this.currentTask = null
    if (task) task.resolve(result)
    this.dequeue()
  }

  /** 当前任务失败 */
  fail(error: Error): void {
    const task = this.currentTask
    this.currentTask = null
    if (task) task.reject(error)
    this.dequeue()
  }

  /** 停止当前执行并清空队列 */
  stopCurrent(): void {
    this.isRunning = false
    this.currentTask = null
    const pending = [...this.pendingTasks]
    this.pendingTasks = []
    const err = new Error('执行已被用户停止')
    pending.forEach((t) => t.reject(err))
  }

  /** 清空队列 */
  clear(): void {
    this.pendingTasks = []
  }

  /** 获取当前执行状态 */
  getStatus(): ExecutionStatus {
    return {
      isExecuting: this.currentTask !== null,
      currentScriptId: this.currentTask?.scriptId || null,
      currentStepIndex: 0,
      totalSteps: 0,
    }
  }

  private dequeue(): void {
    if (this.pendingTasks.length > 0) {
      this.currentTask = this.pendingTasks.shift()!
    } else {
      this.isRunning = false
    }
  }
}
