/**
 * 定时任务调度引擎
 *
 * 使用 setTimeout 链式调度，支持按分钟/小时/天三种周期。
 * 每次执行完成后计算下次时间并注册新的定时器。
 */
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import type { ScheduleConfig } from './types'
import type { ScriptEngine } from '../script-engine/script-engine'
import { loadConfig, saveConfig } from '../config'
import { ctrl } from '../screen-mirror/control'

/** 调度器状态变更 IPC */
const SCHEDULER_STATUS_UPDATE = 'scheduler:statusUpdate'

export class SchedulerEngine {
  private timers = new Map<string, NodeJS.Timeout>()
  private scriptEngine: ScriptEngine
  /** 防止多个定时器并发的执行锁 */
  private executing = false

  constructor(scriptEngine: ScriptEngine) {
    this.scriptEngine = scriptEngine
  }

  // =========================================================================
  // 启动/停止
  // =========================================================================

  /** 启动调度器：加载配置，注册所有已启用的定时任务 */
  start(): void {
    const config = loadConfig()
    if (!config.schedulerEnabled) {
      console.log('[Scheduler] 总开关关闭，不注册定时器')
      return
    }
    const enabled = config.schedules.filter((s) => s.enabled)
    console.log(`[Scheduler] 启动，注册 ${enabled.length} 个定时任务`)
    for (const schedule of enabled) {
      this.registerTimer(schedule)
    }
  }

  /** 停止所有定时器 */
  stop(): void {
    console.log(`[Scheduler] 停止，清除 ${this.timers.size} 个定时器`)
    for (const [id, timer] of this.timers) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }

  // =========================================================================
  // 总开关
  // =========================================================================

  /** 切换总开关 */
  setEnabled(enabled: boolean): void {
    const config = loadConfig()
    config.schedulerEnabled = enabled
    saveConfig(config)

    if (enabled) {
      this.start()
    } else {
      this.stop()
    }

    // 通知渲染进程
    this.broadcastStatus()
  }

  // =========================================================================
  // CRUD
  // =========================================================================

  /** 获取所有定时任务（含总开关状态） */
  getAll(): { schedules: ScheduleConfig[]; schedulerEnabled: boolean } {
    const config = loadConfig()
    return {
      schedules: config.schedules || [],
      schedulerEnabled: config.schedulerEnabled,
    }
  }

  /** 创建定时任务 */
  create(params: {
    scriptId: string
    scriptName: string
    cycle: 'minute' | 'hour' | 'day'
    minuteInterval?: number
    hourInterval?: number
    dayTime?: string
  }): ScheduleConfig {
    const config = loadConfig()
    const schedule: ScheduleConfig = {
      id: randomUUID(),
      scriptId: params.scriptId,
      scriptName: params.scriptName,
      enabled: true,
      cycle: params.cycle,
      minuteInterval: params.minuteInterval,
      hourInterval: params.hourInterval,
      dayTime: params.dayTime,
      createdAt: Date.now(),
    }
    config.schedules = config.schedules || []
    config.schedules.push(schedule)
    saveConfig(config)

    // 如果总开关开启，注册定时器
    if (config.schedulerEnabled && schedule.enabled) {
      this.registerTimer(schedule)
    }

    this.broadcastStatus()
    return schedule
  }

  /** 更新定时任务 */
  update(id: string, updates: Partial<ScheduleConfig>): ScheduleConfig | null {
    const config = loadConfig()
    const idx = (config.schedules || []).findIndex((s) => s.id === id)
    if (idx === -1) return null

    config.schedules[idx] = { ...config.schedules[idx], ...updates }
    saveConfig(config)

    const schedule = config.schedules[idx]

    // 重启定时器
    this.removeTimer(id)
    if (config.schedulerEnabled && schedule.enabled) {
      this.registerTimer(schedule)
    }

    this.broadcastStatus()
    return schedule
  }

  /** 删除定时任务 */
  remove(id: string): boolean {
    const config = loadConfig()
    const idx = (config.schedules || []).findIndex((s) => s.id === id)
    if (idx === -1) return false

    config.schedules.splice(idx, 1)
    saveConfig(config)
    this.removeTimer(id)
    this.broadcastStatus()
    return true
  }

  /** 切换单个定时任务启停 */
  toggle(id: string, enabled: boolean): ScheduleConfig | null {
    return this.update(id, { enabled })
  }

  // =========================================================================
  // 定时器管理
  // =========================================================================

  private registerTimer(schedule: ScheduleConfig): void {
    this.removeTimer(schedule.id)

    const now = Date.now()
    let delayMs = this.calculateDelay(schedule, now)

    // 如果 delay 为负数（超过执行时间），用 1 秒避免立即触发
    if (delayMs <= 0) {
      delayMs = 1000
    }

    console.log(`[Scheduler] 注册定时任务 "${schedule.scriptName}" (${schedule.cycle}), ${Math.round(delayMs / 1000)} 秒后执行`)

    const timer = setTimeout(() => {
      this.onScheduleTrigger(schedule)
    }, delayMs)

    this.timers.set(schedule.id, timer)
  }

  private removeTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
  }

  // =========================================================================
  // 时间计算
  // =========================================================================

  private calculateDelay(schedule: ScheduleConfig, now: number): number {
    switch (schedule.cycle) {
      case 'minute':
        return (schedule.minuteInterval || 30) * 60 * 1000
      case 'hour':
        return (schedule.hourInterval || 1) * 3600 * 1000
      case 'day': {
        const [h, m] = (schedule.dayTime || '08:00').split(':').map(Number)
        const today = new Date(now)
        today.setHours(h, m, 0, 0)
        if (today.getTime() > now) {
          return today.getTime() - now
        }
        // 已过今天的时间 → 明天
        return today.getTime() + 86400000 - now
      }
      default:
        return 60000
    }
  }

  // =========================================================================
  // 执行回调
  // =========================================================================

  private async onScheduleTrigger(schedule: ScheduleConfig): Promise<void> {
    // 防止并发的定时器同时执行
    if (this.executing) {
      console.log(`[Scheduler] ⏭ 跳过定时任务 "${schedule.scriptName}": 调度器忙`)
      this.scheduleNext(schedule)
      return
    }
    this.executing = true

    try {
      // 0. 检查总开关
      const config = loadConfig()
      if (!config.schedulerEnabled) return

      // 1. 检查设备连接
      const serial = ctrl.getSerial()
      if (!serial) {
        console.log(`[Scheduler] ⏭ 跳过定时任务 "${schedule.scriptName}": 无已连接设备`)
        this.updateStatus(schedule.id, 'skipped')
        this.scheduleNext(schedule)
        return
      }

      // 2. 检查是否有脚本正在执行
      const status = this.scriptEngine.getStatus()
      if (status.isExecuting) {
        console.log(`[Scheduler] ⏭ 跳过定时任务 "${schedule.scriptName}": 已有脚本在运行`)
        this.updateStatus(schedule.id, 'skipped')
        this.scheduleNext(schedule)
        return
      }

      // 3. 通知渲染进程选中该脚本
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('scheduler:selectScript', schedule.scriptId)
      })

      // 4. 执行脚本
      console.log(`[Scheduler] ▶ 执行定时任务 "${schedule.scriptName}" (scriptId=${schedule.scriptId}, serial=${serial})`)
      try {
        const result = await this.scriptEngine.runFullScript(schedule.scriptId, serial)
        console.log(`[Scheduler] ✔ 定时任务 "${schedule.scriptName}" 完成: success=${result.success}, steps=${result.completedSteps}/${result.totalSteps}`)
        this.updateStatus(schedule.id, result.success ? 'success' : 'failed', result.error)
      } catch (err: any) {
        this.updateStatus(schedule.id, 'failed', err.message)
        console.log(`[Scheduler] ✘ 定时任务 "${schedule.scriptName}" 失败: ${err.message}`)
      }

      // 5. 注册下一次执行
      this.scheduleNext(schedule)
    } finally {
      this.executing = false
    }
  }

  private scheduleNext(schedule: ScheduleConfig): void {
    // 重新从 config 加载最新的 schedule 数据（可能被外部修改过）
    const config = loadConfig()
    const latest = (config.schedules || []).find((s) => s.id === schedule.id)
    if (!latest || !latest.enabled || !config.schedulerEnabled) return
    this.registerTimer(latest)
  }

  // =========================================================================
  // 状态更新 & 通知
  // =========================================================================

  private updateStatus(id: string, lastStatus: 'success' | 'skipped' | 'failed', lastError?: string): void {
    // 每次重新读取最新配置，避免并发写入互相覆盖
    const config = loadConfig()
    const idx = (config.schedules || []).findIndex((s) => s.id === id)
    if (idx === -1) return
    config.schedules[idx].lastRunAt = Date.now()
    config.schedules[idx].lastStatus = lastStatus
    if (lastError) {
      config.schedules[idx].lastError = lastError
    } else {
      delete config.schedules[idx].lastError
    }
    saveConfig(config)

    // 通知渲染进程
    this.notifyStatusUpdate({ ...config.schedules[idx] })
  }

  private notifyStatusUpdate(schedule: ScheduleConfig): void {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(SCHEDULER_STATUS_UPDATE, schedule)
    })
  }

  private broadcastStatus(): void {
    const config = loadConfig()
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(SCHEDULER_STATUS_UPDATE, {
        _broadcast: true,
        schedules: config.schedules,
        schedulerEnabled: config.schedulerEnabled,
      })
    })
  }
}
