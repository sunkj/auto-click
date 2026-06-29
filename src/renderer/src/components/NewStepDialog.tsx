import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useScriptStore, Step } from '@/stores/scriptStore'
import { RecordedClickListDialog } from '@/components/RecordedClickListDialog'
import {
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  Pointer,
  Database,
  House,
  AppWindow,
  Brain,
  ScanSearch,
} from 'lucide-react'

type StepType = 'click' | 'type' | 'swipe' | 'longpress' | 'home' | 'openApp' | 'ai' | 'checkText'

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
  home: { label: '回主屏幕', icon: House, color: 'text-orange-500' },
  openApp: { label: '打开App', icon: AppWindow, color: 'text-sky-500' },
  ai: { label: 'AI', icon: Brain, color: 'text-cyan-500' },
  checkText: { label: '文本检测', icon: ScanSearch, color: 'text-rose-500' },
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
  if (!p.aiPrompt) p.aiPrompt = ''
  return p
}

const typeLabels: Record<StepType, string> = {
  click: '点击',
  type: '输入',
  swipe: '滑动',
  longpress: '长按',
  home: '回主屏幕',
  openApp: '打开App',
  ai: 'AI',
  checkText: '文本检测',
}

export function NewStepDialog({ open, onOpenChange, editStep }: NewStepDialogProps) {
  const isEditMode = !!editStep

  const [stepType, setStepType] = useState<StepType>((editStep?.type as StepType) ?? 'click')
  const [stepName, setStepName] = useState<string>(editStep?.name || typeLabels[editStep?.type as StepType] || '点击')
  const [params, setParams] = useState<Record<string, string>>(
    editStep ? paramsFromStep(editStep) : {
      x: '', y: '', description: '', text: '', direction: 'Up', duration: '', pressDuration: '1.0', appName: '', aiPrompt: '', checkText: '',
    }
  )
  const { scripts, currentScriptId } = useScriptStore()
  const currentScriptForCtx = scripts.find((s) => s.id === currentScriptId)
  const contextKeyOptions = currentScriptForCtx?.initialContext ? Object.keys(currentScriptForCtx.initialContext) : []

  // 前置条件 & Context 写入
  const [conditionKey, setConditionKey] = useState('')
  const [conditionValue, setConditionValue] = useState('')
  const [conditionOnMatch, setConditionOnMatch] = useState<'skip' | 'stop'>('skip')
  const [contextKey, setContextKey] = useState('')
  const [contextValue, setContextValue] = useState('')

  // 当 editStep 变化时同步表单
  useEffect(() => {
    if (editStep) {
      setStepType(editStep.type as StepType)
      setStepName(editStep.name || typeLabels[editStep.type as StepType] || '')
      setParams(paramsFromStep(editStep))
      const s = editStep as any
      setConditionKey(s.condition?.key || '')
      setConditionValue(s.condition?.value || '')
      setConditionOnMatch(s.condition?.onMatch || 'skip')
      setContextKey(s.contextOutput?.key || '')
      setContextValue(s.contextOutput?.value || '')
    } else {
      setStepType('click')
      setStepName('点击')
      setParams({ x: '', y: '', description: '', text: '', direction: 'Up', duration: '', pressDuration: '1.0', appName: '', aiPrompt: '', checkText: '' })
      setConditionKey(''); setConditionValue(''); setConditionOnMatch('skip')
      setContextKey(''); setContextValue('')
    }
  }, [editStep])

  const handleTypeChange = (type: StepType) => {
    // 如果名称还是旧的类型名称，则跟随类型更新
    const oldLabel = typeLabels[stepType]
    if (stepName === oldLabel || !stepName) {
      setStepName(typeLabels[type])
    }
    setStepType(type)
  }

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const store = useScriptStore.getState()

    // 合并前置条件和 context 到 params
    const mergedParams = { ...params }
    if (conditionKey) {
      mergedParams._condition_key = conditionKey
      mergedParams._condition_value = conditionValue
      mergedParams._condition_onMatch = conditionOnMatch
    }
    if (contextKey) {
      mergedParams._context_key = contextKey
      mergedParams._context_value = contextValue
    }

    if (isEditMode && editStep) {
      // 编辑模式：更新步骤
      const stepIdNum = Number(editStep.id)
      if (!isNaN(stepIdNum)) {
        try {
          await store.updateStep(stepIdNum, stepType, mergedParams, stepName || undefined)
        } catch (error) {
          console.error('[NewStepDialog] 更新步骤失败:', error)
        }
      }
    } else {
      // 新建模式：添加步骤
      const { currentScriptId } = store
      if (!currentScriptId) return
      try {
        await store.addStep(currentScriptId, stepType as any, mergedParams, undefined, stepName || undefined)
      } catch (error) {
        console.error('[NewStepDialog] 添加步骤失败:', error)
      }
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const types: StepType[] = ['click', 'type', 'swipe', 'longpress', 'home', 'openApp', 'ai', 'checkText']

  // 从录制记录选择
  const [showRecordSelector, setShowRecordSelector] = useState(false)

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
            <div className="!mt-6">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
                onClick={() => setShowRecordSelector(true)}
              >
                <Database className="h-3 w-3" />
                从录制记录中选择
              </Button>
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
      case 'home':
        return (
          <div className="py-4 text-center text-sm text-muted-foreground">
            回主屏幕操作无需额外参数
          </div>
        )
      case 'openApp':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">应用名称</label>
              <Input
                placeholder="微信"
                value={params.appName}
                onChange={(e) => handleParamChange('appName', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              💡 提示：只支持打开当前可见屏幕之内的应用，如果应用不再当前屏幕内，请先滑动到对应的屏幕
            </div>
          </div>
        )
      case 'ai':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">执行描述</label>
              <textarea
                placeholder="描述 AI 需要执行的操作流程&#10;例如：&#10;1. 打开微信&#10;2. 进入某某聊天窗口&#10;3. 输入内容并发送&#10;4. 返回聊天列表"
                value={params.description || ''}
                onChange={(e) => handleParamChange('description', e.target.value)}
                rows={4}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
              💡 需要支持更多的指令，请先<strong>录制添加更多的指令</strong>
            </div>
          </div>
        )
      case 'checkText':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">检测文本</label>
              <Input
                placeholder="输入要检测的文本，如：成功、发送、确认"
                value={params.checkText || ''}
                onChange={(e) => handleParamChange('checkText', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700 leading-relaxed">
              🔍 执行时将自动截取当前屏幕检测文本。
              检测到文本时，才会执行下方的<strong>「写入上下文」</strong>；
              未检测到则不写入。
            </div>
          </div>
        )
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[680px]">
      <DialogHeader>
        <DialogTitle>{isEditMode ? '编辑步骤' : '添加步骤'}</DialogTitle>
        <DialogDescription>{isEditMode ? '修改步骤参数' : '选择步骤类型并填写参数'}</DialogDescription>
      </DialogHeader>

      {/* Step Type Selector */}
      <div className="grid grid-cols-9 gap-1.5 mb-1">
        {types.map((type) => {
          const meta = stepTypeMeta[type]
          const Icon = meta.icon
          const isActive = stepType === type
          return (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={cn(
                'flex flex-col items-center gap-1 py-[6px] rounded-lg border transition-all duration-150 active:scale-[0.97]',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent hover:border-muted-foreground/20'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? meta.color : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Step Name */}
      <div className="space-y-1 mb-1">
        <label className="text-xs text-muted-foreground">步骤名称</label>
        <Input
          placeholder="输入步骤名称..."
          value={stepName}
          onChange={(e) => setStepName(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Parameters Form */}
      {renderParams()}

      {/* ── 前置条件（折叠） ── */}
      <details className="group border border-border rounded-md mt-3">
        <summary className="flex items-center gap-2 px-3 py-[10px] text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
          <span className="text-amber-500">⚡</span>
          前置条件
          <span className="ml-auto text-[10px] opacity-50 group-open:opacity-100">{(conditionKey ? '已设置' : '可选')}</span>
        </summary>
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">选择 Key</label>
              <select
                value={conditionKey}
                onChange={(e) => setConditionKey(e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground w-full"
              >
                <option value="">-- 请选择 --</option>
                {contextKeyOptions.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">等于值</label>
              <Input placeholder="比较值" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground shrink-0">满足时</label>
            <select
              value={conditionOnMatch}
              onChange={(e) => setConditionOnMatch(e.target.value as 'skip' | 'stop')}
              className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground"
            >
              <option value="skip">跳过当前步骤</option>
              <option value="stop">停止脚本</option>
            </select>
          </div>
        </div>
      </details>

      {/* ── 写入 Context（折叠） ── */}
      <details className="group border border-border rounded-md mt-2">
        <summary className="flex items-center gap-2 px-3 py-[10px] text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
          <span className="text-blue-500">📝</span>
          写入上下文
          <span className="ml-auto text-[10px] opacity-50 group-open:opacity-100">{(contextKey ? '已设置' : '可选')}</span>
        </summary>
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">选择 Key</label>
              <select
                value={contextKey}
                onChange={(e) => setContextKey(e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground w-full"
              >
                <option value="">-- 请选择 --</option>
                {contextKeyOptions.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">设置 Value</label>
              <Input placeholder="设置值" value={contextValue} onChange={(e) => setContextValue(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </div>
      </details>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={handleCancel}>
          取消
        </Button>
        <Button size="sm" onClick={handleSave}>
          {isEditMode ? '保存' : '添加'}
        </Button>
      </DialogFooter>


    </Dialog>

      {/* 从录制记录选择弹窗（在 Dialog 外部渲染，避免嵌套冲突） */}
      <RecordedClickListDialog
        open={showRecordSelector}
        onOpenChange={setShowRecordSelector}
        selectMode
        onSelect={(item) => {
          handleParamChange('x', String(item.x))
          handleParamChange('y', String(item.y))
          setStepName(item.name)
        }}
      />
    </>
  )
}
