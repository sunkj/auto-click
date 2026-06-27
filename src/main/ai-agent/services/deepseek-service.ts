import { ChatOpenAI } from '@langchain/openai'
import type { IntentResult } from '../../common/types'
import type { DynamicToolDef } from '../tools/dynamic-tools'
import { loadConfig } from '../../config'
import { formatToolsForPrompt } from '../tools/dynamic-tools'

const INTENT_PARSER_PROMPT = `你是一个手机自动化操作指令解析器。你需要将用户的自然语言指令解析为结构化的动作指令。

可用动作类型：
- tap：点击指定元素（target 传元素名称，如"微信图标"）
- swipe：滑动屏幕（params.direction 传方向 up/down/left/right，可用 target 描述滑动目标）
- longPress：长按指定元素
- input：输入文本（params.text 传文本内容）
- keyEvent：系统按键（params.key 传 HOME/BACK/MENU/POWER/APP_SWITCH）
- home：返回桌面/回到首页（不需 target，params 留空）
- openApp：打开指定 App（target 传 App 名称）
- call_tool：直接调用已有的快捷工具（target 传工具名称，匹配下方可用工具）
- check_text：判断屏幕上是否存在指定文字或是否处于某个 App（target 传文字内容，params.checkMode 传 "text" 或 "app"）。可与 tap/swipe 等混合在 sequence 中使用
- sequence：多步骤复合指令，用于串联多个操作

===== 单步示例 =====
输入："打开微信" → {"action":"openApp","target":"微信","params":{},"confidence":0.95}
输入："回到桌面" → {"action":"home","target":"","params":{},"confidence":0.95}
输入："向左滑动" → {"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95}

===== 多步骤 sequence 示例 =====
输入："回到主屏幕，向左滑动2次，打开deepseek"
输出：{"action":"sequence","target":"","params":{"steps":[{"action":"home","target":"","params":{},"confidence":0.95},{"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95},{"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95},{"action":"openApp","target":"deepseek","params":{},"confidence":0.95}]},"confidence":1.0}

===== 可用快捷工具 =====
{formattedTools}

请严格按 JSON 格式返回，不要额外解释。`

export class DeepSeekService {
  private _chatModel: ChatOpenAI | null = null
  private config = loadConfig()

  private getChatModel(): ChatOpenAI {
    if (!this._chatModel) {
      const cfg = this.config.aiAgent!.deepseek
      if (!cfg.apiKey) throw new Error('请先配置 DeepSeek API Key')
      this._chatModel = new ChatOpenAI({
        apiKey: cfg.apiKey, model: cfg.chatModel,
        temperature: cfg.temperature, maxTokens: cfg.maxTokens,
        timeout: cfg.timeout, configuration: { baseURL: cfg.baseUrl },
      })
    }
    return this._chatModel
  }

  async parseIntent(userInput: string, availableTools?: DynamicToolDef[]): Promise<IntentResult> {
    const explicitCoords = extractExplicitCoordinates(userInput)
    if (explicitCoords) return explicitCoords

    const toolsText = availableTools ? formatToolsForPrompt(availableTools) : '（暂无可用快捷工具）'
    const prompt = INTENT_PARSER_PROMPT.replace('{formattedTools}', toolsText)
    const response = await this.getChatModel().invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userInput },
    ])

    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    const jsonStr = extractJson(text)
    const parsed = JSON.parse(jsonStr)
    return {
      action: parsed.action || 'tap', target: parsed.target || '',
      params: parsed.params || undefined, confidence: parsed.confidence || 0.5,
    }
  }
}

function extractExplicitCoordinates(input: string): IntentResult | null {
  const tapMatch = input.match(/^(点击|tap|点)\s*(\d+)\s*[,，]?\s*(\d+)$/i)
  if (tapMatch) return { action: 'tap', target: `坐标 (${tapMatch[2]}, ${tapMatch[3]})`, params: { explicitCoords: { x: parseInt(tapMatch[2]), y: parseInt(tapMatch[3]) } }, confidence: 1.0 }
  const swipeMatch = input.match(/^(滑动|swipe)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/i)
  if (swipeMatch) return { action: 'swipe', target: '坐标', params: { direction: 'left', explicitCoords: { x: parseInt(swipeMatch[2]), y: parseInt(swipeMatch[3]) } }, confidence: 1.0 }
  return null
}

function extractJson(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
  return m ? m[1]?.trim() || m[0] : text
}
