/**
 * ADB 辅助 — 设备连接管理
 *
 * 通过 adb 命令行工具执行设备发现、信息获取等操作。
 */
import { execSync } from 'child_process'
import type { SimpleDeviceInfo } from './channels'

/** 执行 adb 命令并返回 stdout */
function adbExec(args: string): string {
  try {
    return execSync(`adb ${args}`, { encoding: 'utf-8', timeout: 5000 })
  } catch (e: any) {
    throw new Error(`ADB 错误: ${e.stderr || e.message}`)
  }
}

/** 在指定设备上执行 shell 命令 */
function adbShell(serial: string, cmd: string): string {
  return adbExec(`-s ${serial} shell ${cmd}`)
}

/** 解析 adb devices -l 输出 */
function parseDevices(output: string): SimpleDeviceInfo[] {
  const lines = output.trim().split('\n').slice(1)
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
    return adbShell(serial, 'getprop ro.product.model').trim() || serial
  } catch {
    return serial
  }
}

export const adb = {
  exec: adbExec,
  shell: adbShell,
  getDevices(): SimpleDeviceInfo[] {
    return parseDevices(adbExec('devices -l'))
  },
  getDeviceModel,
}
