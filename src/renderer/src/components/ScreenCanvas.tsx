import { useState, useEffect, useRef, useCallback } from 'react'
import { showToast } from '@/components/ui/toast'

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
  // 音频流播放（Opus → WebCodecs AudioDecoder → AudioContext）
  // ===========================================================================
  useEffect(() => {
    const api = window.electronAPI?.screenMirror
    if (!api) return

    let audioCtx: AudioContext | null = null
    let audioDecoder: AudioDecoder | null = null
    let isAudioActive = false

    // 待播放队列
    const pendingFrames: AudioData[] = []

    // 基于 AudioContext.currentTime 的精确调度，消除传统 onended 间隙
    let nextPlayTime = 0
    let scheduledCount = 0

    /** 将 AudioData 帧的数据拷贝到 AudioBuffer 的指定偏移位置 */
    function copyFrameToBuffer(frame: AudioData, audioBuffer: AudioBuffer, offset: number): number {
      const numChannels = frame.numberOfChannels
      const fmt = frame.format

      if (fmt === 'f32-planar') {
        const planeBytes = frame.allocationSize({ planeIndex: 0 })
        const samplesPerPlane = planeBytes / 4
        const pcmLeft = new Float32Array(samplesPerPlane)
        frame.copyTo(pcmLeft, { planeIndex: 0, frameOffset: 0, frameCount: frame.numberOfFrames })
        audioBuffer.getChannelData(0).set(pcmLeft, offset)
        if (numChannels > 1) {
          const pcmRight = new Float32Array(samplesPerPlane)
          frame.copyTo(pcmRight, { planeIndex: 1, frameOffset: 0, frameCount: frame.numberOfFrames })
          audioBuffer.getChannelData(1).set(pcmRight, offset)
        }
      } else if (fmt === 's16') {
        const totalBytes = frame.allocationSize({ planeIndex: 0 })
        const totalSamples = totalBytes / 2
        const intData = new Int16Array(totalSamples)
        frame.copyTo(intData, { planeIndex: 0, frameOffset: 0, frameCount: frame.numberOfFrames })
        const left = audioBuffer.getChannelData(0)
        const right = audioBuffer.getChannelData(1)
        for (let i = 0; i < frame.numberOfFrames; i++) {
          left[offset + i] = intData[i * numChannels] / 32768
          if (numChannels > 1) right[offset + i] = intData[i * numChannels + 1] / 32768
        }
      } else if (fmt === 's16-planar') {
        const planeBytes = frame.allocationSize({ planeIndex: 0 })
        const samplesPerPlane = planeBytes / 2
        const pcmLeft = new Int16Array(samplesPerPlane)
        frame.copyTo(pcmLeft, { planeIndex: 0, frameOffset: 0, frameCount: frame.numberOfFrames })
        const left = audioBuffer.getChannelData(0)
        for (let i = 0; i < frame.numberOfFrames; i++) {
          left[offset + i] = pcmLeft[i] / 32768
        }
        if (numChannels > 1) {
          const pcmRight = new Int16Array(samplesPerPlane)
          frame.copyTo(pcmRight, { planeIndex: 1, frameOffset: 0, frameCount: frame.numberOfFrames })
          const right = audioBuffer.getChannelData(1)
          for (let i = 0; i < frame.numberOfFrames; i++) {
            right[offset + i] = pcmRight[i] / 32768
          }
        }
      } else {
        // f32-interleaved 或其它浮点交错格式
        const totalBytes = frame.allocationSize({ planeIndex: 0 })
        const totalSamples = totalBytes / 4
        const interleaved = new Float32Array(totalSamples)
        frame.copyTo(interleaved, { planeIndex: 0, frameOffset: 0, frameCount: frame.numberOfFrames })
        const left = audioBuffer.getChannelData(0)
        const right = audioBuffer.getChannelData(1)
        for (let i = 0; i < frame.numberOfFrames; i++) {
          left[offset + i] = interleaved[i * numChannels]
          if (numChannels > 1) right[offset + i] = interleaved[i * numChannels + 1]
        }
      }
      return frame.numberOfFrames
    }

    /** 精简 flush：不用 isPlaying/onended 闸门，用 schedule 消除间隙 */
    function flushPlayback() {
      if (!audioCtx || pendingFrames.length === 0) return

      // 若队列堆积太多（音频严重落后画面），丢弃旧帧追赶
      if (pendingFrames.length > 12) {
        const excess = pendingFrames.length - 4
        const dropped = pendingFrames.splice(0, excess)
        dropped.forEach(f => f.close())
      }

      const framesToPlay = pendingFrames.splice(0)
      const totalFrames = framesToPlay.reduce((sum, f) => sum + f.numberOfFrames, 0)
      const sampleRate = framesToPlay[0].sampleRate
      const numChannels = framesToPlay[0].numberOfChannels

      const audioBuffer = audioCtx.createBuffer(numChannels, totalFrames, sampleRate)

      let offset = 0
      for (const frame of framesToPlay) {
        try {
          offset += copyFrameToBuffer(frame, audioBuffer, offset)
        } catch (e) {
          console.error('[audio] copyTo error:', e)
        }
        frame.close()
      }

      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)

      // 精确调度：保证衔接无间隙
      const now = audioCtx.currentTime
      if (nextPlayTime < now) nextPlayTime = now
      source.start(nextPlayTime)
      nextPlayTime += audioBuffer.duration
      scheduledCount++
    }

    const unsubAudioConfig = api.onAudioConfig(async (payload) => {
      try {
        console.log('[audio] 收到音频配置')
        if (audioDecoder) {
          audioDecoder.close()
          audioDecoder = null
        }
        if (!audioCtx) {
          audioCtx = new AudioContext({ sampleRate: 48000 })
        }
        // 恢复自动播放
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        // 解码 base64 Opus identification header
        const binaryStr = atob(payload.data)
        const headerBytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) headerBytes[i] = binaryStr.charCodeAt(i)

        console.log('[audio] Opus header 长度:', headerBytes.length, '内容:', Array.from(headerBytes.slice(0, 8)))

        audioDecoder = new AudioDecoder({
          output: (frame: AudioData) => {
            // console.log('[audio] 解码输出帧:', frame.numberOfFrames, 'samples,', frame.sampleRate, 'Hz,', frame.numberOfChannels, 'ch')
            pendingFrames.push(frame)
            // 直接调度，不额外 setTimeout 延迟
            flushPlayback()
          },
          error: (e) => {
            console.error('[audio] AudioDecoder 错误:', e.message, e)
          },
        })

        audioDecoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          description: headerBytes,
        })

        console.log('[audio] AudioDecoder 配置完成, state:', audioDecoder.state)
        isAudioActive = true
        showToast('success', '音频同步已开启')
      } catch (e) {
        console.error('[audio] 音频初始化失败:', e)
        showToast('error', '音频同步初始化失败')
      }
    })

    const unsubAudioFrame = api.onAudioFrame((payload) => {
      if (!audioDecoder || !isAudioActive) return

      try {
        const binaryStr = atob(payload.data)
        const frameBytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) frameBytes[i] = binaryStr.charCodeAt(i)

        const chunk = new EncodedAudioChunk({
          type: 'key',
          timestamp: payload.pts ? Math.round(payload.pts * 1000) : 0,
          data: frameBytes,
        })
        audioDecoder.decode(chunk)
      } catch (e) {
        console.error('[audio] decode error:', e)
      }
    })

    return () => {
      unsubAudioConfig()
      unsubAudioFrame()
      if (audioDecoder) {
        audioDecoder.close()
        audioDecoder = null
      }
      if (audioCtx) {
        audioCtx.close()
        audioCtx = null
      }
      isAudioActive = false
      // 清理待播放帧
      pendingFrames.forEach(f => f.close())
      pendingFrames.length = 0
      scheduledCount = 0
      nextPlayTime = 0
    }
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
