import { useState } from 'react'
import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Smartphone,
  Monitor,
  Wifi,
  ArrowUpDown,
  Play,
  Square,
  RefreshCw,
  Crosshair,
  PanelLeftClose,
} from 'lucide-react'

interface MirrorPanelProps {
  onTogglePanels?: () => void
}

export function MirrorPanel({ onTogglePanels }: MirrorPanelProps) {
  const { isConnected, deviceInfo, connect, disconnect } = useDeviceStore()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isRunning, setIsRunning] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    })
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-b px-3 text-xs text-muted-foreground">
        {/* Left: connection info */}
        <div className="flex items-center gap-3">
          {/* Collapse/Expand Toggle */}
          {onTogglePanels && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onTogglePanels}
                title="收起侧边栏"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            <span>投屏</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            <span>USB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>1920×1080</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          {/* Run / Stop / Refresh buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs gap-1 ${isRunning ? 'text-green-500' : ''}`}
              onClick={connect}
              disabled={isRunning || !isConnected}
              title="运行脚本"
            >
              <Smartphone className="h-3 w-3" />
              连接
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1 text-destructive"
              onClick={disconnect}
              disabled={!isRunning}
              title="停止"
            >
              <Square className="h-3 w-3" />
              断开
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              disabled={!isConnected}
              title="刷新连接"
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </Button>
          </div>
        </div>

        {/* Right: mouse coordinates */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/70">
            <Crosshair className="h-3 w-3" />
            <span>
              X: {isHovering ? mousePos.x : '-'} Y: {isHovering ? mousePos.y : '-'}
            </span>
          </div>
          {!isConnected && (
            <Badge variant="outline" className="h-5 text-[10px] font-normal text-muted-foreground/50">
              未连接
            </Badge>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex flex-1 items-center justify-center"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0, y: 0 }) }}
      >
        {!isConnected ? (
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
        ) : (
          /* Connected State - Screen Mirroring Canvas */
          <div className="flex flex-col items-center gap-4 px-4 py-2">
            <div
              className="relative w-[360px] h-[720px] rounded-lg bg-card border shadow-inner overflow-hidden cursor-crosshair"
              onMouseMove={handleMouseMove}
            >
              {/* Screen content placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="h-16 w-16 mx-auto text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/40 mt-2">屏幕画面</p>
                </div>
              </div>

              {/* Running indicator */}
              {isRunning && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-[10px] text-red-500 font-medium">REC</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Device Info Bar */}
      <div className="flex h-[40px] items-center justify-between border-t px-4 text-[11px]">
        {isConnected && deviceInfo ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-green-500 font-medium">● CONNECTED</span>
              <span className="text-muted-foreground">{deviceInfo.model}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{deviceInfo.resolution}</span>
              <span>{deviceInfo.battery}%</span>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground/50">● DISCONNECTED</span>
        )}
      </div>
    </main>
  )
}
