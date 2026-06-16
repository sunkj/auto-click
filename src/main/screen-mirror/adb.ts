/**
 * ADB 辅助 — 设备连接管理
 *
 * 通过 adb 命令行工具执行设备发现、信息获取等操作。
 * 使用异步 exec 避免阻塞主进程（对后续脚本执行引擎至关重要）。
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import type { SimpleDeviceInfo } from './channels'

const asyncExec = promisify(exec)

// =============================================================================
// 自动查找 ADB 可执行文件（使用 PATH 环境变量）
// =============================================================================
async function resolveAdbPath(): Promise<string> {
  // 优先尝试常见路径
  const commonPaths = [
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
    '/usr/bin/adb',
    '/opt/android/platform-tools/adb',
  ]
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }
  // 回退：用 which 从 PATH 查找
  try {
    const { stdout } = await asyncExec('which adb', { encoding: 'utf-8', timeout: 3000 })
    const resolved = stdout.trim()
    if (resolved) return resolved
  } catch { /* ignore */ }
  return 'adb'
}

let adbPathPromise: Promise<string> | null = null

async function getAdbPath(): Promise<string> {
  if (!adbPathPromise) {
    adbPathPromise = resolveAdbPath()
  }
  return adbPathPromise
}

export async function refreshAdbPath(): Promise<void> {
  adbPathPromise = resolveAdbPath()
}

/** 执行 adb 命令并返回 stdout（异步，不阻塞主进程） */
async function adbExec(args: string): Promise<string> {
  try {
    const adb = await getAdbPath()
    const { stdout } = await asyncExec(`${adb} ${args}`, { encoding: 'utf-8', timeout: 5000 })
    return stdout
  } catch (e: any) {
    throw new Error(`ADB 错误: ${e.stderr || e.message}`)
  }
}

/** 在指定设备上执行 shell 命令 */
async function adbShell(serial: string, cmd: string): Promise<string> {
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
async function getDeviceModel(serial: string): Promise<string> {
  try {
    return (await adbShell(serial, 'getprop ro.product.model')).trim() || serial
  } catch {
    return serial
  }
}

/** 获取设备真实分辨率（通过 wm size） */
async function getDeviceResolution(serial: string): Promise<{ width: number; height: number }> {
  try {
    const output = await adbShell(serial, 'wm size')
    // 格式: "Physical size: 1080x2400" 或 "1080x2400"
    const m = output.match(/(\d+)\s*x\s*(\d+)/)
    if (m) return { width: parseInt(m[1]), height: parseInt(m[2]) }
  } catch { /* ignore */ }
  return { width: 0, height: 0 }
}

export const adb = {
  exec: adbExec,
  shell: adbShell,
  async getDevices(): Promise<SimpleDeviceInfo[]> {
    return parseDevices(await adbExec('devices -l'))
  },
  getDeviceModel,
  getDeviceResolution,
}
