/**
 * 投屏交互 — 触摸/按键控制
 *
 * 通过 adb shell 命令向设备发送触控和按键指令。
 */
import { adb } from './adb'

let deviceSerial: string | null = null

export const ctrl = {
  /** 设置当前目标设备 */
  setSerial(serial: string | null) {
    deviceSerial = serial
  },

  getSerial() {
    return deviceSerial
  },

  async tap(x: number, y: number): Promise<void> {
    if (!deviceSerial) throw new Error('未连接设备')
    await adb.shell(deviceSerial, `input tap ${Math.round(x)} ${Math.round(y)}`)
  },

  async swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    if (!deviceSerial) throw new Error('未连接设备')
    await adb.shell(deviceSerial, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration ?? 200}`)
  },

  async back(): Promise<void> {
    if (!deviceSerial) throw new Error('未连接设备')
    await adb.shell(deviceSerial, 'input keyevent 4')
  },

  async home(): Promise<void> {
    if (!deviceSerial) throw new Error('未连接设备')
    await adb.shell(deviceSerial, 'input keyevent 3')
  },
}
