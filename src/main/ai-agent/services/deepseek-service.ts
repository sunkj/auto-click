import { ChatOpenAI } from '@langchain/openai'
import type { IntentResult } from '../../common/types'
import type { DynamicToolDef } from '../tools/dynamic-tools'
import { loadConfig } from '../../config'
import { formatToolsForPrompt } from '../tools/dynamic-tools'

const INTENT_PARSER_PROMPT = `你是一个手机自动化操作指令解析器。你需要将用户的自然语言指令解析为结构化的动作指令。

可用动作类型：
- tap：点击指定元素（target 传元素名称）
- swipe：滑动屏幕（params.direction 传方向 up/down/left/right）
- longPress：长按指定元素
- input：输入文本（params.text 传文本内容）
- keyEvent：系统按键（params.key 传 HOME/BACK/MENU/POWER/APP_SWITCH）
- home：返回桌面/回到首页
- openApp：打开指定 App（target 传 App 名称）
- call_tool：调用已有的快捷工具（target 传工具名称）
- check_text：判断屏幕上是否存在指定文字。支持条件分支：
  - params.ifMatched：检测匹配时执行的子步骤
  - params.ifNotMatched：检测不匹配时执行的子步骤
- sequence：多步骤复合指令

===== ⚠️ 结构规则（重要）=====
当用户指令中有"如果...就...，否则/如果没有...就..."等条件逻辑时：
- check_text 和它的条件分支（ifMatched/ifNotMatched）必须在一个结构体内
- call_tool 等条件操作必须放在 ifMatched 或 ifNotMatched 内部
- ❌ 错误：check_text 在 sequence 中，call_tool 在它后面平级
- ✅ 正确：call_tool 嵌套在 check_text 的 ifMatched/ifNotMatched 内部

===== 正确示例（✅）=====
输入："打开微信，进入陈晓蓓聊天，如果页面包含按住说话，使用切换到文本输入工具，如果没有，使用激活文本输入框工具，输入Hello，使用点击发送工具"
输出：{"action":"sequence","target":"","params":{"steps":[{"action":"openApp","target":"微信","params":{},"confidence":0.95},{"action":"call_tool","target":"进入陈晓蓓聊天窗口","params":{},"confidence":0.95},{"action":"check_text","target":"按住说话","params":{"checkMode":"text","ifMatched":[{"action":"call_tool","target":"切换到文本输入","params":{},"confidence":0.95}],"ifNotMatched":[{"action":"call_tool","target":"激活文本输入框","params":{},"confidence":0.95}]},"confidence":0.95},{"action":"input","target":"","params":{"text":"Hello"},"confidence":0.95},{"action":"call_tool","target":"点击发送","params":{},"confidence":0.95}]},"confidence":1.0}

===== 错误示例（❌）=====
"切换到文本输入"和"激活文本输入框"是 check_text 的条件分支，必须放在 ifMatched/ifNotMatched 内部。
下面的输出是**错误的**，因为 call_tool 被放在了 sequence 的平级位置：
❌ {"action":"sequence","target":"","params":{"steps":[{"action":"openApp","target":"微信","params":{},"confidence":0.95},{"action":"call_tool","target":"进入陈晓蓓聊天窗口","params":{},"confidence":0.95},{"action":"check_text","target":"按住说话","params":{"checkMode":"text"},"confidence":0.95},{"action":"call_tool","target":"切换到文本输入","params":{},"confidence":0.95},{"action":"call_tool","target":"激活文本输入框","params":{},"confidence":0.95}]},"confidence":1.0}

===== 无 else 分支的正确示例 =====
输入："打开微信，进入陈晓蓓聊天，如果页面包含按住说话，使用切换到文本输入工具，输入Hello，使用点击发送工具"
输出：{"action":"sequence","target":"","params":{"steps":[{"action":"openApp","target":"微信","params":{},"confidence":0.95},{"action":"call_tool","target":"进入陈晓蓓聊天窗口","params":{},"confidence":0.95},{"action":"check_text","target":"按住说话","params":{"checkMode":"text","ifMatched":[{"action":"call_tool","target":"切换到文本输入","params":{},"confidence":0.95}]},"confidence":0.95},{"action":"input","target":"","params":{"text":"Hello"},"confidence":0.95},{"action":"call_tool","target":"点击发送","params":{},"confidence":0.95}]},"confidence":1.0}

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
