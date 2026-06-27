/**
 * 截屏工具
 *
 * 通过 ADB 截取手机屏幕，使用 sharp 缩放编码。
 * 手机上用固定临时文件名（每次覆盖），PC 端不落盘，直接返回 base64。
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { loadConfig } from '../../config'

const execAsync = promisify(exec)

/** 设备端固定临时文件名（每次覆盖，避免撑爆存储） */
const REMOTE_TMP = '/data/local/tmp/autoclick_screenshot.png'

export interface ScreenshotResult {
  base64: string
  originalWidth: number
  originalHeight: number
  scaledWidth: number
  scaledHeight: number
}

/**
 * 截取手机屏幕，返回 base64 编码的图片数据
 *
 * 流程：
 * 1. screencap 输出到设备固定路径（覆盖写）
 * 2. cat 读取文件内容并通过 exec-out 输出
 * 3. sharp 缩放编码 → base64
 * （PC 端不落盘）
 */
export async function captureScreenshot(serial: string): Promise<ScreenshotResult> {
  // 1. 截屏到设备固定路径（覆盖写）
  await execAsync(
    `adb -s ${serial} shell screencap -p ${REMOTE_TMP}`,
    { timeout: 10000 },
  )

  // 2. 通过 exec-out 读取 PNG 数据
  const { stdout: rawBuffer } = await execAsync(
    `adb -s ${serial} exec-out cat ${REMOTE_TMP}`,
    { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 },
  )

  // 3. 获取设备分辨率
  const { width: originalWidth, height: originalHeight } = await getDeviceResolution(serial)

  // 4. sharp 缩放
  const config = loadConfig()
  const sCfg = config.aiAgent!.screenshot
  const maxWidth = sCfg.maxWidth
  const scale = Math.min(1, maxWidth / originalWidth)
  const scaledWidth = Math.round(originalWidth * scale)
  const scaledHeight = Math.round(originalHeight * scale)

  const sharp = await import('sharp')
  const resized = await sharp.default(rawBuffer)
    .resize(scaledWidth, scaledHeight, { fit: 'inside' })
    .jpeg({ quality: sCfg.quality })
    .toBuffer()

  // 5. 编码为 Base64（不保存到本地磁盘）
  const base64 = resized.toString('base64')

  return {
    base64,
    originalWidth,
    originalHeight,
    scaledWidth,
    scaledHeight,
  }
}

/**
 * 获取设备分辨率
 */
async function getDeviceResolution(serial: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execAsync(
    `adb -s ${serial} shell wm size`,
    { timeout: 5000 },
  )
  const match = stdout.match(/(\d+)x(\d+)/)
  if (match) {
    return { width: parseInt(match[1]), height: parseInt(match[2]) }
  }
  return { width: 1080, height: 2400 }
}
