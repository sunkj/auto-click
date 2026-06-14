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
  Crosshair,
  PanelLeftClose,
  Square,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react'
import { ScreenCanvas } from '@/components/ScreenCanvas'

interface MirrorPanelProps {
  onTogglePanels?: () => void
}

export function MirrorPanel({ onTogglePanels }: MirrorPanelProps) {
  const { status, deviceInfo, errorMsg, connect, disconnect } = useDeviceStore()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

  const isConnected = status === 'connected'
  const isLoading = status === 'connecting'

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
        <div className="flex items-center gap-3">
          {onTogglePanels && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePanels} title="收起侧边栏">
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
            <span>{videoSize.width ? `${videoSize.width}×${videoSize.height}` : '1920×1080'}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={connect} disabled={isConnected || isLoading} title="连接设备">
              <Smartphone className="h-3 w-3" />
              {isLoading ? '连接中...' : '连接'}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-destructive" onClick={disconnect} disabled={!isConnected} title="断开连接">
              <Square className="h-3 w-3" />
              断开
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" disabled={!isConnected} title="返回键" onClick={() => window.electronAPI?.screenMirror?.back()}>
              <ArrowLeft className="h-3 w-3" />
              返回
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" disabled={!isConnected} title="回到首页" onClick={() => window.electronAPI?.screenMirror?.home()}>
              <RotateCcw className="h-3 w-3" />
              Home
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/70">
            <Crosshair className="h-3 w-3" />
            <span>X: {isHovering ? mousePos.x : '-'} Y: {isHovering ? mousePos.y : '-'}</span>
          </div>
          {!isConnected && (
            <Badge variant="outline" className="h-5 text-[10px] font-normal text-muted-foreground/50">未连接</Badge>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex flex-1 items-center justify-center bg-black/5"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0, y: 0 }) }}
      >
        {!isConnected ? (
          <div className="flex flex-col items-center gap-6 max-w-sm text-center select-none">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Smartphone className="h-10 w-10 text-muted-foreground/30" />
              </div>
            </div>
            <Button onClick={connect} disabled={isLoading} size="lg" className="h-12 px-8 text-base gap-2 shadow-md">
              <Smartphone className="h-5 w-5" />
              {isLoading ? '连接中...' : '连接设备'}
            </Button>
            {errorMsg && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm max-w-xs">
                {errorMsg}
              </div>
            )}
            <div className="space-y-1 text-xs text-muted-foreground/60">
              <p>请通过 USB 连接您的 Android 设备</p>
              <p>确保已开启开发者选项和 USB 调试</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <ScreenCanvas isConnected={isConnected} />
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
              <span>{deviceInfo.serial}</span>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground/50">● {status === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'}</span>
        )}
      </div>
    </main>
  )
}
