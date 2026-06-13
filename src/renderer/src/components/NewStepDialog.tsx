import { useState } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  FileCode,
} from 'lucide-react'

type StepType = 'click' | 'type' | 'swipe' | 'script'

interface NewStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const stepTypeMeta: Record<StepType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  click: { label: '点击', icon: MousePointerClick, color: 'text-blue-500' },
  type: { label: '输入', icon: Keyboard, color: 'text-green-500' },
  swipe: { label: '滑动', icon: ArrowUpDown, color: 'text-purple-500' },
  script: { label: '脚本', icon: FileCode, color: 'text-orange-500' },
}

export function NewStepDialog({ open, onOpenChange }: NewStepDialogProps) {
  const [stepType, setStepType] = useState<StepType>('click')
  const [params, setParams] = useState<Record<string, string>>({
    x: '',
    y: '',
    description: '',
    text: '',
    direction: 'Up',
    duration: '',
    scriptName: '',
  })

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const handleAdd = () => {
    // TODO: add step to store
    onOpenChange(false)
    resetForm()
  }

  const resetForm = () => {
    setStepType('click')
    setParams({ x: '', y: '', description: '', text: '', direction: 'Up', duration: '', scriptName: '' })
  }

  const handleCancel = () => {
    onOpenChange(false)
    resetForm()
  }

  const types: StepType[] = ['click', 'type', 'swipe', 'script']

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
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">描述（可选）</label>
              <Input
                placeholder='例如: "Login Button"'
                value={params.description}
                onChange={(e) => handleParamChange('description', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )
      case 'type':
        return (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">输入内容</label>
            <Input
              placeholder="输入文本..."
              value={params.text}
              onChange={(e) => handleParamChange('text', e.target.value)}
              className="h-8 text-sm"
            />
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
              <label className="text-xs text-muted-foreground">时长（秒）</label>
              <Input
                placeholder="1.2"
                value={params.duration}
                onChange={(e) => handleParamChange('duration', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )
      case 'script':
        return (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">子脚本名称</label>
            <Input
              placeholder="run.js"
              value={params.scriptName}
              onChange={(e) => handleParamChange('scriptName', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>添加步骤</DialogTitle>
        <DialogDescription>选择步骤类型并填写参数</DialogDescription>
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
        <Button size="sm" onClick={handleAdd}>
          添加
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
