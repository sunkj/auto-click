/**
 * ADB 命令执行器 — script-engine 独立使用
 *
 * 通过 child_process 直接执行 adb shell 命令，不依赖 screen-mirror。
 */
import { exec, execFileSync } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'

const asyncExec = promisify(exec)

// =============================================================================
// 自动查找 ADB 可执行文件（使用 PATH 环境变量）
// =============================================================================
async function resolveAdbPath(): Promise<string> {
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

async function adbCmd(...args: string[]): Promise<string> {
  const adb = await getAdbPath()
  return [adb, ...args].join(' ')
}

async function adbShell(serial: string, cmd: string): Promise<string> {
  const { stdout } = await asyncExec(await adbCmd('-s', serial, 'shell', cmd), {
    encoding: 'utf-8',
    timeout: 10000,
  })
  return stdout
}

/** 缓存设备分辨率，避免每次执行都查询 */
const resolutionCache = new Map<string, { width: number; height: number }>()

export const adbExec = {
  /** 获取设备物理分辨率（带缓存） */
  async getResolution(serial: string): Promise<{ width: number; height: number }> {
    const cached = resolutionCache.get(serial)
    if (cached) return cached
    const output = await adbShell(serial, 'wm size')
    const m = output.match(/(\d+)\s*x\s*(\d+)/)
    if (!m) return { width: 1080, height: 2400 }
    const res = { width: parseInt(m[1]), height: parseInt(m[2]) }
    resolutionCache.set(serial, res)
    return res
  },

  /** 清除分辨率缓存 */
  clearResolutionCache(serial?: string): void {
    if (serial) resolutionCache.delete(serial)
    else resolutionCache.clear()
  },

  async tap(serial: string, x: number, y: number): Promise<void> {
    await adbShell(serial, `input tap ${Math.round(x)} ${Math.round(y)}`)
  },

  async swipe(serial: string, x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    await adbShell(serial, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration ?? 200}`)
  },

  async longPress(serial: string, x: number, y: number, durationMs: number): Promise<void> {
    // 用 1px 偏移确保 Android 识别为滑动（非点击），起止点几乎重合实现长按
    const px = Math.round(x)
    const py = Math.round(y)
    await adbShell(serial, `input swipe ${px} ${py} ${px + 1} ${py + 1} ${durationMs}`)
  },

  async type(serial: string, text: string): Promise<void> {
    const adb = await getAdbPath()
    execFileSync(adb, ['-s', serial, 'shell', `input text ${text}`], {
      encoding: 'utf-8', timeout: 10000,
    })
  },
}
