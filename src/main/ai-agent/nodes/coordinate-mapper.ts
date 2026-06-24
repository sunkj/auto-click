import type { AgentState } from '../types'
import { calibrateCoordinates } from '../utils/coordinate-utils'
import { loadConfig } from '../../config'

const config = loadConfig()

/**
 * 坐标映射节点
 *
 * 将 VLM 返回的缩放后坐标，根据设备分辨率校准为原始坐标。
 */
export async function coordinateMapperNode(state: AgentState): Promise<Partial<AgentState>> {
  const { visualResult, intent, deviceResolution, screenshotBase64 } = state

  if (!visualResult || !intent) {
    throw new Error('缺少视觉分析结果或意图数据')
  }

  // 计算缩放比例
  // screenshot 服务将图片缩放到 maxWidth，缩放比 = originalWidth / maxWidth
  const maxWidth = config.aiAgent!.screenshot.maxWidth
  const scaleFactor = deviceResolution.width / maxWidth

  const calibratedCoords = calibrateCoordinates(
    visualResult,
    intent,
    deviceResolution,
    scaleFactor,
  )

  return { calibratedCoords }
}
