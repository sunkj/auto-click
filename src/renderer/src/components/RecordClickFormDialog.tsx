import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Loader2, MousePointerClick } from 'lucide-react'

interface RecordClickFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  coord: { x: number; y: number }
  onSaved?: () => void
}

/**
 * 录制点击保存表单弹窗
 *
 * 在录制模式下点击蒙版后弹出，自动填入坐标(x,y)和type="click"，
 * 用户填写名称后保存。
 */
export function RecordClickFormDialog({
  open,
  onOpenChange,
  coord,
  onSaved,
}: RecordClickFormDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 每次打开时重置表单
  useEffect(() => {
    if (open) {
      setName('')
      setError('')
      setSaving(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入名称')
      return
    }

    setSaving(true)
    setError('')

    try {
      const api = window.electronAPI?.recordedClick
      if (!api) throw new Error('recordedClick API 不可用')
      const result = await api.create({ name: trimmed, x: coord.x, y: coord.y, type: 'click' })
      if (!result.success) throw new Error(result.error || '保存失败')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>录制点击事件</DialogTitle>
        </DialogHeader>

        {/* 类型选择 - 参照添加步骤弹窗样式，仅保留点击 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">类型</label>
          <div className="grid grid-cols-1 gap-2">
            <div
              className={cn(
                'flex items-center gap-2 py-2.5 px-3 rounded-lg border transition-colors'
              )}
            >
              <MousePointerClick className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">点击</span>
              <span className="text-[11px] text-muted-foreground/60 ml-auto">click</span>
            </div>
          </div>
        </div>

        {/* 名称 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">名称</label>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="例如：点击微信"
            disabled={saving}
            className={error ? 'border-red-500' : ''}
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        {/* 坐标 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">坐标 X</label>
            <Input value={coord.x} disabled className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">坐标 Y</label>
            <Input value={coord.y} disabled className="text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
