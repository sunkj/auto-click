import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSchedulerStore, type ScheduleConfig, type ScheduleCycle } from '@/stores/schedulerStore'
import { useScriptStore } from '@/stores/scriptStore'
import { Clock, Plus, Trash2, Power, PowerOff, Circle } from 'lucide-react'

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScheduleDialog({ open, onOpenChange }: ScheduleDialogProps) {
  const {
    schedules, schedulerEnabled, loading,
    loadSchedules, createSchedule, toggleSchedule, toggleAllSchedules, deleteSchedule,
  } = useSchedulerStore()
  const { scripts } = useScriptStore()

  const scriptList = scripts.filter((s) => s.type === 'script')

  // 新建弹窗
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (open) loadSchedules()
  }, [open, loadSchedules])

  const cycleLabel = (s: ScheduleConfig) => {
    switch (s.cycle) {
      case 'minute': return `每 ${s.minuteInterval} 分钟`
      case 'hour': return `每 ${s.hourInterval} 小时`
      case 'day': return `每天 ${s.dayTime}`
    }
  }

  const formatTime = (ts?: number) => {
    if (!ts) return '暂无'
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const statusIcon = (s: ScheduleConfig) => {
    if (!s.enabled || !schedulerEnabled) return <Circle className="h-3 w-3 text-red-500" />
    return <Circle className="h-3 w-3 text-green-500 fill-green-500" />
  }

  const lastStatusLabel = (s: ScheduleConfig) => {
    if (!s.lastStatus) return ''
    switch (s.lastStatus) {
      case 'success': return <span className="text-green-500 text-xs">✅ 成功</span>
      case 'skipped': return <span className="text-muted-foreground text-xs">⏭ 跳过</span>
      case 'failed': return (
        <span className="text-red-500 text-xs" title={s.lastError || ''}>
          ❌ 失败{s.lastError ? ': ' + s.lastError : ''}
        </span>
      )
    }
  }

  const activeCount = schedulerEnabled ? schedules.filter((s) => s.enabled).length : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[600px] max-h-[600px]" closeOnBackdrop={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            定时任务
            {!schedulerEnabled && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">已暂停</span>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 pb-2 border-b">
          {/* Master switch */}
          <Button
            variant={schedulerEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => toggleAllSchedules(!schedulerEnabled)}
          >
            {schedulerEnabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
            {schedulerEnabled ? '总开关: 已启用' : '总开关: 已关闭'}
          </Button>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            新建定时任务
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">加载中...</div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">暂无定时任务</p>
              <p className="text-xs text-muted-foreground/60 mt-1">点击上方「新建定时任务」开始</p>
            </div>
          ) : (
            <div className="space-y-2 py-3">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    s.enabled && schedulerEnabled ? 'border-border' : 'border-border/50 opacity-60'
                  )}
                >
                  <div className="pt-0.5">{statusIcon(s)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.scriptName}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{cycleLabel(s)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>脚本: {s.scriptName}</span>
                      <span>·</span>
                      <span>上次: {formatTime(s.lastRunAt)}</span>
                      {s.lastStatus && (
                        <>
                          <span>·</span>
                          {lastStatusLabel(s)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {s.enabled && schedulerEnabled ? (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleSchedule(s.id, false)} title="暂停">
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleSchedule(s.id, true)} title="启用">
                        <Circle className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteSchedule(s.id)} title="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* 新建定时任务 - 二级弹窗 */}
      <ScheduleCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </Dialog>
  )
}

/** 新建定时任务二级弹窗 */
function ScheduleCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { createSchedule } = useSchedulerStore()
  const { scripts } = useScriptStore()
  const scriptList = scripts.filter((s) => s.type === 'script')

  const [formScriptId, setFormScriptId] = useState('')
  const [formCycle, setFormCycle] = useState<ScheduleCycle>('minute')
  const [formMinuteInterval, setFormMinuteInterval] = useState('1')
  const [formHourInterval, setFormHourInterval] = useState('1')
  const [formDayTime, setFormDayTime] = useState('08:00')

  const resetForm = () => {
    setFormScriptId('')
    setFormCycle('minute')
    setFormMinuteInterval('1')
    setFormHourInterval('1')
    setFormDayTime('08:00')
  }

  const handleCreate = async () => {
    if (!formScriptId) return
    const script = scriptList.find((s) => s.id === formScriptId)
    if (!script) return
    await createSchedule({
      scriptId: formScriptId,
      scriptName: script.name,
      cycle: formCycle,
      minuteInterval: formCycle === 'minute' ? Number(formMinuteInterval) : undefined,
      hourInterval: formCycle === 'hour' ? Number(formHourInterval) : undefined,
      dayTime: formCycle === 'day' ? formDayTime : undefined,
    })
    onOpenChange(false)
    resetForm()
  }

  const handleCancel = () => {
    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
        <DialogHeader>
          <DialogTitle className="text-base">新建定时任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pb-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">选择脚本</label>
            <select
              value={formScriptId}
              onChange={(e) => setFormScriptId(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground w-full"
            >
              <option value="">-- 请选择 --</option>
              {scriptList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">执行周期</label>
            <div className="flex gap-2">
              {([
                { value: 'minute', label: '按分钟' },
                { value: 'hour', label: '按小时' },
                { value: 'day', label: '按天' },
              ] as { value: ScheduleCycle; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormCycle(opt.value)}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs border transition-colors',
                    formCycle === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {formCycle === 'minute' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">间隔分钟数</label>
              <Input
                type="number" min="1" step="1"
                value={formMinuteInterval}
                onChange={(e) => setFormMinuteInterval(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          {formCycle === 'hour' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">间隔小时数</label>
              <Input
                type="number" min="1" step="1"
                value={formHourInterval}
                onChange={(e) => setFormHourInterval(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          {formCycle === 'day' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">每天执行时间</label>
              <Input
                type="time"
                value={formDayTime}
                onChange={(e) => setFormDayTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>取消</Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={!formScriptId}>确定</Button>
        </div>
    </Dialog>
  )
}
