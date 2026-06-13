import { useState } from 'react'
import { useScriptStore, Step } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
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
  Edit2,
} from 'lucide-react'
import { NewStepDialog } from '@/components/NewStepDialog'

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  click: MousePointerClick,
  type: Keyboard,
  swipe: ArrowUpDown,
  script: FileCode,
}

export function StepPanel() {
  const { scripts, currentScriptId, selectedStepId, setSelectedStep, getStepsForScript } = useScriptStore()
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const currentScript = scripts.find((s) => s.id === currentScriptId)

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

  return (
    <aside className="flex w-[340px] min-w-[340px] flex-col border-r bg-card">
      {/* Top Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ArrowLeft className="h-4 w-4" />
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
          <Button variant="ghost" size="icon" className="h-7 w-7" title="运行全部">
            <Play className="h-4 w-4 text-green-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="录制">
            <CircleDot className="h-4 w-4 text-red-500" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑">
            <Edit2 className="h-4 w-4" />
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
      <NewStepDialog open={stepDialogOpen} onOpenChange={setStepDialogOpen} />
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
              const isLast = _idx === steps.length - 1

              return (
                <div key={step.id}>
                  <button
                    onClick={() => setSelectedStep(isSelected ? null : step.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors',
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
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{capitalize(step.type)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </div>
                    </div>
                  </button>

                  {/* Operations Row (when selected) */}
                  {isSelected && (
                    <div className="flex items-center gap-1 px-3 pb-2 pl-[60px] pt-2 border-b border-border/50">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                        <SquarePen className="h-3 w-3" />
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                        删除
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
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
        <span className="text-muted-foreground/50">● Step 1/5</span>
        <span className="text-muted-foreground/50">Status: Success</span>
      </div>
    </aside>
  )
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
