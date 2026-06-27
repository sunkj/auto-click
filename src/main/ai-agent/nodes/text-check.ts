/**
 * 文字检测节点
 *
 * 从 state.screenshotBase64 读取截图，调用智谱判断
 * 当前屏幕是否包含目标文字或处于指定状态。
 * 结果存入 state.screenCheckResult，然后交给 step_converter 继续处理。
 */
import type { AgentState } from '../types'
import { checkScreenText } from '../tools/text-check'

export async function textCheckNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, screenshotBase64 } = state

  if (!screenshotBase64) {
    throw new Error('缺少截图数据，无法进行文字检测')
  }

  // 从 intent 或 intent.steps 中找出当前要执行的 check_text 子步骤
  const checkStep = intent?.action === 'check_text'
    ? intent
    : intent?.params?.steps?.find((s) => s.action === 'check_text')

  if (!checkStep) {
    throw new Error('缺少文字检测意图')
  }

  const checkMode = checkStep.params?.checkMode || 'text'
  const screenCheckResult = await checkScreenText(screenshotBase64, checkStep.target, checkMode)

  return { screenCheckResult }
}
