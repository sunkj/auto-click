import { create } from 'zustand'

// =============================================================================
// 类型定义
// =============================================================================

export type ScheduleCycle = 'minute' | 'hour' | 'day'

export interface ScheduleConfig {
  id: string
  scriptId: string
  scriptName: string
  enabled: boolean
  cycle: ScheduleCycle
  minuteInterval?: number
  hourInterval?: number
  dayTime?: string
  lastRunAt?: number
  lastStatus?: 'success' | 'skipped' | 'failed'
  lastError?: string
  createdAt: number
}

// =============================================================================
// IPC 辅助
// =============================================================================

function getAPI() {
  return window.electronAPI?.scheduler
}

// 调度器执行脚本时，自动在 UI 中选中该脚本
function listenSelectScript() {
  const api = getAPI()
  if (!api?.onSelectScript) return
  api.onSelectScript((scriptId: string) => {
    import('@/stores/scriptStore').then(({ useScriptStore }) => {
      useScriptStore.getState().setCurrentScript(scriptId)
    })
  })
}
listenSelectScript()

// =============================================================================
// Store
// =============================================================================

interface SchedulerStore {
  schedules: ScheduleConfig[]
  schedulerEnabled: boolean
  loading: boolean

  loadSchedules: () => Promise<void>
  createSchedule: (params: {
    scriptId: string
    scriptName: string
    cycle: ScheduleCycle
    minuteInterval?: number
    hourInterval?: number
    dayTime?: string
  }) => Promise<void>
  toggleSchedule: (id: string, enabled: boolean) => Promise<void>
  toggleAllSchedules: (enabled: boolean) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>
}

export const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  schedules: [],
  schedulerEnabled: true,
  loading: false,

  loadSchedules: async () => {
    const api = getAPI()
    if (!api) return
    set({ loading: true })
    try {
      const result = await api.list()
      set({
        schedules: result.schedules,
        schedulerEnabled: result.schedulerEnabled,
        loading: false,
      })
    } catch (err) {
      console.error('[SchedulerStore] 加载定时任务失败:', err)
      set({ loading: false })
    }
  },

  createSchedule: async (params) => {
    const api = getAPI()
    if (!api) return
    try {
      await api.create(params)
      await get().loadSchedules()
    } catch (err) {
      console.error('[SchedulerStore] 创建定时任务失败:', err)
    }
  },

  toggleSchedule: async (id, enabled) => {
    const api = getAPI()
    if (!api) return
    try {
      await api.toggle(id, enabled)
      await get().loadSchedules()
    } catch (err) {
      console.error('[SchedulerStore] 切换定时任务失败:', err)
    }
  },

  toggleAllSchedules: async (enabled) => {
    const api = getAPI()
    if (!api) return
    try {
      await api.toggleAll(enabled)
      set({ schedulerEnabled: enabled })
      await get().loadSchedules()
    } catch (err) {
      console.error('[SchedulerStore] 切换总开关失败:', err)
    }
  },

  deleteSchedule: async (id) => {
    const api = getAPI()
    if (!api) return
    try {
      await api.delete(id)
      await get().loadSchedules()
    } catch (err) {
      console.error('[SchedulerStore] 删除定时任务失败:', err)
    }
  },
}))
