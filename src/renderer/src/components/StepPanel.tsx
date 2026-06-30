import { useState, useEffect, useRef } from 'react'
import { useScriptStore, Step } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Play,
  Square,
  SquarePen,
  Trash2,
  StepForward,
  Plus,
  FileCode,
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  Pointer,
  FolderClosed,
  House,
  GripVertical,
  CircleDot,
  AppWindow,
  Brain,
  ScanSearch,
  ScanEye,
  Hourglass,
  X,
} from 'lucide-react'
import { NewStepDialog } from '@/components/NewStepDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const stepLabels: Record<string, string> = {
  click: '点击',
  type: '输入',
  swipe: '滑动',
  longpress: '长按',
  script: '脚本',
  home: '回主屏幕',
  openApp: '打开App',
  ai: 'AI',
  checkText: '文本检测',
  visionClick: '识别点击',
  wait: '等待',
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  click: MousePointerClick,
  type: Keyboard,
  swipe: ArrowUpDown,
  longpress: Pointer,
  script: FileCode,
  home: House,
  openApp: AppWindow,
  ai: Brain,
  checkText: ScanSearch,
  visionClick: ScanEye,
  wait: Hourglass,
}

export function StepPanel() {
  const { scripts, currentScriptId, selectedStepId, setSelectedStep, getStepsForScript, executingStepIndex, runScript, runStep, stopExecution } = useScriptStore()
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [editScriptOpen, setEditScriptOpen] = useState(false)
  const [editScriptName, setEditScriptName] = useState('')
  const [editScriptFolder, setEditScriptFolder] = useState<string | null>(null)
  const [editContextEntries, setEditContextEntries] = useState<{ key: string; value: string }[]>([])
  const [deleteStepTarget, setDeleteStepTarget] = useState<Step | null>(null)
  const [editingStep, setEditingStep] = useState<Step | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const draggedIndex = useRef<number | null>(null)
  const currentScript = scripts.find((s) => s.id === currentScriptId)
  const folders = scripts.filter((s) => s.type === 'folder')

  // 拖拽排序：开始拖拽
  const handleDragStart = (idx: number) => {
    draggedIndex.current = idx
  }

  // 拖拽排序：拖拽经过
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex.current !== idx) {
      setDragOverIndex(idx)
    }
  }

  // 拖拽排序：离开
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  // 拖拽排序：放下
  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    const fromIdx = draggedIndex.current
    draggedIndex.current = null
    if (fromIdx === null || fromIdx === dropIdx) return

    const store = useScriptStore.getState()

    // 持久化到后端（传递排序后的 stepId 数组）
    const steps = store.getStepsForScript(currentScriptId!)
    const stepIds = steps.map((s) => Number(s.id))
    // 重新排列 stepIds 匹配拖拽后的顺序
    const [movedId] = stepIds.splice(fromIdx, 1)
    stepIds.splice(dropIdx, 0, movedId)

    try {
      const api = window.electronAPI?.script
      if (api) {
        await api.updateStepsOrder(currentScriptId!, stepIds)
      }
      // 持久化成功后，从后端重新加载步骤确保本地与 DB 完全同步
      await store.refreshSteps(currentScriptId!)
    } catch (error) {
      console.error('[StepPanel] 保存排序失败:', error)
      // 回滚：刷新步骤恢复原始顺序
      await store.refreshSteps(currentScriptId!)
    }
  }

  // 拖拽排序：结束
  const handleDragEnd = () => {
    draggedIndex.current = null
    setDragOverIndex(null)
  }

  // 打开编辑脚本弹窗
  const handleOpenEditScript = () => {
    if (!currentScript) return
    setEditScriptName(currentScript.name)
    setEditScriptFolder(currentScript.parentId)
    setEditContextEntries(
      currentScript.initialContext
        ? Object.entries(currentScript.initialContext).map(([key, value]) => ({ key, value }))
        : []
    )
    setEditScriptOpen(true)
  }

  // 保存脚本名称 + 目录 + context
  const handleSaveScriptName = async () => {
    if (!currentScript || !editScriptName.trim()) return
    const name = editScriptName.trim()
    const initialContext = editContextEntries.filter((e) => e.key.trim())
    await useScriptStore.getState().updateScript(currentScript.id, {
      name,
      parentId: editScriptFolder,
      initialContext: initialContext.length > 0
        ? Object.fromEntries(initialContext.map((e) => [e.key.trim(), e.value]))
        : undefined,
    })
    setEditScriptOpen(false)
  }

  // 确认删除步骤
  const handleConfirmDeleteStep = () => {
    if (!deleteStepTarget) return
    const stepIdNum = Number(deleteStepTarget.id)
    if (!isNaN(stepIdNum)) {
      useScriptStore.getState().deleteStep(stepIdNum)
    }
    setDeleteStepTarget(null)
  }

  // 打开编辑步骤弹窗
  const handleOpenEditStep = (step: Step) => {
    setEditingStep(step)
    setStepDialogOpen(true)
  }

  // 监听引擎执行进度，实时更新高亮
  useEffect(() => {
    const eng = window.electronAPI?.engine
    if (!eng) return
    const unsub = eng.onStepStart((event: any) => {
      if (event.status === 'start') {
        useScriptStore.getState().setExecutingStep(event.stepIndex)
      } else if (event.status === 'error') {
        useScriptStore.getState().setExecutingStep(null)
      } else if (event.status === 'end' && event.stepIndex === -1) {
        useScriptStore.getState().setExecutingStep(null)
      }
    })
    return unsub
  }, [])

  if (!currentScriptId || !currentScript) {
    return (
      <aside className="flex w-[340px] min-w-[340px] flex-col border-r bg-card">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <FileCode className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">未选择脚本</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              请从左侧脚本列表中选择一个脚本<br />以查看其步骤详情
            </p>
          </div>
        </div>
      </aside>
    )
  }

  const steps = getStepsForScript(currentScriptId)
  const selectedStepIndex = selectedStepId
    ? steps.findIndex((s) => s.id === selectedStepId) + 1
    : 0

  return (
    <aside className="flex w-[340px] min-w-[340px] flex-col border-r bg-card">
      {/* Top Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <FileCode className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate max-w-[140px]">
              {currentScript.name}
            </span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
              {steps.length} 步
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="运行全部" onClick={() => runScript(currentScriptId!)} disabled={executingStepIndex !== null}>
            <Play className={`h-4 w-4 ${executingStepIndex !== null ? 'text-muted-foreground' : 'text-green-500'}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="停止执行" onClick={stopExecution} disabled={executingStepIndex === null}>
            <Square className="h-4 w-4 text-red-500" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑脚本" onClick={handleOpenEditScript}>
            <SquarePen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className='px-4 py-3'>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2 h-8 text-xs"
          onClick={() => setStepDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          添加步骤
        </Button>
      </div>
      <NewStepDialog
        open={stepDialogOpen}
        onOpenChange={(open) => {
          setStepDialogOpen(open)
          if (!open) setEditingStep(null)
        }}
        editStep={editingStep}
      />
      {/* Step List */}
      <ScrollArea className="flex-1">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <MousePointerClick className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">该脚本暂无步骤</p>
          </div>
        ) : (
          <div className="py-1">
            {steps.map((step: Step, _idx: number) => {
              const StepIcon = stepIcons[step.type] || CircleDot
              const isSelected = selectedStepId === step.id
              const isExecuting = executingStepIndex === (step.index - 1)
              const isLast = _idx === steps.length - 1
              const isDragOver = dragOverIndex === _idx && draggedIndex.current !== _idx

              return (
                <div key={step.id}>
                  {/* 拖拽放置指示线 */}
                  {isDragOver && (
                    <div className="h-0.5 bg-primary mx-3 rounded-full" />
                  )}
                  <div
                    draggable
                    onDragStart={() => handleDragStart(_idx)}
                    onDragOver={(e) => handleDragOver(e, _idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, _idx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group flex items-start gap-1 px-2 py-3 transition-all duration-150 active:scale-[0.99]',
                      isExecuting ? 'bg-yellow-500/20 border-l-2 border-yellow-500 active:scale-100' : '',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50',
                      draggedIndex.current === _idx ? 'opacity-50' : ''
                    )}
                  >
                    {/* 拖拽手柄 */}
                    <div className="flex items-center pt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    {/* 步骤主体 */}
                    <button
                      onClick={() => setSelectedStep(isSelected ? null : step.id)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                    >
                      {/* Step Number + Icon */}
                      <div className="flex items-center gap-2 min-w-[28px]">
                        {isExecuting ? (
                          <svg className="h-3.5 w-3.5 text-yellow-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <span className="text-xs font-mono text-muted-foreground w-4 text-right">
                            {step.index}
                          </span>
                        )}
                        <StepIcon className={cn('h-4 w-4 shrink-0', isExecuting ? 'text-yellow-500' : 'text-muted-foreground')} />
                      </div>
                      {/* Step Content */}
                      <div className="flex-1 min-w-0 mt-[-2px]">
                        <div className="text-sm font-medium truncate">{step.name || stepLabels[step.type] || step.type}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </div>
                        {/* 条件 & Context 信息 */}
                        {(step as any).condition || (step as any).contextOutput ? (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {(step as any).condition && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600/80 bg-amber-50 dark:text-amber-400/80 dark:bg-amber-400/10 px-1 py-0.5 rounded">
                                ⚡ {((step as any).condition as any).key}={((step as any).condition as any).value}
                                <span className="opacity-60 ml-0.5">→ {((step as any).condition as any).onMatch === 'stop' ? '终止' : '跳过'}</span>
                              </span>
                            )}
                            {(step as any).contextOutput && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600/80 bg-blue-50 dark:text-blue-400/80 dark:bg-blue-400/10 px-1 py-0.5 rounded">
                                📝 {((step as any).contextOutput as any).key}={((step as any).contextOutput as any).value}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </div>

                  {/* Operations Row (when selected) */}
                  {isSelected && (
                    <div className="flex items-center gap-1 px-3 pb-2 pl-[68px] pt-0 border-b border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => handleOpenEditStep(step)}
                      >
                        <SquarePen className="h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeleteStepTarget(step)}
                      >
                        <Trash2 className="h-3 w-3" />
                        删除
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => runStep(currentScriptId!, step.index - 1)} disabled={executingStepIndex !== null}>
                        <StepForward className="h-3 w-3" />
                        运行
                      </Button>
                    </div>
                  )}

                  {/* Border between steps（选中状态下由 operations row 的 border 代替） */}
                  {!isSelected && !isLast && <div className="ml-[60px] border-b border-border/30" />}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Bottom Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-t px-3 text-[12px]">
        <span className="text-muted-foreground">
          步骤 {executingStepIndex !== null ? executingStepIndex + 1 : selectedStepIndex}/{steps.length || '-'}
        </span>
        <span className={`text-[11px] ${executingStepIndex !== null ? 'text-yellow-500' : 'text-muted-foreground/50'}`}>
          {executingStepIndex !== null ? '● 运行中' : '● 停止'}
        </span>
      </div>

      {/* 编辑脚本名称弹窗 */}
      <Dialog open={editScriptOpen} onOpenChange={setEditScriptOpen}>
        <DialogHeader>
          <DialogTitle>编辑脚本</DialogTitle>
          <DialogDescription>修改脚本名称或目录</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 目录选择器 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">目录</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditScriptFolder(null)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
                  editScriptFolder === null
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                <FolderClosed className="h-3 w-3" />
                根目录
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEditScriptFolder(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
                    editScriptFolder === f.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  <FolderClosed className="h-3 w-3" />
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">脚本名称</label>
            <Input
              placeholder="输入脚本名称..."
              value={editScriptName}
              onChange={(e) => setEditScriptName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          {/* 初始上下文 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">初始上下文</label>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {editContextEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    placeholder="key"
                    value={entry.key}
                    onChange={(e) => {
                      const entries = [...editContextEntries]
                      entries[i] = { ...entries[i], key: e.target.value }
                      setEditContextEntries(entries)
                    }}
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    placeholder="value"
                    value={entry.value}
                    onChange={(e) => {
                      const entries = [...editContextEntries]
                      entries[i] = { ...entries[i], value: e.target.value }
                      setEditContextEntries(entries)
                    }}
                    className="h-7 text-xs flex-1"
                  />
                  <button
                    onClick={() => setEditContextEntries(editContextEntries.filter((_, idx) => idx !== i))}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditContextEntries([...editContextEntries, { key: '', value: '' }])}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" />
                添加
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setEditScriptOpen(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSaveScriptName} disabled={!editScriptName.trim()}>
            保存
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 删除步骤确认框 */}
      <ConfirmDialog
        open={!!deleteStepTarget}
        onOpenChange={(open) => { if (!open) setDeleteStepTarget(null) }}
        title="删除步骤"
        description={`确定要删除步骤 ${deleteStepTarget?.index}（${deleteStepTarget?.description || stepLabels[deleteStepTarget?.type || ''] || deleteStepTarget?.type}）吗？此操作不可撤销。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleConfirmDeleteStep}
      />
    </aside>
  )
}

function capitalize(str: string) {
  return stepLabels[str] || str
}
