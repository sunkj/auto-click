import { useState } from 'react'
import { useScriptStore, Step } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Play,
  CircleDot,
  SquarePen,
  Trash2,
  StepForward,
  Plus,
  FileCode,
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  FolderClosed,
} from 'lucide-react'
import { NewStepDialog } from '@/components/NewStepDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  click: MousePointerClick,
  type: Keyboard,
  swipe: ArrowUpDown,
  script: FileCode,
}

export function StepPanel() {
  const { scripts, currentScriptId, selectedStepId, setSelectedStep, getStepsForScript, executingStepIndex, runScript, runStep } = useScriptStore()
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [editScriptOpen, setEditScriptOpen] = useState(false)
  const [editScriptName, setEditScriptName] = useState('')
  const [editScriptFolder, setEditScriptFolder] = useState<string | null>(null)
  const [deleteStepTarget, setDeleteStepTarget] = useState<Step | null>(null)
  const [editingStep, setEditingStep] = useState<Step | null>(null)
  const currentScript = scripts.find((s) => s.id === currentScriptId)
  const folders = scripts.filter((s) => s.type === 'folder')

  // 打开编辑脚本弹窗
  const handleOpenEditScript = () => {
    if (!currentScript) return
    setEditScriptName(currentScript.name.replace('.js', ''))
    setEditScriptFolder(currentScript.parentId)
    setEditScriptOpen(true)
  }

  // 保存脚本名称 + 目录
  const handleSaveScriptName = async () => {
    if (!currentScript || !editScriptName.trim()) return
    const name = editScriptName.trim().endsWith('.js') ? editScriptName.trim() : editScriptName.trim() + '.js'
    await useScriptStore.getState().updateScript(currentScript.id, {
      name,
      parentId: editScriptFolder,
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
              {currentScript.name.replace('.js', '')}
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
          <Button variant="ghost" size="icon" className="h-7 w-7" title="录制">
            <CircleDot className="h-4 w-4 text-red-500" />
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

              return (
                <div key={step.id}>
                  <button
                    onClick={() => setSelectedStep(isSelected ? null : step.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors',
                      isExecuting ? 'bg-yellow-500/20 border-l-2 border-yellow-500' : '',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    {/* Step Number */}
                    <div className="flex items-center gap-2 min-w-[28px]">
                      <span className="text-xs font-mono text-muted-foreground w-4 text-right">
                        {step.index}
                      </span>
                      <StepIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {/* Step Content */}
                    <div className="flex-1 min-w-0 mt-[-2px]">
                      <div className="text-sm font-medium">{capitalize(step.type)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </div>
                    </div>
                  </button>

                  {/* Operations Row (when selected) */}
                  {isSelected && (
                    <div className="flex items-center gap-1 px-3 pb-2 pl-[60px] pt-2 border-b border-border/50">
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

                  {/* Border between steps */}
                  {!isSelected && !isLast && <div className="ml-[60px] border-b border-border/30" />}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Bottom Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-t px-3 text-[12px]">
        <span className="text-muted-foreground/50">
          ● Step {selectedStepIndex}/{steps.length || '-'}
        </span>
        <span className="text-muted-foreground/50">Status: Success</span>
      </div>

      {/* 编辑脚本名称弹窗 */}
      <Dialog open={editScriptOpen} onOpenChange={setEditScriptOpen}>
        <DialogHeader>
          <DialogTitle>编辑脚本</DialogTitle>
          <DialogDescription>修改脚本名称或目录</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
        description={`确定要删除步骤 ${deleteStepTarget?.index}（${deleteStepTarget?.description || capitalize(deleteStepTarget?.type || '')}）吗？此操作不可撤销。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleConfirmDeleteStep}
      />
    </aside>
  )
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
