/**
 * 截图服务
 *
 * 通过 ADB 截取手机屏幕，使用 sharp 缩放编码。
 * 独立于 scrcpy 视频流，在主进程中直接执行。
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { loadConfig } from '../../config'

const execAsync = promisify(exec)

interface ScreenshotResult {
  base64: string
  filePath: string
  originalWidth: number
  originalHeight: number
  scaledWidth: number
  scaledHeight: number
}

export class ScreenService {
  private config = loadConfig()
  private tempDir = path.join(app.getPath('temp'), 'autoclick-ai-agent')

  constructor() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * 截取手机屏幕
   */
  async capture(serial: string): Promise<ScreenshotResult> {
    // 1. 通过 ADB 截屏
    const { stdout: rawBuffer } = await execAsync(
      `adb -s ${serial} exec-out screencap -p`,
      { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
    )

    // 2. 获取设备分辨率（用于坐标映射）
    const { width: originalWidth, height: originalHeight } = await this.getDeviceResolution(serial)

    // 3. 使用 sharp 缩放
    const sharp = await import('sharp')
    const sCfg = this.config.aiAgent!.screenshot
    const maxWidth = sCfg.maxWidth
    const scale = Math.min(1, maxWidth / originalWidth)
    const scaledWidth = Math.round(originalWidth * scale)
    const scaledHeight = Math.round(originalHeight * scale)

    const resized = await sharp.default(rawBuffer)
      .resize(scaledWidth, scaledHeight, { fit: 'inside' })
      .jpeg({ quality: sCfg.quality })
      .toBuffer()

    // 4. 保存到临时文件（用于展示）
    const fileName = `screenshot-${Date.now()}.jpg`
    const filePath = path.join(this.tempDir, fileName)
    fs.writeFileSync(filePath, resized)

    console.log(`截图保存到: ${this.tempDir}`)

    // 5. 编码为 Base64
    const base64 = resized.toString('base64')

    return {
      base64,
      filePath,
      originalWidth,
      originalHeight,
      scaledWidth,
      scaledHeight,
    }
  }

  /**
   * 获取设备分辨率
   */
  private async getDeviceResolution(serial: string): Promise<{ width: number; height: number }> {
    const { stdout } = await execAsync(
      `adb -s ${serial} shell wm size`,
      { timeout: 5000 },
    )
    const match = stdout.match(/(\d+)x(\d+)/)
    if (match) {
      return { width: parseInt(match[1]), height: parseInt(match[2]) }
    }
    return { width: 1080, height: 2400 } // 默认 fallback
  }

  /** 清理临时文件 */
  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignore */ }
  }
}
