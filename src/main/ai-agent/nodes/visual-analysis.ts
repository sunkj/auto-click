import type { AgentState, VisualResult } from '../types'
import { ZhipuVisionService } from '../services/big-model-service'
import { findElementByUiAutomator } from '../services/uiautomator-service'
import { detectScreenContext } from '../services/screen-context'

const zhipuVision = new ZhipuVisionService()

/**
 * 视觉分析节点
 *
 * 根据当前屏幕上下文选择定位方式：
 * - 桌面/锁屏 → UI Automator（系统界面节点可读，返回像素坐标）
 * - App 内部  → VLM 视觉分析（DeepSeek Chat，返回百分比坐标后转为像素坐标）
 */
export async function visualAnalysisNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, deviceResolution, deviceSerial, screenshotBase64, scaledWidth, scaledHeight } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法进行视觉分析')
  }

  if (!deviceSerial) {
    throw new Error('缺少设备序列号')
  }

  // 1. 检测当前屏幕上下文
  const screenCtx = await detectScreenContext(deviceSerial)
  console.log('[AiAgent] 屏幕上下文:', JSON.stringify(screenCtx))

  // 2. 桌面/锁屏 → UI Automator（系统界面节点可读，直接返回像素坐标）
  if (screenCtx.context === 'home_screen' || screenCtx.context === 'lock_screen') {
    if (!intent.target) {
      throw new Error('意图缺少目标元素描述')
    }

    const uiResult = await findElementByUiAutomator(
      deviceSerial,
      intent.target,
      deviceResolution.width,
      deviceResolution.height,
    )

    if (uiResult.elements.length === 0) {
      throw new Error(`UI Automator 未找到目标元素: ${intent.target}`)
    }

    console.log('[AiAgent] UI Automator 命中:', intent.target,
      '坐标:', JSON.stringify(uiResult.elements[0].center))

    return { visualResult: uiResult }
  }

  // 3. App 内部 → VLM 视觉分析
  if (!screenshotBase64) {
    throw new Error('缺少截图数据，无法进行视觉分析')
  }

  zhipuVision.setScreenshotInfo(deviceResolution, scaledWidth, scaledHeight)
  const vlmResult: VisualResult = await zhipuVision.analyzeScreenshot(screenshotBase64, intent)

  if (vlmResult.elements.length === 0) {
    throw new Error(`VLM 未找到目标元素: ${intent.target}`)
  }

  // VLM 返回的是百分比坐标（0~1），转成设备像素坐标
  const { width: dw, height: dh } = deviceResolution
  const pixelResult: VisualResult = {
    elements: vlmResult.elements.map(el => ({
      ...el,
      center: {
        x: Math.round(el.center.x * dw),
        y: Math.round(el.center.y * dh),
      },
      bounds: {
        x: Math.round(el.bounds.x * dw),
        y: Math.round(el.bounds.y * dh),
        width: Math.round(el.bounds.width * dw),
        height: Math.round(el.bounds.height * dh),
      },
    })),
    rawDescription: vlmResult.rawDescription,
  }

  console.log('[AiAgent] VLM 命中:', intent.target,
    '百分比坐标:', JSON.stringify(vlmResult.elements[0].center),
    '像素坐标:', JSON.stringify(pixelResult.elements[0].center))

  return { visualResult: pixelResult }
}
