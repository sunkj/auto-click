import type { AgentState } from '../types'
import { calibrateCoordinates } from '../utils/coordinate-utils'

/**
 * 坐标映射节点
 *
 * VLM 返回的是百分比坐标（0~1），直接乘以设备分辨率得到实际像素坐标。
 */
export async function coordinateMapperNode(state: AgentState): Promise<Partial<AgentState>> {
  const { visualResult, intent, deviceResolution } = state

  if (!visualResult || !intent) {
    throw new Error('缺少视觉分析结果或意图数据')
  }

  // VLM 返回百分比坐标，直接乘以 deviceResolution 得到设备像素坐标
  const calibratedCoords = calibrateCoordinates(
    visualResult,
    intent,
    deviceResolution,
    1,
    1,
  )

  console.log('[AiAgent] coordinateMapper 映射结果:', JSON.stringify(calibratedCoords))

  return { calibratedCoords }
}
