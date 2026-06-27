/**
 * 智谱 GLM-4V — 视觉分析服务
 *
 * 通过 HTTP fetch 直接调用智谱 GLM-4V API，
 * 将截图传入视觉模型，返回目标元素在屏幕上的百分比坐标（0~1）。
 */
import type { IntentResult, VisualResult } from '../types'
import { loadConfig } from '../../config'

export class ZhipuVisionService {
  private config = loadConfig()
  private _lastResolution: { width: number; height: number } | null = null
  private _imageWidth = 0
  private _imageHeight = 0

  /**
   * 视觉分析 — 调用智谱 GLM-4V 识别目标元素位置
   *
   * 将截图传入视觉模型，返回百分比坐标（0~1）。
   */
  async analyzeScreenshot(screenshotBase64: string, intent: IntentResult): Promise<VisualResult> {
    const cfg = this.config.aiAgent!.zhipu
    const baseUrl = cfg.baseUrl || 'https://open.bigmodel.cn/api/paas/v4'
    console.log('[智谱] 配置:', JSON.stringify({ apiKey: cfg.apiKey ? '***' : '', baseUrl, visionModel: cfg.visionModel }))
    if (!cfg.apiKey) {
      throw new Error('请先在系统设置中配置智谱 API Key')
    }
    if (!screenshotBase64) {
      throw new Error('缺少截图数据，无法进行视觉分析')
    }
    const url = `${baseUrl}/chat/completions`
    const resolution = this._lastResolution || { width: 1080, height: 2400 }
    const imgW = this._imageWidth || resolution.width
    const imgH = this._imageHeight || resolution.height

    console.log('[智谱] VLM 请求参数:', JSON.stringify({
      deviceResolution: resolution,
      imageSize: `${imgW}x${imgH}`,
      target: intent.target,
      base64Length: screenshotBase64.length,
    }))

    const body = JSON.stringify({
      model: cfg.visionModel,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      messages: [
        {
          role: 'system',
          content: `你是一个手机屏幕元素定位助手。你需要在截图中找到用户指定的元素，返回其位置百分比（0~1 范围）。

⚠️ 重要：所有坐标必须是相对于截图宽高的百分比值（0.0 ~ 1.0），例如：
- 屏幕正中心 = { "x": 0.5, "y": 0.5 }
- 左上角 = { "x": 0, "y": 0 }
- 右下角 = { "x": 1.0, "y": 1.0 }

请以 JSON 格式返回结果：
{
  "elements": [
    {
      "label": "找到的元素名称",
      "bounds": { "x": 左上角x百分比, "y": 左上角y百分比, "width": 宽度百分比, "height": 高度百分比 },
      "center": { "x": 中心x百分比, "y": 中心y百分比 },
      "confidence": 0.95
    }
  ],
  "rawDescription": "描述在哪里找到的元素"
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `用户目标：${intent.target}\n请在截图中找到该元素，返回其精确坐标。` },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          ],
        },
      ],
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(cfg.timeout),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`智谱 API 错误 (${response.status}): ${errText}`)
    }

    const data = await response.json() as any
    const text = data.choices?.[0]?.message?.content || ''
    console.log('[智谱] analyzeScreenshot 原始输出:', text)
    const jsonStr = extractJson(text)
    const parsed = JSON.parse(jsonStr)

    const elements = (parsed.elements || []).map((el: any) => ({
      label: el.label || '',
      bounds: el.bounds || { x: 0, y: 0, width: 0, height: 0 },
      center: el.center || { x: 0, y: 0 },
      confidence: el.confidence || 0,
      text: el.text,
      type: el.type,
    }))

    console.log('[智谱] VLM 返回坐标:', JSON.stringify({
      imageSize: `${imgW}x${imgH}`,
      elements: elements.map((e: any) => ({ label: e.label, center: e.center, bounds: e.bounds })),
      rawDescription: parsed.rawDescription,
    }))

    return { elements, rawDescription: parsed.rawDescription || '' }
  }

  /** 记录截图信息供视觉分析使用 */
  setScreenshotInfo(resolution: { width: number; height: number }, imageWidth: number, imageHeight: number) {
    this._lastResolution = resolution
    this._imageWidth = imageWidth
    this._imageHeight = imageHeight
  }
}

/** 从模型输出中提取 JSON 字符串 */
function extractJson(text: string): string {
  // 尝试解析 ```json ... ``` 包裹
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) return jsonBlockMatch[1].trim()

  // 尝试直接解析
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) return braceMatch[0]

  return text
}
