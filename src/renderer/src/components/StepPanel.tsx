import { useScriptStore, Step } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Play,
  CircleDot,
  SquarePen,
  Trash2,
  StepForward,
  Plus,
  Settings2,
  Monitor,
} from 'lucide-react'

const stepIcons: Record<string, typeof CircleDot> = {
  click: CircleDot,
  type: SquarePen,
  swipe: Monitor,
  script: FileIcon,
}

function FileIcon({ className }: { className?: string }) {
  return <SquarePen className={className} />
}

export function StepPanel() {
  const { scripts, currentScriptId, selectedStepId, setSelectedStep } = useScriptStore()
  const currentScript = scripts.find((s) => s.id === currentScriptId)

  if (!currentScriptId || !currentScript) {
    return (
      <aside className="flex w-[340px] min-w-[340px] flex-col border-r bg-card">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">请选择一个脚本</p>
        </div>
      </aside>
    )
  }

  const steps = currentScript.steps || []

  return (
    <aside className="flex w-[340px] min-w-[340px] flex-col border-r bg-card">
      {/* Top Toolbar */}
      <div className="flex h-[56px] items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate max-w-[140px]">
            {currentScript.name.replace('.js', '')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Play className="h-4 w-4 text-green-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <CircleDot className="h-4 w-4 text-red-500" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Step List */}
      <ScrollArea className="flex-1">
        {steps.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-muted-foreground">暂无步骤</p>
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
                    <div className="flex items-center gap-1 px-3 pb-2 pl-[60px] border-b border-border/50">
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
      <div className="flex h-[48px] items-center justify-end border-t px-3">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
