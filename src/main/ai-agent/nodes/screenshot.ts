import type { AgentState } from '../../common/types'
import { captureScreenshot } from '../tools/screenshot'

export async function screenshotNode(state: AgentState): Promise<Partial<AgentState>> {
  const result = await captureScreenshot(state.deviceSerial)
  return { screenshotBase64: result.base64 }
}
