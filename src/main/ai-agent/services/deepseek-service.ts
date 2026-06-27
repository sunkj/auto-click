/**
 * DeepSeek — 意图理解服务
 *
 * 使用 @langchain/openai (ChatOpenAI) 调用 DeepSeek Chat API，
 * 将用户的自然语言指令解析为结构化动作指令。
 */
import { ChatOpenAI } from '@langchain/openai'
import type { IntentResult, DynamicToolDef } from '../types'
import { loadConfig } from '../../config'
import { formatToolsForPrompt } from '../tools/dynamic-tools'

/** 意图理解提示词模板 */
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
输入："打开微信"
输出：{"action":"openApp","target":"微信","params":{},"confidence":0.95}

输入："回到桌面"
输出：{"action":"home","target":"","params":{},"confidence":0.95}

输入："向左滑动"
输出：{"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95}

输入："屏幕上有没有微信"
输出：{"action":"check_text","target":"微信","params":{"checkMode":"text"},"confidence":0.95}

输入："当前是否在设置页面"
输出：{"action":"check_text","target":"设置","params":{"checkMode":"app"},"confidence":0.95}

===== 多步骤 sequence 示例 =====
输入："回到主屏幕，向左滑动2次，打开deepseek"
输出：{"action":"sequence","target":"","params":{"steps":[{"action":"home","target":"","params":{},"confidence":0.95},{"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95},{"action":"swipe","target":"","params":{"direction":"left"},"confidence":0.95},{"action":"openApp","target":"deepseek","params":{},"confidence":0.95}]},"confidence":1.0}

输入："打开微信，进入陈晓蓓聊天，判断是否是语音输入模式，如果是切换到文本"
输出：{"action":"sequence","target":"","params":{"steps":[{"action":"openApp","target":"微信","params":{},"confidence":0.95},{"action":"tap","target":"陈晓蓓","params":{},"confidence":0.95},{"action":"check_text","target":"语音输入","params":{"checkMode":"text"},"confidence":0.95},{"action":"tap","target":"语音输入按钮","params":{},"confidence":0.95}]},"confidence":1.0}

===== 可用快捷工具 =====
{formattedTools}

请严格按 JSON 格式返回，不要额外解释。`

export class DeepSeekService {
  private _chatModel: ChatOpenAI | null = null
  private config = loadConfig()

  private getChatModel(): ChatOpenAI {
    if (!this._chatModel) {
      const cfg = this.config.aiAgent!.deepseek
      if (!cfg.apiKey) {
        throw new Error('请先在系统设置中配置 DeepSeek API Key')
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
   * @param userInput 用户输入
   * @param availableTools 可用的动态工具列表（录制记录 + 内置操作），
   *                       如果用户指令匹配某个工具名称，AI 会返回 call_tool 动作
   *
   * 支持在指令中直接指定坐标，如："点击 500 1000"、"滑动 300 500 到 100 200"
   */
  async parseIntent(userInput: string, availableTools?: DynamicToolDef[]): Promise<IntentResult> {
    // 优先尝试从指令中提取显式坐标
    const explicitCoords = extractExplicitCoordinates(userInput)
    if (explicitCoords) {
      return explicitCoords
    }

    // 注入动态工具信息
    const toolsText = availableTools ? formatToolsForPrompt(availableTools) : '（暂无可用快捷工具）'
    const prompt = INTENT_PARSER_PROMPT.replace('{formattedTools}', toolsText)
    console.log('[DeepSeek] parseIntent prompt:', prompt)
    const response = await this.getChatModel().invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userInput },
    ])

    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    console.log('[DeepSeek] parseIntent 原始输出:', text)
    const jsonStr = extractJson(text)
    const parsed = JSON.parse(jsonStr)

    return {
      action: parsed.action || 'tap',
      target: parsed.target || '',
      params: parsed.params || undefined,
      confidence: parsed.confidence || 0.5,
    }
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
