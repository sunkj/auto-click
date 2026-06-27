import type { AgentState } from '../types'
import { captureScreenshot } from '../tools/screenshot'

/**
 * 截屏节点
 *
 * 通过 ADB 截取当前手机屏幕，返回 Base64 供 VLM 分析。
 * 手机上用固定临时文件名（覆盖写），PC 端不落盘。
 */
export async function screenshotNode(state: AgentState): Promise<Partial<AgentState>> {
  const { deviceSerial } = state

  const result = await captureScreenshot(deviceSerial)

  return {
    screenshotBase64: result.base64,
    screenshotPath: null,
    scaledWidth: result.scaledWidth,
    scaledHeight: result.scaledHeight,
    deviceResolution: {
      width: result.originalWidth,
      height: result.originalHeight,
    },
  }
}
