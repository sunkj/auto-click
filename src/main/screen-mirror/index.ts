/**
 * 投屏管理模块
 *
 * Iteration 7: 设备连接管理 (adb devices)
 * Iteration 8: 投屏画面 (ESM 桥接进程 → IPC 帧事件 → Canvas)
 * Iteration 9: 投屏交互 (adb shell input)
 */
import { ipcMain, BrowserWindow } from 'electron'
import { execSync, spawn } from 'child_process'
import path from 'path'

// =============================================================================
// IPC 通道
// =============================================================================

export const SMC = {
  CONNECT: 'scrcpy:connect',
  DISCONNECT: 'scrcpy:disconnect',
  GET_DEVICES: 'scrcpy:getDevices',
  GET_STATUS: 'scrcpy:getStatus',
  TAP: 'scrcpy:tap',
  SWIPE: 'scrcpy:swipe',
  BACK: 'scrcpy:back',
  HOME: 'scrcpy:home',
  FRAME: 'scrcpy:frame',
  CONNECTED: 'scrcpy:connected',
  DISCONNECTED: 'scrcpy:disconnected',
  ERROR: 'scrcpy:error',
} as const

export interface SimpleDeviceInfo {
  serial: string
  model: string
  resolution: string
}

// =============================================================================
// 状态
// =============================================================================

let status: 'idle' | 'connecting' | 'connected' | 'error' = 'idle'
let deviceSerial: string | null = null
let deviceModel = ''

function send(channel: string, data?: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data))
}

// =============================================================================
// ADB 辅助
// =============================================================================

function adbExec(args: string): string {
  try {
    return execSync(`adb ${args}`, { encoding: 'utf-8', timeout: 5000 })
  } catch (e: any) {
    throw new Error(`ADB 错误: ${e.stderr || e.message}`)
  }
}

function adbShell(serial: string, cmd: string): string {
  return adbExec(`-s ${serial} shell ${cmd}`)
}

/** 解析 adb devices -l 输出 */
function parseDevices(output: string): SimpleDeviceInfo[] {
  const lines = output.trim().split('\n').slice(1) // 跳过 "List of devices attached"
  return lines
    .filter((l) => l.trim() && !l.includes('offline') && !l.includes('unauthorized'))
    .map((l) => {
      const parts = l.split(/\s+/)
      const serial = parts[0]
      const modelMatch = l.match(/model:([\S]+)/)
      return {
        serial,
        model: modelMatch?.[1] || serial,
        resolution: '',
      }
    })
}

/** 获取设备型号 */
function getDeviceModel(serial: string): string {
  try {
    const model = adbShell(serial, 'getprop ro.product.model').trim()
    return model || serial
  } catch {
    return serial
  }
}

// =============================================================================
// 视频流桥接进程管理
// =============================================================================

let bridgeProcess: import('child_process').ChildProcess | null = null

function startBridge(serial: string): void {
  stopBridge() // 先停旧的
  const bridgePath = path.join(__dirname, 'bridge.mjs')
  bridgeProcess = spawn('node', [bridgePath, serial], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let buffer = ''
  bridgeProcess.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)

        if (msg.type === 'meta') {
          if (msg.model) deviceModel = msg.model
          if (msg.width && msg.height) {
            send(SMC.FRAME, { type: 'meta', meta: { width: msg.width, height: msg.height } })
          }
        } else if (msg.type === 'config') {
          send(SMC.FRAME, { type: 'config', data: [...Buffer.from(msg.data, 'base64')] })
        } else if (msg.type === 'frame') {
          send(SMC.FRAME, {
            type: 'frame',
            data: [...Buffer.from(msg.data, 'base64')],
            keyframe: msg.keyframe,
            pts: msg.pts,
          })
        } else if (msg.type === 'error') {
          send(SMC.ERROR, msg.error)
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  })

  bridgeProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[bridge]', data.toString())
  })

  bridgeProcess.on('exit', (code) => {
    console.log('[bridge] 退出 code:', code)
    bridgeProcess = null
  })
}

function stopBridge(): void {
  if (bridgeProcess) {
    bridgeProcess.kill()
    bridgeProcess = null
  }
}

// =============================================================================
// IPC 注册
// =============================================================================

export function registerScrcpyHandlers(): void {
  ipcMain.handle(SMC.GET_STATUS, () => ({
    success: true,
    data: { status, serial: deviceSerial, model: deviceModel },
  }))

  ipcMain.handle(SMC.GET_DEVICES, async () => {
    try {
      const output = adbExec('devices -l')
      const devices = parseDevices(output)
      return { success: true, data: devices }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.CONNECT, async (_event, serial?: string) => {
    try {
      status = 'connecting'
      send(SMC.CONNECTED, 'connecting')

      const output = adbExec('devices -l')
      const devices = parseDevices(output)
      const target = devices.find((d) => d.serial === serial) || devices[0]
      if (!target) throw new Error('未发现可用设备（请确认 USB 调试已开启）')

      deviceSerial = target.serial
      deviceModel = getDeviceModel(target.serial)

      // 启动视频流桥接进程
      startBridge(target.serial)

      status = 'connected'
      send(SMC.CONNECTED, 'connected')
      return { success: true, data: { serial: target.serial, model: deviceModel, resolution: '' } }
    } catch (error) {
      status = 'error'
      send(SMC.ERROR, String(error))
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.DISCONNECT, async () => {
    try {
      stopBridge()
      status = 'idle'
      deviceSerial = null
      deviceModel = ''
      send(SMC.DISCONNECTED)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 触摸/按键控制
  // =========================================================================

  ipcMain.handle(SMC.TAP, async (_event, x: number, y: number) => {
    try {
      if (!deviceSerial) throw new Error('未连接设备')
      adbShell(deviceSerial, `input tap ${Math.round(x)} ${Math.round(y)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.SWIPE, async (_event, x1: number, y1: number, x2: number, y2: number, duration?: number) => {
    try {
      if (!deviceSerial) throw new Error('未连接设备')
      adbShell(deviceSerial, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration ?? 200}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.BACK, async () => {
    try {
      if (!deviceSerial) throw new Error('未连接设备')
      adbShell(deviceSerial, 'input keyevent 4')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.HOME, async () => {
    try {
      if (!deviceSerial) throw new Error('未连接设备')
      adbShell(deviceSerial, 'input keyevent 3')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
