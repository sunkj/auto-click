/**
 * AutoClick - 定时任务模块入口
 *
 * 注册 scheduler:* IPC 处理器，协调 SchedulerEngine 与渲染进程通信。
 */
import { ipcMain } from 'electron'
import { SchedulerEngine } from './scheduler-engine'
import type { ScriptEngine } from '../script-engine/script-engine'

export const SCHEDULER_CHANNELS = {
  LIST: 'scheduler:list',
  CREATE: 'scheduler:create',
  UPDATE: 'scheduler:update',
  DELETE: 'scheduler:delete',
  TOGGLE: 'scheduler:toggle',
  TOGGLE_ALL: 'scheduler:toggleAll',
}

let schedulerEngine: SchedulerEngine | null = null
let _scriptEngine: ScriptEngine | null = null

/** 获取 SchedulerEngine 实例 */
export function getSchedulerEngine(): SchedulerEngine | null {
  return schedulerEngine
}

/** 由外部注入共享的 ScriptEngine 实例（避免多个实例造成执行冲突） */
export function setScriptEngine(engine: ScriptEngine): void {
  _scriptEngine = engine
}

export function registerSchedulerHandlers(): void {
  // ScriptEngine 由外部通过 setScriptEngine() 注入
  schedulerEngine = new SchedulerEngine(_scriptEngine!)

  // ── 列表 ──
  ipcMain.handle(SCHEDULER_CHANNELS.LIST, () => {
    return schedulerEngine!.getAll()
  })

  // ── 创建 ──
  ipcMain.handle(SCHEDULER_CHANNELS.CREATE, async (_event, params: {
    scriptId: string
    scriptName: string
    cycle: 'minute' | 'hour' | 'day'
    minuteInterval?: number
    hourInterval?: number
    dayTime?: string
  }) => {
    try {
      return schedulerEngine!.create(params)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 更新 ──
  ipcMain.handle(SCHEDULER_CHANNELS.UPDATE, async (_event, { id, updates }: { id: string; updates: any }) => {
    try {
      return schedulerEngine!.update(id, updates)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 删除 ──
  ipcMain.handle(SCHEDULER_CHANNELS.DELETE, async (_event, id: string) => {
    try {
      return { success: schedulerEngine!.remove(id) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 切换单个 ──
  ipcMain.handle(SCHEDULER_CHANNELS.TOGGLE, async (_event, { id, enabled }: { id: string; enabled: boolean }) => {
    try {
      return schedulerEngine!.toggle(id, enabled)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 总开关 ──
  ipcMain.handle(SCHEDULER_CHANNELS.TOGGLE_ALL, async (_event, { enabled }: { enabled: boolean }) => {
    try {
      schedulerEngine!.setEnabled(enabled)
      return { enabled }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
