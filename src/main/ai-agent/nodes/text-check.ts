import type { AgentState } from '../../common/types'
import { checkScreenText } from '../tools/text-check'

export async function textCheckNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, screenshotBase64 } = state
  if (!screenshotBase64) throw new Error('缺少截图数据')

  const checkStep = intent?.action === 'check_text'
    ? intent
    : intent?.params?.steps?.find((s) => s.action === 'check_text')

  if (!checkStep) throw new Error('缺少文字检测意图')

  const checkMode = checkStep.params?.checkMode || 'text'
  const screenCheckResult = await checkScreenText(screenshotBase64, checkStep.target, checkMode)

  return { screenCheckResult }
}
