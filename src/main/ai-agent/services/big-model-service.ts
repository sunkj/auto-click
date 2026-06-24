/**
 * 智谱 AI API 服务封装
 *
 * Chat（意图理解）使用 @langchain/openai 封装，对接智谱 GLM-4 系列模型。
 * Vision（视觉分析）使用 HTTP fetch 调用智谱 GLM-4V 多模态模型，
 * 支持通过 image_url 直接传入截图进行视觉识别。
 *
 * 智谱 API 兼容 OpenAI 格式：
 * - Base URL: https://open.bigmodel.cn/api/paas/v4
 * - Chat: glm-4-flash / glm-4-plus
 * - Vision: glm-4v（支持 image_url 多模态输入）
 */
import { ChatOpenAI } from '@langchain/openai'
import type { IntentResult, VisualResult } from '../types'
import { loadConfig } from '../../config'

/** 意图理解提示词模板 */
const INTENT_PARSER_PROMPT = `你是一个手机自动化操作指令解析器。你需要将用户的自然语言指令解析为结构化的动作指令。

可用动作类型：
- tap：点击指定元素
- swipe：滑动屏幕（方向：up/down/left/right）
- longPress：长按指定元素
- input：输入文本
- keyEvent：系统按键（HOME/BACK/MENU/POWER/APP_SWITCH）
- sequence：多步骤复合指令

请以 JSON 格式返回结果，格式如下：
{
  "action": "tap",
  "target": "微信图标",
  "params": {},
  "confidence": 0.95
}

用户指令：{{userInput}}`



export class ZhipuAIService {
  private _chatModel: ChatOpenAI | null = null
  private config = loadConfig()

  private getChatModel(): ChatOpenAI {
    if (!this._chatModel) {
      const cfg = this.config.aiAgent!.zhipu
      if (!cfg.apiKey) {
        throw new Error('请先在系统设置中配置智谱 API Key')
      }
      this._chatModel = new ChatOpenAI({
        apiKey: cfg.apiKey,
        model: cfg.chatModel,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeout: cfg.timeout,
        configuration: { baseURL: cfg.baseUrl },
      })
    }
    return this._chatModel
  }

  /**
   * 意图理解 — 将用户自然语言解析为结构化动作指令
   *
   * 支持在指令中直接指定坐标，如："点击 500 1000"、"滑动 300 500 到 100 200"
   */
  async parseIntent(userInput: string): Promise<IntentResult> {
    // 优先尝试从指令中提取显式坐标
    const explicitCoords = extractExplicitCoordinates(userInput)
    if (explicitCoords) {
      return explicitCoords
    }

    const prompt = INTENT_PARSER_PROMPT.replace('{{userInput}}', userInput)

    const response = await this.getChatModel().invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userInput },
    ])

    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    console.log('Big Model parseIntent 原始输出:', text)
    // 提取 JSON（处理模型可能用 markdown 包裹的情况）
    const jsonStr = extractJson(text)
    const parsed = JSON.parse(jsonStr)

    return {
      action: parsed.action || 'tap',
      target: parsed.target || '',
      params: parsed.params || undefined,
      confidence: parsed.confidence || 0.5,
    }
  }

  /**
   * 视觉分析 — 调用智谱 GLM-4V 多模态模型识别目标元素位置
   *
   * 将截图直接传入视觉模型，让 AI "看到"屏幕内容并识别目标元素坐标。
   */
  async analyzeScreenshot(screenshotBase64: string, intent: IntentResult): Promise<VisualResult> {
    const cfg = this.config.aiAgent!.zhipu
    if (!cfg.apiKey) {
      throw new Error('请先在系统设置中配置智谱 API Key')
    }
    if (!screenshotBase64) {
      throw new Error('缺少截图数据，无法进行视觉分析')
    }
    const url = `${cfg.baseUrl}/chat/completions`
    const resolution = this._lastResolution || { width: 1080, height: 2400 }

    const body = JSON.stringify({
      model: cfg.visionModel,
      temperature: 0.1,
      max_tokens: cfg.maxTokens,
      messages: [
        {
          role: 'system',
          content: `你是一个手机屏幕视觉分析助手。你需要根据用户的目标描述，在提供的屏幕截图中找到目标元素的位置。

分析要求：
1. 仔细查看屏幕截图中的所有可见元素
2. 根据目标描述找到对应的 UI 元素
3. 返回该元素在图片中的精确坐标（基于图片像素坐标系）
4. 如果找不到目标元素，请在 elements 数组中返回空数组

屏幕分辨率：${resolution.width}x${resolution.height}

请以 JSON 格式返回结果，格式如下：
{
  "elements": [
    {
      "label": "微信",
      "bounds": { "x": 100, "y": 1800, "width": 120, "height": 120 },
      "center": { "x": 160, "y": 1860 },
      "confidence": 0.95,
      "text": "微信",
      "type": "icon"
    }
  ],
  "rawDescription": "在屏幕底部 dock 栏找到微信图标..."
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
    console.log('Big Model analyzeScreenshot 原始输出:', text)
    const jsonStr = extractJson(text)
    const parsed = JSON.parse(jsonStr)

    return {
      elements: (parsed.elements || []).map((el: any) => ({
        label: el.label || '',
        bounds: el.bounds || { x: 0, y: 0, width: 0, height: 0 },
        center: el.center || { x: 0, y: 0 },
        confidence: el.confidence || 0,
        text: el.text,
        type: el.type,
      })),
      rawDescription: parsed.rawDescription || '',
    }
  }

  /** 记录最近一次查询的分辨率，供视觉分析使用 */
  private _lastResolution: { width: number; height: number } | null = null

  setLastResolution(resolution: { width: number; height: number }) {
    this._lastResolution = resolution
  }
}

/** 从用户指令中提取显式坐标 */
function extractExplicitCoordinates(input: string): IntentResult | null {
  // 匹配 "点击 500 1000" 或 "点击 500,1000" 或 "tap 500 1000"
  const tapMatch = input.match(/^(点击|tap|点)\s*(\d+)\s*[,，]?\s*(\d+)$/i)
  if (tapMatch) {
    return {
      action: 'tap',
      target: `坐标 (${tapMatch[2]}, ${tapMatch[3]})`,
      params: { explicitCoords: { x: parseInt(tapMatch[2]), y: parseInt(tapMatch[3]) } },
      confidence: 1.0,
    }
  }

  // 匹配 "滑动 x1 y1 到 x2 y2" 或 "swipe x1 y1 x2 y2"
  const swipeMatch = input.match(/^(滑动|swipe)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/i)
  if (swipeMatch) {
    return {
      action: 'swipe',
      target: `坐标`,
      params: { direction: 'left', explicitCoords: { x: parseInt(swipeMatch[2]), y: parseInt(swipeMatch[3]) } },
      confidence: 1.0,
    }
  }

  return null
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
