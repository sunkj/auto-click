import { useState } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Monitor,
  Terminal,
} from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'device' | 'script'

const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'device', label: '设备', icon: Monitor },
  { id: 'script', label: '脚本', icon: Terminal },
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('device')
  const [settings, setSettings] = useState({
    adbPath: '',
    scrcpyPath: '',
    screenshotDir: '',
    scriptTimeout: '1800',
    maxRetries: '3',
    stepInterval: '0.5',
  })

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    // TODO: persist settings
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[560px]">
      <DialogHeader>
        <DialogTitle>系统设置</DialogTitle>
        <DialogDescription>配置应用参数和偏好</DialogDescription>
      </DialogHeader>

      <div className="flex gap-4 min-h-[300px]">
        {/* Sidebar tabs */}
        <div className="w-28 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Tab content */}
        <div className="flex-1 space-y-4">
          {activeTab === 'device' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">ADB 路径</label>
                <Input
                  placeholder="/usr/local/bin/adb"
                  value={settings.adbPath}
                  onChange={(e) => handleChange('adbPath', e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">留空则使用系统 PATH 中的 adb</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">scrcpy 路径</label>
                <Input
                  placeholder="/usr/local/bin/scrcpy"
                  value={settings.scrcpyPath}
                  onChange={(e) => handleChange('scrcpyPath', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">截图保存目录</label>
                <Input
                  placeholder="~/Pictures/autoclick"
                  value={settings.screenshotDir}
                  onChange={(e) => handleChange('screenshotDir', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}

          {activeTab === 'script' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">脚本超时时间（秒）</label>
                <Input
                  type="number"
                  value={settings.scriptTimeout}
                  onChange={(e) => handleChange('scriptTimeout', e.target.value)}
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
                  value={settings.stepInterval}
                  onChange={(e) => handleChange('stepInterval', e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">每步骤执行完成后的等待时间</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">最大重试次数</label>
                <Input
                  type="number"
                  value={settings.maxRetries}
                  onChange={(e) => handleChange('maxRetries', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button size="sm" onClick={handleSave}>
          保存
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
