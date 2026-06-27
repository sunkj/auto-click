import { exec } from 'child_process'
import { promisify } from 'util'
import { loadConfig } from '../../config'

const execAsync = promisify(exec)
const REMOTE_TMP = '/data/local/tmp/autoclick_screenshot.png'

export interface ScreenshotResult {
  base64: string
  originalWidth: number
  originalHeight: number
  scaledWidth: number
  scaledHeight: number
}

export async function captureScreenshot(serial: string): Promise<ScreenshotResult> {
  await execAsync(`adb -s ${serial} shell screencap -p ${REMOTE_TMP}`, { timeout: 10000 })
  const { stdout: rawBuffer } = await execAsync(`adb -s ${serial} exec-out cat ${REMOTE_TMP}`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 })

  const { width: originalWidth, height: originalHeight } = await getDeviceResolution(serial)
  const config = loadConfig()
  const sCfg = config.aiAgent!.screenshot
  const maxWidth = sCfg.maxWidth
  const scale = Math.min(1, maxWidth / originalWidth)
  const scaledWidth = Math.round(originalWidth * scale)
  const scaledHeight = Math.round(originalHeight * scale)

  const sharp = await import('sharp')
  const resized = await sharp.default(rawBuffer).resize(scaledWidth, scaledHeight, { fit: 'inside' }).jpeg({ quality: sCfg.quality }).toBuffer()

  return { base64: resized.toString('base64'), originalWidth, originalHeight, scaledWidth, scaledHeight }
}

async function getDeviceResolution(serial: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execAsync(`adb -s ${serial} shell wm size`, { timeout: 5000 })
  const m = stdout.match(/(\d+)x(\d+)/)
  return m ? { width: parseInt(m[1]), height: parseInt(m[2]) } : { width: 1080, height: 2400 }
}
