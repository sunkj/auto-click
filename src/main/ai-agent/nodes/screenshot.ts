import type { AgentState } from '../types'
import { ScreenService } from '../services/screen-service'

const screenService = new ScreenService()

/**
 * 截屏节点
 *
 * 通过 ADB 截取当前手机屏幕，保存为 Base64 供 VLM 分析。
 */
export async function screenshotNode(state: AgentState): Promise<Partial<AgentState>> {
  const { deviceSerial } = state

  const result = await screenService.capture(deviceSerial)

  return {
    screenshotBase64: result.base64,
    screenshotPath: result.filePath,
    deviceResolution: {
      width: result.originalWidth,
      height: result.originalHeight,
    },
  }
}
