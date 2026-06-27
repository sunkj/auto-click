import type { ScreenCheckResult } from '../../common/types'
import { checkTextWithZhipu } from '../services/zhipu-service'

export async function checkScreenText(screenshotBase64: string, target: string, checkMode: 'text' | 'app'): Promise<ScreenCheckResult> {
  const prompt = checkMode === 'app'
    ? `请判断当前手机屏幕是否处于"${target}"这个 App 中。如果是，返回 {"found":true}，否则返回 {"found":false}。只返回 JSON，不要解释。`
    : `请判断当前手机屏幕上是否能看到"${target}"这几个字。如果能找到，返回 {"found":true}，否则返回 {"found":false}。只返回 JSON，不要解释。`

  const rawResponse = await checkTextWithZhipu(screenshotBase64, prompt)
  console.log(`[智谱GLM-4V] 原始响应: ${rawResponse}`)
  const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/)
  let found = false
  if (jsonMatch) { try { found = JSON.parse(jsonMatch[0]).found === true } catch { /* ignore */ } }

  const description = found ? (checkMode === 'app' ? `当前在 "${target}" App 中` : `屏幕上存在 "${target}"`) : (checkMode === 'app' ? `当前不在 "${target}" App 中` : `屏幕上未找到 "${target}"`)
  console.log(`[智谱GLM-4V] 检测结果: matched=${found}, desc="${description}"`)

  return { matched: found, description }
}
