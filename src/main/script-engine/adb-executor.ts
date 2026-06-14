/**
 * ADB 命令执行器 — script-engine 独立使用
 *
 * 通过 child_process.exec 直接执行 adb shell 命令，不依赖 screen-mirror。
 */
import { exec } from 'child_process'
import { promisify } from 'util'

const asyncExec = promisify(exec)

async function adbShell(serial: string, cmd: string): Promise<string> {
  const { stdout } = await asyncExec(`adb -s ${serial} shell ${cmd}`, {
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

  async type(serial: string, text: string): Promise<void> {
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/ /g, '%s')
    await adbShell(serial, `input text ${escaped}`)
  },
}
