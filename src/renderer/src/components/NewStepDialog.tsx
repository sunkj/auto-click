import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useScriptStore, Step } from '@/stores/scriptStore'
import {
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  Pointer,
} from 'lucide-react'

type StepType = 'click' | 'type' | 'swipe' | 'longpress'

interface NewStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editStep?: Step | null
}

const stepTypeMeta: Record<StepType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  click: { label: '点击', icon: MousePointerClick, color: 'text-blue-500' },
  type: { label: '输入', icon: Keyboard, color: 'text-green-500' },
  swipe: { label: '滑动', icon: ArrowUpDown, color: 'text-purple-500' },
  longpress: { label: '长按', icon: Pointer, color: 'text-red-500' },
}

function paramsFromStep(step: Step): Record<string, string> {
  const p: Record<string, string> = { ...step.params }
  if (!p.description) p.description = ''
  if (!p.direction) p.direction = 'Up'
  if (!p.duration) p.duration = ''
  if (!p.text) p.text = ''
  if (!p.x) p.x = ''
  if (!p.y) p.y = ''
  if (!p.duration) p.duration = ''
  return p
}

export function NewStepDialog({ open, onOpenChange, editStep }: NewStepDialogProps) {
  const isEditMode = !!editStep

  const [stepType, setStepType] = useState<StepType>(editStep?.type ?? 'click')
  const [params, setParams] = useState<Record<string, string>>(
    editStep ? paramsFromStep(editStep) : {
      x: '',
      y: '',
      description: '',
      text: '',
      direction: 'Up',
      duration: '',
      pressDuration: '1.0',
    }
  )

  // 当 editStep 变化时同步表单
  useEffect(() => {
    if (editStep) {
      setStepType(editStep.type)
      setParams(paramsFromStep(editStep))
    } else {
      setStepType('click')
      setParams({ x: '', y: '', description: '', text: '', direction: 'Up', duration: '', pressDuration: '1.0' })
    }
  }, [editStep])

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const store = useScriptStore.getState()

    if (isEditMode && editStep) {
      // 编辑模式：更新步骤
      const stepIdNum = Number(editStep.id)
      if (!isNaN(stepIdNum)) {
        try {
          await store.updateStep(stepIdNum, stepType, params)
        } catch (error) {
          console.error('[NewStepDialog] 更新步骤失败:', error)
        }
      }
    } else {
      // 新建模式：添加步骤
      const { currentScriptId } = store
      if (!currentScriptId) return
      try {
        await store.addStep(currentScriptId, stepType, params, undefined)
      } catch (error) {
        console.error('[NewStepDialog] 添加步骤失败:', error)
      }
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const types: StepType[] = ['click', 'type', 'swipe', 'longpress']

  const renderParams = () => {
    switch (stepType) {
      case 'click':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">X 坐标</label>
                <Input
                  placeholder="320"
                  value={params.x}
                  onChange={(e) => handleParamChange('x', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Y 坐标</label>
                <Input
                  placeholder="580"
                  value={params.y}
                  onChange={(e) => handleParamChange('y', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        )
      case 'type':
        return (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">输入内容（不支持中文）</label>
            <Input
              placeholder="输入文本..."
              value={params.text}
              onChange={(e) => handleParamChange('text', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )
      case 'longpress':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">X 坐标</label>
                <Input
                  placeholder="540"
                  value={params.x}
                  onChange={(e) => handleParamChange('x', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Y 坐标</label>
                <Input
                  placeholder="1200"
                  value={params.y}
                  onChange={(e) => handleParamChange('y', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">按压时长（秒）(正常设置2秒)</label>
              <Input
                placeholder="1.0"
                value={params.pressDuration}
                onChange={(e) => handleParamChange('pressDuration', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )
      case 'swipe':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">方向</label>
              <div className="flex gap-2">
                {['Up', 'Down', 'Left', 'Right'].map((dir) => (
                  <button
                    key={dir}
                    onClick={() => handleParamChange('direction', dir)}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-md text-xs border transition-colors',
                      params.direction === dir
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {dir === 'Up' ? '↑ 上' : dir === 'Down' ? '↓ 下' : dir === 'Left' ? '← 左' : '→ 右'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">时长（秒）（正常设置0.1秒，时间越短滑动越快）</label>
              <Input
                placeholder="1.2"
                value={params.duration}
                onChange={(e) => handleParamChange('duration', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEditMode ? '编辑步骤' : '添加步骤'}</DialogTitle>
        <DialogDescription>{isEditMode ? '修改步骤参数' : '选择步骤类型并填写参数'}</DialogDescription>
      </DialogHeader>

      {/* Step Type Selector */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {types.map((type) => {
          const meta = stepTypeMeta[type]
          const Icon = meta.icon
          const isActive = stepType === type
          return (
            <button
              key={type}
              onClick={() => setStepType(type)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-colors',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? meta.color : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Parameters Form */}
      {renderParams()}

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={handleCancel}>
          取消
        </Button>
        <Button size="sm" onClick={handleSave}>
          {isEditMode ? '保存' : '添加'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
