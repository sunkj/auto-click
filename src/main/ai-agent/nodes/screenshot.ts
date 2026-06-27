/**
 * 截屏节点
 *
 * 截取当前手机屏幕，将 base64 存入 state.screenshotBase64。
 */
import type { AgentState } from '../types'
import { captureScreenshot } from '../tools/screenshot'

export async function screenshotNode(state: AgentState): Promise<Partial<AgentState>> {
  const result = await captureScreenshot(state.deviceSerial)
  return { screenshotBase64: result.base64 }
}
