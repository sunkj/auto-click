import { loadConfig } from '../../config'

export async function checkTextWithVLM(screenshotBase64: string, prompt: string): Promise<string> {
  const cfg = loadConfig().aiAgent!.vlm
  if (!cfg.apiKey) throw new Error('请先配置 VLM API Key（视觉分析）')

  const baseUrl = cfg.baseUrl
  // 文本检测只需返回简短 JSON，用较小 max_tokens 避免超上下文窗口
  const maxTokens = Math.min(cfg.maxTokens, 200)
  const body = JSON.stringify({
    model: cfg.model,
    temperature: cfg.temperature,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
      ],
    }],
  })

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body,
    signal: AbortSignal.timeout(cfg.timeout),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`VLM API 错误 (${response.status}): ${errText}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content || ''
}
