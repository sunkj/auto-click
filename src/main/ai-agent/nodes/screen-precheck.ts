/**
 * 屏幕预检节点
 *
 * 用于 openApp 动作：先检查当前屏幕上下文，
 * 如果处于某个 App 内，标记 needsHomeFirst=true，
 * 让步骤转换时先插入回桌面步骤。
 */
import type { AgentState } from '../types'
import { detectScreenContext } from '../tools/screen-context'

export async function screenPrecheckNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, deviceSerial } = state

  if (!intent || intent.action !== 'openApp') {
    return { needsHomeFirst: false }
  }

  if (!deviceSerial) {
    throw new Error('缺少设备序列号，无法检测屏幕上下文')
  }

  // 检测当前屏幕上下文
  const screenCtx = await detectScreenContext(deviceSerial)
  console.log('[ScreenPrecheck] 屏幕上下文:', JSON.stringify(screenCtx))

  // 如果在某个 App 内（非桌面、非锁屏），需要先回桌面
  const needsHomeFirst = screenCtx.context === 'in_app'

  if (needsHomeFirst) {
    console.log('[ScreenPrecheck] 当前在 App 内，打开 App 前将先回到桌面')
  }

  return { needsHomeFirst }
}
