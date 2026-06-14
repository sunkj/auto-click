import { useState, useEffect, useRef, useCallback } from 'react'

interface ScreenCanvasProps {
  isConnected: boolean
  deviceWidth?: number
  deviceHeight?: number
  isMinimized?: boolean
  onMouseMove?: (x: number, y: number) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

// =============================================================================
// 坐标映射：canvas 内部像素 ↔ 设备物理坐标
//
// 核心思路：
// 1. 解码器（TinyH264Decoder）设置 canvas.width/height 为视频真实分辨率
// 2. 我们手动计算 canvas CSS 尺寸（等比缩放），不依赖 object-fit
// 3. canvas 内容填满整个 CSS 框（object-fit: fill），无留白
// 4. 坐标映射 = 鼠标偏移 × (视频分辨率 / CSS 尺寸)
// =============================================================================

/** 计算画布在容器内的最佳显示尺寸（等比缩放） */
function calcDisplaySize(
  vw: number,
  vh: number,
  containerW: number,
  containerH: number,
) {
  const scale = Math.min(containerW / vw, containerH / vh, 1)
  return {
    width: Math.round(vw * scale),
    height: Math.round(vh * scale),
  }
}

/** 滑动有效的最小物理像素距离 */
const SWIPE_MIN_DISTANCE = 10
/** 滑动距离倍率：实际拖拽 × 倍率 = 发送给设备的 swipe 距离（让滚动更明显） */
const SWIPE_DISTANCE_MULTIPLIER = 3

/**
 * 投屏画布组件
 *
 * 管理 TinyH264Decoder 视频流解码、Canvas 渲染、点击和滑动交互。
 */
export function ScreenCanvas({ isConnected, deviceWidth, deviceHeight, isMinimized, onMouseMove, onMouseEnter, onMouseLeave }: ScreenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 视频分辨率（由解码器设置后读取）
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })
  // CSS 显示尺寸
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

  // 视频流
  const decoderRef = useRef<any>(null)
  const streamRef = useRef<ReadableStream<any> | null>(null)
  const controllerRef = useRef<ReadableStreamDefaultController<any> | null>(null)

  // 拖拽状态
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)

  // ref 穿透
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected
  const videoSizeRef = useRef(videoSize)
  videoSizeRef.current = videoSize
  const deviceSizeRef = useRef({ width: deviceWidth || 0, height: deviceHeight || 0 })
  deviceSizeRef.current = { width: deviceWidth || 0, height: deviceHeight || 0 }

  // ===========================================================================
  // 视频流与解码器初始化（只执行一次）
  // ===========================================================================
  useEffect(() => {
    const api = window.electronAPI?.screenMirror
    if (!api) return

    // 1. ReadableStream
    if (!streamRef.current) {
      streamRef.current = new ReadableStream({
        start(controller) { controllerRef.current = controller },
        cancel() { controllerRef.current = null },
      })
    }

    // 2. 惰性解码器
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
        streamRef.current?.pipeTo(decoder.writable).catch(() => {})
      } catch (e) {
        console.error('[ScreenCanvas] 解码器初始化失败:', e)
      }
    }

    // 3. IPC 帧 → stream，同时检测视频分辨率
    let metaHandled = false
    const unsubFrame = api.onFrame((payload) => {
      // 尝试从 meta 消息获取分辨率
      if (!metaHandled && payload.type === 'meta' && payload.meta) {
        const { width, height } = payload.meta
        if (width && height) {
          metaHandled = true
          const c = canvasRef.current
          if (c) { c.width = width; c.height = height }
          setVideoSize({ width, height })
        }
      }
      // config / frame
      if (payload.type === 'config') {
        ensureDecoder()
        controllerRef.current?.enqueue({ type: 'configuration', data: new Uint8Array(payload.data) })
      } else if (payload.type === 'frame') {
        ensureDecoder()
        controllerRef.current?.enqueue({
          type: 'data',
          data: new Uint8Array(payload.data),
          keyframe: payload.keyframe,
          pts: payload.pts,
        })
        // 第一次收到帧时，从 canvas 属性读取分辨率（解码器已设置）
        if (!metaHandled) {
          const c = canvasRef.current
          if (c && c.width > 0 && c.height > 0) {
            metaHandled = true
            setVideoSize({ width: c.width, height: c.height })
          }
        }
      }
    })
    const unsubError = api.onError((msg) => console.error('[ScreenCanvas] 流错误:', msg))

    return () => { unsubFrame(); unsubError() }
  }, [])

  // ===========================================================================
  // 当视频分辨率或窗口尺寸变化时，重新计算显示尺寸
  // 最小化模式：全屏无工具栏，高度用 window.innerHeight
  // ===========================================================================
  useEffect(() => {
    if (!videoSize.width || !videoSize.height) return

    const recalc = () => {
      const maxW = window.innerWidth
      const maxH = isMinimized ? window.innerHeight - 40 : window.innerHeight - 100
      setDisplaySize(calcDisplaySize(videoSize.width, videoSize.height, maxW, maxH))
    }

    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [videoSize, isMinimized])

  // ===========================================================================
  // 鼠标事件
  // ===========================================================================

  /** 将 canvas CSS 坐标映射为设备物理坐标
   *
   * canvas.width 是 scrcpy 流分辨率（maxSize 缩放后，如 324×720），
   * 而 adb shell input tap 使用设备真实分辨率（如 1080×2400）。
   * 所以必须用 deviceWidth/deviceHeight 做映射。
   */
  const toDevice = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const { width: dw, height: dh } = deviceSizeRef.current
      if (!dw || !dh || !rect.width || !rect.height) return null
      return {
        x: Math.round((clientX - rect.left) * (dw / rect.width)),
        y: Math.round((clientY - rect.top) * (dh / rect.height)),
      }
    },
    [],
  )

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const dev = toDevice(e.clientX, e.clientY)
    if (dev) onMouseMove?.(dev.x, dev.y)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const dev = toDevice(e.clientX, e.clientY)
    dragRef.current = dev ? { startX: dev.x, startY: dev.y } : null
  }, [toDevice])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null

    const api = window.electronAPI?.screenMirror
    if (!api || !isConnectedRef.current) return

    const dev = toDevice(e.clientX, e.clientY)
    if (!dev) return

    if (!drag) {
      api.tap(dev.x, dev.y)
      return
    }

    const dx = dev.x - drag.startX
    const dy = dev.y - drag.startY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < SWIPE_MIN_DISTANCE) {
      api.tap(dev.x, dev.y)
    } else {
      // 放大拖拽距离，让滚动更明显
      const endX = drag.startX + dx * SWIPE_DISTANCE_MULTIPLIER
      const endY = drag.startY + dy * SWIPE_DISTANCE_MULTIPLIER
      api.swipe(drag.startX, drag.startY, Math.round(endX), Math.round(endY))
    }
  }, [toDevice])

  if (!isConnected) return null

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => onMouseEnter?.()}
      onMouseLeave={() => {
        dragRef.current = null
        onMouseLeave?.()
      }}
      className="rounded-lg border shadow-inner cursor-crosshair"
      style={{
        width: displaySize.width > 0 ? displaySize.width : 300,
        height: displaySize.height > 0 ? displaySize.height : 200,
        background: '#000',
      }}
    />
  )
}
