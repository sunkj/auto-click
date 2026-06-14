import { useState, useEffect, useRef, useCallback } from 'react'
import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Smartphone,
  Monitor,
  Wifi,
  ArrowUpDown,
  RefreshCw,
  Crosshair,
  PanelLeftClose,
  Square,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react'

interface MirrorPanelProps {
  onTogglePanels?: () => void
}

/**
 * 使用 TinyH264Decoder 渲染视频流
 *
 * 将 IPC 帧事件转换为 ReadableStream，pipe 到 decoder.writable，
 * decoder 自动渲染到绑定的 Canvas 元素。
 */
function useScrcpyStream(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const decoderRef = useRef<any>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const frameCountRef = useRef(0)
  const streamRef = useRef<ReadableStream<any> | null>(null)
  const controllerRef = useRef<ReadableStreamDefaultController<any> | null>(null)
  const [streamActive, setStreamActive] = useState(false)

  useEffect(() => {
    const api = window.electronAPI?.screenMirror
    if (!api) return

    // 1. 创建 ReadableStream（持久化到 ref）
    if (!streamRef.current) {
      streamRef.current = new ReadableStream({
        start(controller) {
          controllerRef.current = controller
        },
        cancel() {
          controllerRef.current = null
        },
      })
    }

    // 2. 惰性初始化解码器（首次有帧时初始化）
    let decoderInitialized = false
    const ensureDecoder = async () => {
      if (decoderInitialized || decoderRef.current) return
      if (!canvasRef.current) return
      decoderInitialized = true
      try {
        const { TinyH264Decoder } = await import('@yume-chan/scrcpy-decoder-tinyh264')
        if (!canvasRef.current) return
        const decoder = new TinyH264Decoder({ canvas: canvasRef.current })
        decoderRef.current = decoder
        decoder.sizeChanged(({ width, height }: { width: number; height: number }) => {
          sizeRef.current = { width, height }
        })
        // pipe stream → decoder（只要一次）
        if (streamRef.current) {
          streamRef.current.pipeTo(decoder.writable).catch(() => {})
        }
      } catch (e) {
        console.error('[MirrorPanel] 解码器初始化失败:', e)
      }
    }

    // 3. IPC → stream
    const unsubFrame = api.onFrame((payload) => {
      if (payload.type === 'config') {
        ensureDecoder()
        controllerRef.current?.enqueue({
          type: 'configuration',
          data: new Uint8Array(payload.data),
        })
      } else if (payload.type === 'frame') {
        frameCountRef.current++
        setStreamActive(true)
        ensureDecoder()
        controllerRef.current?.enqueue({
          type: 'data',
          data: new Uint8Array(payload.data),
          keyframe: payload.keyframe,
          pts: payload.pts,
        })
      }
    })
    const unsubError = api.onError((msg) => {
      console.error('[MirrorPanel] 流错误:', msg)
    })

    return () => {
      unsubFrame()
      unsubError()
      // 注意: 不清除 ref，让解码器跨 StrictMode 重用
    }
  }, [])

  return { streamActive }
}

export function MirrorPanel({ onTogglePanels }: MirrorPanelProps) {
  const { status, deviceInfo, errorMsg, connect, disconnect } = useDeviceStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

  const isConnected = status === 'connected'
  const isLoading = status === 'connecting'

  useScrcpyStream(canvasRef)

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    })
  }

  const handleCanvasClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const api = window.electronAPI?.screenMirror
    if (!api || !isConnected) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)
    await api.tap(x, y)
  }, [isConnected])

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
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded-lg border shadow-inner cursor-crosshair max-w-[95%] max-h-[calc(100vh-120px)] object-contain"
              style={{ background: '#000' }}
            />
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
