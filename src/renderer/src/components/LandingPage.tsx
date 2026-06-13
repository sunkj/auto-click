import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import {
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Settings,
} from 'lucide-react'

interface LandingPageProps {
  onTogglePanels: () => void
  panelsVisible: boolean
}

export function LandingPage({ onTogglePanels, panelsVisible }: LandingPageProps) {
  const { connect } = useDeviceStore()

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Icon Bar */}
      <div className="flex h-[40px] shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-1">
          {/* Collapse/Expand Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onTogglePanels}
            title={panelsVisible ? '收起侧边栏' : '展开侧边栏'}
          >
            {panelsVisible ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="菜单">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="设置">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center select-none">
          {/* Phone Icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <Smartphone className="h-10 w-10 text-muted-foreground/30" />
            </div>
          </div>

          {/* Connect Button */}
          <Button
            onClick={connect}
            size="lg"
            className="h-12 px-8 text-base gap-2 shadow-md"
          >
            <Smartphone className="h-5 w-5" />
            连接设备
          </Button>

          {/* Instructions */}
          <div className="space-y-1 text-xs text-muted-foreground/60">
            <p>请通过 USB 连接您的 Android 设备</p>
            <p>确保已开启开发者选项和 USB 调试</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex h-[28px] shrink-0 items-center justify-between border-t px-4 text-[11px]">
        <span className="text-muted-foreground/50">● DISCONNECTED</span>
        <span className="text-muted-foreground/40">v1.0.0</span>
      </div>
    </div>
  )
}
