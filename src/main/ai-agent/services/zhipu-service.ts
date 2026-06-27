/**
 * 智谱 GLM-4V — 视觉识别服务
 *
 * 通过 HTTP fetch 调用智谱 GLM-4V API。
 * 只负责发送请求和返回原始响应文本，不解析结果。
 */
import { loadConfig } from '../../config'

/**
 * 调用智谱视觉模型进行图文识别
 *
 * @param screenshotBase64 截图 base64（无 data: URI 前缀）
 * @param prompt 提示词
 * @returns 模型返回的原始响应文本
 */
export async function checkTextWithZhipu(
  screenshotBase64: string,
  prompt: string,
): Promise<string> {
  const cfg = loadConfig().aiAgent!.zhipu
  if (!cfg.apiKey) {
    throw new Error('请先在系统设置中配置智谱 API Key')
  }

  const baseUrl = cfg.baseUrl || 'https://open.bigmodel.cn/api/paas/v4'

  const body = JSON.stringify({
    model: cfg.visionModel,
    temperature: 0.1,
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
        ],
      },
    ],
  })

  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  return data.choices?.[0]?.message?.content || ''
}

