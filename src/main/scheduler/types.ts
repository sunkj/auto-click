/** 定时任务周期类型 */
export type ScheduleCycle = 'minute' | 'hour' | 'day'

/** 定时任务配置 */
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
