import { useState, useEffect, useRef } from 'react'
import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Smartphone,
  Monitor,
  Wifi,
  ArrowUpDown,
  Crosshair,
  PanelLeftClose,
  Minimize2,
  Maximize2,
  Square,
  ArrowLeft,
  Home,
} from 'lucide-react'
import { ScreenCanvas } from '@/components/ScreenCanvas'
import { AiFloatingAssistant } from '@/components/AiFloatingAssistant'

interface MirrorPanelProps {
  onTogglePanels?: () => void
  panelsVisible?: boolean
}

export function MirrorPanel({ onTogglePanels, panelsVisible }: MirrorPanelProps) {
  const { status, deviceInfo, errorMsg, connect, disconnect } = useDeviceStore()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const isConnected = status === 'connected'
  const isLoading = status === 'connecting'

  // 连接后过渡：成功后继续 loading 3 秒，再隐藏遮盖层露出投屏
  const [hideOverlay, setHideOverlay] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status

    if (status !== 'connected') {
      setHideOverlay(false)
      setIsTransitioning(false)
      return
    }

    // 从 connecting → connected：进入过渡期，继续 loading 3 秒
    if (prev === 'connecting' && status === 'connected') {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setHideOverlay(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  // 仅在画布区域内更新鼠标坐标
  const handleCanvasMove = (x: number, y: number) => setMousePos({ x, y })
  const handleCanvasEnter = () => setIsHovering(true)
  const handleCanvasLeave = () => { setIsHovering(false); setMousePos({ x: 0, y: 0 }) }

  // 最小化/还原
  const [prevPanelsVisible, setPrevPanelsVisible] = useState(false)

  const handleToggleMinimize = async () => {
    if (isMinimized) {
      // 还原窗口
      await window.electronAPI?.window?.restoreSize?.()
      setIsMinimized(false)
      // 恢复之前的面板状态
      if (prevPanelsVisible) onTogglePanels?.()
    } else {
      // 记住面板状态，如果展开则先收起
      setPrevPanelsVisible(!!panelsVisible)
      if (panelsVisible) onTogglePanels?.()
      // 窗口宽度固定 328px，高度按设备比例 + 工具栏
      const dw = deviceInfo?.deviceWidth || 1080
      const dh = deviceInfo?.deviceHeight || 2400
      const w = 328
      const h = Math.round(w * (dh / dw)) + 40
      await window.electronAPI?.window?.resizeToScreen?.(w, h)
      setIsMinimized(true)
    }
  }

  // 收起/展开侧边栏：同时还原窗口
  const handleTogglePanels = () => {
    if (isMinimized) {
      window.electronAPI?.window?.restoreSize?.()
      setIsMinimized(false)
    }
    onTogglePanels?.()
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex h-[40px] items-center justify-between border-b px-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {onTogglePanels && !isMinimized && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleTogglePanels} title="收起侧边栏">
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          {onTogglePanels && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleMinimize} title={isMinimized ? '还原窗口' : '最小化投屏'}>
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
          )}
          {!isMinimized && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <Wifi className={`h-3.5 w-3.5 ${deviceInfo?.transport === 'wi-fi' ? 'text-blue-400' : 'text-muted-foreground/50'}`} />
                <span>{deviceInfo?.transport === 'wi-fi' ? 'Wi-Fi' : 'USB'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>{deviceInfo?.deviceWidth ? `${deviceInfo.deviceWidth}×${deviceInfo.deviceHeight}` : '-'}</span>
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
                  <Home className="h-3 w-3" />
                  首页
                </Button>
              </div>
            </>
          )}
        </div>

        {!isMinimized && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/70">
              <Crosshair className="h-3 w-3" />
              <span>X: {isHovering ? mousePos.x : '-'} Y: {isHovering ? mousePos.y : '-'}</span>
            </div>
            {!isConnected && (
              <Badge variant="outline" className="h-5 text-[10px] font-normal text-muted-foreground/50">未连接</Badge>
            )}
          </div>
        )}
      </div>

      {/* Content Area — 投屏在底层，遮盖层在顶层 */}
      <div className="flex flex-1 items-center justify-center bg-black/5 relative overflow-hidden">
        {/* 底层：投屏画布（始终渲染） */}
        <div className={`flex flex-col items-center absolute inset-0 ${isMinimized ? 'gap-0 py-0' : 'gap-2 py-2'}`}>
          <ScreenCanvas
            isConnected={isConnected}
            deviceWidth={deviceInfo?.deviceWidth}
            deviceHeight={deviceInfo?.deviceHeight}
            isMinimized={isMinimized}
            onMouseMove={handleCanvasMove}
            onMouseEnter={handleCanvasEnter}
            onMouseLeave={handleCanvasLeave}
          />
        </div>

        {/* 顶层：遮盖层（连接按钮 / 加载动画），连接成功 3 秒后渐出 */}
        <div
          className="flex flex-col items-center justify-center absolute inset-0 z-10 bg-background transition-opacity duration-700 ease-in-out"
          style={{
            opacity: hideOverlay ? 0 : 1,
            pointerEvents: hideOverlay ? 'none' : 'auto',
          }}
        >
          {isLoading || isTransitioning ? (
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                <Smartphone className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground/40" />
              </div>
              <div className="text-sm text-muted-foreground">{isTransitioning ? '连接成功，正在加载投屏...' : '正在连接设备...'}</div>
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 max-w-sm text-center select-none">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Smartphone className="h-10 w-10 text-muted-foreground/30" />
                </div>
              </div>
              <Button onClick={connect} size="lg" className="h-12 px-8 text-base gap-2 shadow-md">
                <Smartphone className="h-5 w-5" />
                连接设备
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
          )}
        </div>
      </div>

      {/* AI 助手浮动按钮 + 面板 */}
      {!isMinimized && <AiFloatingAssistant />}

      {/* Bottom Device Info Bar */}
      {!isMinimized && (
        <div className="flex h-[40px] items-center justify-between border-t px-4 text-[11px]">
          {isConnected && deviceInfo ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-medium">● 已连接</span>
                <span className="text-muted-foreground">{deviceInfo.model}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{deviceInfo.resolution}</span>
                <span>{deviceInfo.serial}</span>
              </div>
            </>
          ) : (
            <span className="text-muted-foreground/50">
              ● {status === 'connecting' ? '连接中' : status === 'error' ? '错误' : '已断开'}
            </span>
          )}
        </div>
      )}
    </main>
  )
}
