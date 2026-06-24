import type { AgentState, IntentResult, CalibratedCoord } from '../types'
import type { EngineStep } from '../../script-engine/types'

/**
 * 步骤转换节点
 *
 * 将 AI 解析结果（IntentResult + CalibratedCoord）映射为 ScriptEngine 的 EngineStep[]。
 */
export async function stepConverterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { intent, calibratedCoords } = state

  if (!intent) {
    throw new Error('缺少意图数据，无法转换步骤')
  }

  const engineSteps = convertToEngineSteps(intent, calibratedCoords)

  return { engineSteps }
}

/**
 * 将 AI 结果转换为 EngineStep 列表
 */
function convertToEngineSteps(
  intent: IntentResult,
  calibratedCoords: CalibratedCoord | null,
): EngineStep[] {
  const { action, params } = intent
  const steps: EngineStep[] = []

  switch (action) {
    case 'tap': {
      if (!calibratedCoords || calibratedCoords.points.length === 0) {
        throw new Error('点击操作缺少坐标数据')
      }
      const pt = calibratedCoords.points[0]
      steps.push({
        type: 'click',
        data: { x: pt.x, y: pt.y },
        delay: 0.5,
      })
      break
    }

    case 'swipe': {
      if (!calibratedCoords || calibratedCoords.points.length < 2) {
        // 缺少坐标时使用默认滑动
        steps.push({
          type: 'swipe',
          data: {
            direction: params?.direction || 'left',
            duration: (params?.duration || 300) / 1000, // 转为秒
          },
          delay: 0.5,
        })
      } else {
        const p1 = calibratedCoords.points[0]
        const p2 = calibratedCoords.points[1]
        // ScriptEngine 的 swipe 使用 direction + distance 模式
        // 计算方向和距离
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        const direction = absDx > absDy
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up')
        const distance = Math.round(Math.max(absDx, absDy))
        const durationSec = (calibratedCoords.params.duration || 300) / 1000

        steps.push({
          type: 'swipe',
          data: { direction, distance, duration: durationSec },
          delay: 0.5,
        })
      }
      break
    }

    case 'longPress': {
      if (!calibratedCoords || calibratedCoords.points.length === 0) {
        throw new Error('长按操作缺少坐标数据')
      }
      const pt = calibratedCoords.points[0]
      const durationSec = (calibratedCoords.params.duration || 1500) / 1000
      steps.push({
        type: 'longpress',
        data: { x: pt.x, y: pt.y, duration: durationSec },
        delay: 0.5,
      })
      break
    }

    case 'input': {
      // 输入文本：先点击目标位置聚焦，再输入文本
      if (calibratedCoords && calibratedCoords.points.length > 0) {
        const pt = calibratedCoords.points[0]
        steps.push({
          type: 'click',
          data: { x: pt.x, y: pt.y },
          delay: 0.3,
        })
      }
      const text = params?.text || ''
      if (text) {
        steps.push({
          type: 'type',
          data: { content: text },
          delay: 0.5,
        })
      }
      break
    }

    case 'keyEvent': {
      // keyEvent 转换为 click 类型，特殊标记
      const key = params?.key || 'HOME'
      const keyMap: Record<string, string> = {
        HOME: 'KEYCODE_HOME',
        BACK: 'KEYCODE_BACK',
        MENU: 'KEYCODE_MENU',
        POWER: 'KEYCODE_POWER',
        APP_SWITCH: 'KEYCODE_APP_SWITCH',
      }
      steps.push({
        type: 'click',
        data: { keyEvent: keyMap[key] || 'KEYCODE_HOME' },
        delay: 0.5,
      })
      break
    }

    case 'sequence': {
      // 复合指令：递归转换每个子步骤
      if (params?.steps) {
        for (const subIntent of params.steps) {
          const subSteps = convertToEngineSteps(subIntent, calibratedCoords)
          steps.push(...subSteps)
        }
      }
      break
    }

    default:
      throw new Error(`不支持的动作类型: ${action}`)
  }

  return steps
}
