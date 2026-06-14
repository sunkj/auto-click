import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [scriptTimeout, setScriptTimeout] = useState('1800')
  const [stepInterval, setStepInterval] = useState('0.5')
  const [maxRetries, setMaxRetries] = useState('3')
  const [loading, setLoading] = useState(false)

  // 打开时加载配置
  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.electronAPI?.config?.load().then((cfg: any) => {
      if (cfg) {
        setScriptTimeout(String(cfg.scriptTimeout ?? 1800))
        setStepInterval(String(cfg.stepInterval ?? 0.5))
        setMaxRetries(String(cfg.maxRetries ?? 3))
      }
    }).finally(() => setLoading(false))
  }, [open])

  const handleSave = async () => {
    await window.electronAPI?.config?.save({
      scriptTimeout: Number(scriptTimeout) || 1800,
      stepInterval: Number(stepInterval) || 0.5,
      maxRetries: Number(maxRetries) || 3,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>系统设置</DialogTitle>
        <DialogDescription>配置脚本执行参数</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">脚本超时时间（秒）</label>
          <Input
            type="number"
            value={scriptTimeout}
            onChange={(e) => setScriptTimeout(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">脚本执行超过此时间将自动终止</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">步骤执行间隔（秒）</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={stepInterval}
            onChange={(e) => setStepInterval(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">每步骤执行完成后的等待时间</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">最大重试次数</label>
          <Input
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button size="sm" onClick={handleSave} disabled={loading}>
          保存
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
