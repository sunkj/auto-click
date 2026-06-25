import type { Point, CalibratedCoord, VisualResult, IntentResult, Resolution } from '../types'

/**
 * 将 VLM 返回的视觉坐标映射回设备原始分辨率
 *
 * @param visualResult VLM 视觉分析结果
 * @param intent 意图
 * @param deviceResolution 设备原始分辨率
 * @param scaleX X 轴缩放比例（originalWidth / scaledWidth）
 * @param scaleY Y 轴缩放比例（originalHeight / scaledHeight）
 */
export function calibrateCoordinates(
  visualResult: VisualResult,
  intent: IntentResult,
  deviceResolution: Resolution,
  scaleX: number,
  scaleY: number,
): CalibratedCoord {
  const elements = visualResult.elements
  const action = intent.action
  const params: Record<string, any> = {}

  // 如果有识别到的元素，取置信度最高的
  let targetPoint: Point | null = null
  if (elements.length > 0) {
    const best = elements.reduce((a, b) => (a.confidence > b.confidence ? a : b))
    // 通过 scaleX/scaleY 将源坐标系映射到设备像素坐标
    // - UI Automator: 已是设备像素 → scaleX=1, scaleY=1
    // - VLM 百分比:   0~1 范围 → scaleX=deviceWidth, scaleY=deviceHeight
    targetPoint = {
      x: Math.round(best.center.x * scaleX),
      y: Math.round(best.center.y * scaleY),
    }
    // 同时记录 bounds 信息
    params.bounds = {
      x: Math.round(best.bounds.x * scaleX),
      y: Math.round(best.bounds.y * scaleY),
      width: Math.round(best.bounds.width * scaleX),
      height: Math.round(best.bounds.height * scaleY),
    }
    params.elementLabel = best.label
  } else {
    // VLM 未识别到元素，使用屏幕中心作为 fallback
    targetPoint = {
      x: Math.round(deviceResolution.width / 2),
      y: Math.round(deviceResolution.height / 2),
    }
  }

  const points: Point[] = [targetPoint]

  // 根据动作类型计算额外的坐标点（如滑动需要终点）
  if (action === 'swipe') {
    const direction = intent.params?.direction || 'left'
    const distance = intent.params?.duration || Math.round(Math.min(deviceResolution.width, deviceResolution.height) * 0.3)
    // duration 转为毫秒
    const durationMs = Math.round((intent.params?.duration || 0.3) * 1000) || 300

    let endPoint: Point
    switch (direction) {
      case 'up':
        endPoint = { x: targetPoint.x, y: Math.max(targetPoint.y - distance, 0) }
        break
      case 'down':
        endPoint = { x: targetPoint.x, y: Math.min(targetPoint.y + distance, deviceResolution.height) }
        break
      case 'left':
        endPoint = { x: Math.max(targetPoint.x - distance, 0), y: targetPoint.y }
        break
      case 'right':
        endPoint = { x: Math.min(targetPoint.x + distance, deviceResolution.width), y: targetPoint.y }
        break
      default:
        endPoint = { x: Math.max(targetPoint.x - distance, 0), y: targetPoint.y }
    }
    points.push(endPoint)
    params.direction = direction
    params.duration = durationMs
  }

  // 长按参数
  if (action === 'longPress') {
    params.duration = Math.round((intent.params?.duration || 1.5) * 1000) || 1500
  }

  // 输入文本
  if (action === 'input') {
    params.text = intent.params?.text || ''
  }

  // 按键事件
  if (action === 'keyEvent') {
    params.key = intent.params?.key || 'HOME'
  }

  return { action, points, params }
}

/**
 * 计算截图缩放比例（仅保留 width 版本用于兼容）
 */
export function calculateScaleFactor(originalWidth: number, scaledWidth: number): number {
  return originalWidth / scaledWidth
}
