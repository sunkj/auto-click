/**
 * 文字检测工具
 *
 * 判断当前屏幕是否包含指定文字或处于指定 App。
 * 调用智谱 GLM-4V 进行视觉识别，只返回是/否，不找坐标。
 */
import type { ScreenCheckResult } from '../types'
import { checkTextWithZhipu } from '../services/zhipu-service'

/**
 * 检测屏幕上是否存在指定文字或是否处于某个 App
 *
 * @param screenshotBase64 截图 base64
 * @param target 检测目标（文字或 App 名称）
 * @param checkMode 检测模式：text=文字检测, app=App 检测
 */
export async function checkScreenText(
  screenshotBase64: string,
  target: string,
  checkMode: 'text' | 'app',
): Promise<ScreenCheckResult> {
  const prompt = checkMode === 'app'
    ? `请判断当前手机屏幕是否处于"${target}"这个 App 中。如果是，返回 {"found":true}，否则返回 {"found":false}。只返回 JSON，不要解释。`
    : `请判断当前手机屏幕上是否能看到"${target}"这几个字。如果能找到，返回 {"found":true}，否则返回 {"found":false}。只返回 JSON，不要解释。`

  console.log('[TextCheck] 检测目标:', target, '模式:', checkMode)

  const rawResponse = await checkTextWithZhipu(screenshotBase64, prompt)

  // 解析 JSON
  const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/)
  let found = false
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      found = parsed.found === true
    } catch { /* ignore */ }
  }

  const result: ScreenCheckResult = {
    matched: found,
    description: found
      ? (checkMode === 'app' ? `当前在 "${target}" App 中` : `屏幕上存在 "${target}"`)
      : (checkMode === 'app' ? `当前不在 "${target}" App 中` : `屏幕上未找到 "${target}"`),
  }

  console.log('[TextCheck] 检测结果:', JSON.stringify(result))
  return result
}
