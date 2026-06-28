import { useState, useEffect, useRef } from 'react'
import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RecordClickFormDialog } from '@/components/RecordClickFormDialog'
import { RecordedClickListDialog } from '@/components/RecordedClickListDialog'
import { RecordActionButtons } from '@/components/RecordActionButtons'
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
  Camera,
} from 'lucide-react'
import { ScreenCanvas } from '@/components/ScreenCanvas'
import { showToast } from '@/components/ui/toast'

interface MirrorPanelProps {
  onTogglePanels?: () => void
  panelsVisible?: boolean
}

export function MirrorPanel({ onTogglePanels, panelsVisible }: MirrorPanelProps) {
  const { status, deviceInfo, errorMsg, connect, disconnect } = useDeviceStore()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // 录制模式状态
  const [isRecording, setIsRecording] = useState(false)
  const [recordCoord, setRecordCoord] = useState({ x: 0, y: 0 })
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showListDialog, setShowListDialog] = useState(false)
  const [canvasRect, setCanvasRect] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  // 截图状态
  const [isScreenshotting, setIsScreenshotting] = useState(false)

  const handleScreenshot = async () => {
    if (isScreenshotting || !isConnected) return
    setIsScreenshotting(true)
    try {
      const result = await window.electronAPI?.screenMirror?.screenshot()
      if (result?.success) {
        showToast('success', '截图已保存到桌面')
      } else {
        showToast('error', result?.error || '截图失败')
      }
    } catch (e) {
      showToast('error', '截图异常，请重试')
      console.error('截图失败', e)
    } finally {
      setIsScreenshotting(false)
    }
  }

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

  // 跟踪 canvas 位置和大小（用于蒙版定位）
  useEffect(() => {
    const updateRect = () => {
      const canvas = document.querySelector('canvas')
      const content = contentRef.current
      if (!canvas || !content) return
      const cr = canvas.getBoundingClientRect()
      const nr = content.getBoundingClientRect()
      setCanvasRect({
        top: cr.top - nr.top,
        left: cr.left - nr.left,
        width: cr.width,
        height: cr.height,
      })
    }

    // 初始更新
    requestAnimationFrame(updateRect)

    // 监听画布尺寸变化
    const observer = new ResizeObserver(updateRect)
    const canvas = document.querySelector('canvas')
    if (canvas) observer.observe(canvas)
    if (contentRef.current) observer.observe(contentRef.current)
    window.addEventListener('resize', updateRect)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
    }
  }, [isConnected, isMinimized])

  // 录制模式：点击蒙版 → 基于 canvas 元素直接映射坐标
  const handleOverlayClick = (e: React.MouseEvent) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dw = deviceInfo?.deviceWidth || 1
    const dh = deviceInfo?.deviceHeight || 1
    if (!rect.width || !rect.height) return
    setRecordCoord({
      x: Math.round((e.clientX - rect.left) * (dw / rect.width)),
      y: Math.round((e.clientY - rect.top) * (dh / rect.height)),
    })
    setShowFormDialog(true)
  }

  // 录制模式：右键穿透 → 直接执行点击事件到设备
  const handleOverlayContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dw = deviceInfo?.deviceWidth || 1
    const dh = deviceInfo?.deviceHeight || 1
    if (!rect.width || !rect.height) return
    const x = Math.round((e.clientX - rect.left) * (dw / rect.width))
    const y = Math.round((e.clientY - rect.top) * (dh / rect.height))
    window.electronAPI?.screenMirror?.tap(x, y)
  }

  // 录制模式：Escape 退出
  useEffect(() => {
    if (!isRecording) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRecording(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording])

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
      <div ref={contentRef} className="flex flex-1 items-center justify-center bg-black/5 relative overflow-hidden">
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

        {/* 向上/向下滑动按钮 - 画布右侧居中 */}
        {!isMinimized && canvasRect.width > 0 && (
          <div
            className="absolute z-20 flex flex-col gap-2"
            style={{
              top: canvasRect.top + canvasRect.height / 2 - 32,
              left: canvasRect.left + canvasRect.width + 6,
            }}
          >
            <button
              onClick={() => window.electronAPI?.screenMirror?.swipeUp()}
              disabled={!isConnected}
              className="flex h-7 w-7 items-center justify-center rounded-full border bg-background/90 shadow-sm text-muted-foreground hover:text-foreground hover:bg-background border-border disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              title="向上滑动"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
            <button
              onClick={() => window.electronAPI?.screenMirror?.swipeDown()}
              disabled={!isConnected}
              className="flex h-7 w-7 items-center justify-center rounded-full border bg-background/90 shadow-sm text-muted-foreground hover:text-foreground hover:bg-background border-border disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              title="向下滑动"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* 录制模式蒙版 - 基于 canvas 实际位置定位 */}
        {isRecording && canvasRect.width > 0 && (
          <div
            className="absolute z-30 bg-black/40 cursor-crosshair rounded-lg"
            style={{
              top: canvasRect.top,
              left: canvasRect.left,
              width: canvasRect.width,
              height: canvasRect.height,
            }}
            onClick={handleOverlayClick}
            onContextMenu={handleOverlayContextMenu}
          />
        )}

        {/* 录制 & 查看 & 截图按钮 - 浮动在投屏区域右上角 */}
        {!isMinimized && (
          <div className="absolute top-5 left-5 z-40 flex flex-col gap-1">
            <RecordActionButtons
              isRecording={isRecording}
              onToggleRecording={() => setIsRecording((v) => !v)}
              onOpenList={() => setShowListDialog(true)}
            />
            <div className="w-full border-t border-border/40 my-0.5" />
            <button
              onClick={handleScreenshot}
              disabled={!isConnected || isScreenshotting}
              className="flex h-7 w-7 items-center justify-center rounded-full shadow-md border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-background border-border disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              title="截图保存到桌面"
            >
              {isScreenshotting ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* 录制保存表单弹窗 */}
      <RecordClickFormDialog
        open={showFormDialog}
        onOpenChange={(v) => {
          setShowFormDialog(v)
          if (!v) {
            // 关闭弹窗但保持录制模式（用户可继续录制其他位置）
          }
        }}
        coord={recordCoord}
        onSaved={() => {
          // 保存成功后继续保持录制模式，让用户自行退出
        }}
      />

      {/* 录制模板列表弹窗 */}
      <RecordedClickListDialog
        open={showListDialog}
        onOpenChange={setShowListDialog}
      />

      {/* Bottom Device Info Bar */}
      {!isMinimized && (
        <div className="flex h-[40px] items-center justify-between border-t px-4 text-[11px]">
          <div className="flex items-center gap-2">
            {/* 录制模式状态 */}
            {isRecording && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
                <span className="text-red-500 font-medium animate-pulse">录制模式</span>
                <span className="text-muted-foreground/50 text-[10px] ml-1">左键录制 · 右键执行</span>
                <span className="text-muted-foreground/40 mx-1">|</span>
              </div>
            )}
            {isConnected && deviceInfo ? (
              <>
                <span className="text-green-500 font-medium">● 已连接</span>
                <span className="text-muted-foreground">{deviceInfo.model}</span>
              </>
            ) : (
              <span className="text-muted-foreground/50">
                ● {status === 'connecting' ? '连接中' : status === 'error' ? '错误' : '已断开'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {isConnected && deviceInfo && (
              <>
                <span>{deviceInfo.resolution}</span>
                <span>{deviceInfo.serial}</span>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
