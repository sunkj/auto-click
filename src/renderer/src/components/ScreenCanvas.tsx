import { useState, useEffect, useRef } from 'react'

interface ScreenCanvasProps {
  isConnected: boolean
}

/**
 * 投屏画布组件
 *
 * 管理 TinyH264Decoder 视频流解码、Canvas 渲染和点击交互。
 */
export function ScreenCanvas({ isConnected }: ScreenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streamActive, setStreamActive] = useState(false)

  // 视频流 hook（内联管理生命周期）
  const decoderRef = useRef<any>(null)
  const streamRef = useRef<ReadableStream<any> | null>(null)
  const controllerRef = useRef<ReadableStreamDefaultController<any> | null>(null)

  useEffect(() => {
    const api = window.electronAPI?.screenMirror
    if (!api) return

    // 1. 创建 ReadableStream（持久化）
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

    // 2. 惰性初始化解码器
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
        if (streamRef.current) {
          streamRef.current.pipeTo(decoder.writable).catch(() => {})
        }
      } catch (e) {
        console.error('[ScreenCanvas] 解码器初始化失败:', e)
      }
    }

    // 3. IPC → stream
    const unsubFrame = api.onFrame((payload) => {
      if (payload.type === 'config') {
        ensureDecoder()
        controllerRef.current?.enqueue({ type: 'configuration', data: new Uint8Array(payload.data) })
      } else if (payload.type === 'frame') {
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
    const unsubError = api.onError((msg) => console.error('[ScreenCanvas] 流错误:', msg))

    return () => {
      unsubFrame()
      unsubError()
    }
  }, [])

  // 点击事件 → 设备坐标 tap
  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  }

  if (!isConnected) return null

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="rounded-lg border shadow-inner cursor-crosshair max-w-[95%] max-h-[calc(100vh-120px)] object-contain"
      style={{ background: '#000' }}
    />
  )
}
