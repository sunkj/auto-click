/**
 * 投屏管理模块入口
 *
 * 注册所有投屏相关的 IPC 处理器，协调 adb / bridge / control 子模块。
 */
import { ipcMain, BrowserWindow } from 'electron'
import { SMC } from './channels'
import { adb } from './adb'
import { bridge } from './bridge-manager'
import { ctrl } from './control'

// =============================================================================
// 状态
// =============================================================================

let status: 'idle' | 'connecting' | 'connected' | 'error' = 'idle'
let deviceModel = ''

function send(channel: string, data?: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data))
}

// =============================================================================
// IPC 注册
// =============================================================================

export function registerScrcpyHandlers(): void {
  ipcMain.handle(SMC.GET_STATUS, () => ({
    success: true,
    data: { status, serial: ctrl.getSerial(), model: deviceModel },
  }))

  ipcMain.handle(SMC.GET_DEVICES, async () => {
    try {
      const devices = await adb.getDevices()
      return { success: true, data: devices }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.CONNECT, async (_event, serial?: string, audioEnabled?: boolean) => {
    try {
      status = 'connecting'
      send(SMC.CONNECTED, 'connecting')

      const devices = await adb.getDevices()
      const target = devices.find((d) => d.serial === serial) || devices[0]
      if (!target) throw new Error('未发现可用设备（请确认 USB 调试已开启）')

      const deviceRes = await adb.getDeviceResolution(target.serial)
      ctrl.setSerial(target.serial, deviceRes.width, deviceRes.height)
      deviceModel = await adb.getDeviceModel(target.serial)
      // 判断传输方式：IP:port 格式为无线，否则为 USB
      const transport = target.serial.includes(':') ? 'wi-fi' : 'usb'

      // 启动视频流桥接进程
      bridge.start(target.serial, !!audioEnabled)

      status = 'connected'
      send(SMC.CONNECTED, 'connected')
      return {
        success: true,
        data: {
          serial: target.serial,
          model: deviceModel,
          resolution: deviceRes.width ? `${deviceRes.width}x${deviceRes.height}` : '',
          deviceWidth: deviceRes.width,
          deviceHeight: deviceRes.height,
          transport,
        },
      }
    } catch (error) {
      status = 'error'
      send(SMC.ERROR, String(error))
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.DISCONNECT, async () => {
    try {
      bridge.stop()
      ctrl.setSerial(null)
      status = 'idle'
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
      await ctrl.tap(x, y)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.SWIPE, async (_event, x1: number, y1: number, x2: number, y2: number, duration?: number) => {
    try {
      await ctrl.swipe(x1, y1, x2, y2, duration)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.SWIPE_UP, async () => {
    try {
      await ctrl.swipeUp()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.SWIPE_DOWN, async () => {
    try {
      await ctrl.swipeDown()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.BACK, async () => {
    try {
      await ctrl.back()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(SMC.HOME, async () => {
    try {
      await ctrl.home()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 截图
  // =========================================================================

  ipcMain.handle(SMC.SCREENSHOT, async () => {
    try {
      const serial = ctrl.getSerial()
      if (!serial) throw new Error('未连接设备')

      const { app } = require('electron')
      const path = require('path')
      const desktopPath = app.getPath('desktop')
      const timestamp = Date.now()
      const filename = `AutoClick_截图_${timestamp}.png`
      const savePath = path.join(desktopPath, filename)

      await adb.screenshot(serial, savePath)
      return { success: true, data: { path: savePath } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
