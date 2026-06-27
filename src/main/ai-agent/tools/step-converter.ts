/**
 * 步骤转换工具
 *
 * 将 AI 解析结果（IntentResult + CalibratedCoord）映射为 ScriptEngine 的 EngineStep[]。
 * 引擎支持的步骤类型：click / type / swipe / longpress / home / openApp
 */
import type { IntentResult, CalibratedCoord, DynamicToolDef } from '../types'
import type { EngineStep } from '../../script-engine/types'

/**
 * 将 AI 结果转换为 EngineStep 列表
 *
 * @param intent AI 解析的意图
 * @param calibratedCoords 校准后的坐标（用于 tap / swipe / longPress）
 * @param availableTools 可用的动态工具列表（用于 call_tool 查找）
 */
export function convertToEngineSteps(
  intent: IntentResult,
  calibratedCoords: CalibratedCoord | null,
  availableTools?: DynamicToolDef[],
): EngineStep[] {
  const { action, params } = intent
  const steps: EngineStep[] = []

  switch (action) {
    case 'tap': {
      if (!calibratedCoords || calibratedCoords.points.length === 0) {
        throw new Error('[步骤转换] 点击操作缺少坐标数据')
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
            duration: (params?.duration || 300) / 1000,
          },
          delay: 0.5,
        })
      } else {
        const p1 = calibratedCoords.points[0]
        const p2 = calibratedCoords.points[1]
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
        throw new Error('[步骤转换] 长按操作缺少坐标数据')
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

    case 'home': {
      // 返回桌面 / 回到首页
      steps.push({
        type: 'home',
        data: {},
        delay: 0.5,
      })
      break
    }

    case 'openApp': {
      // 打开 App：转换为 script-engine 的 openApp 步骤类型
      const appName = intent.target
      if (!appName) {
        throw new Error('[步骤转换] 打开 App 缺少应用名称')
      }
      steps.push({
        type: 'openApp',
        data: { appName },
        delay: 0.5,
      })
      break
    }

    case 'keyEvent': {
      const key = params?.key || 'HOME'
      const keyMap: Record<string, string> = {
        HOME: 'KEYCODE_HOME',
        BACK: 'KEYCODE_BACK',
        MENU: 'KEYCODE_MENU',
        POWER: 'KEYCODE_POWER',
        APP_SWITCH: 'KEYCODE_APP_SWITCH',
      }
      // HOME 按键使用引擎的专用 home 步骤类型
      if (key === 'HOME') {
        steps.push({
          type: 'home',
          data: {},
          delay: 0.5,
        })
      } else {
        steps.push({
          type: 'click',
          data: { keyEvent: keyMap[key] || 'KEYCODE_HOME' },
          delay: 0.5,
        })
      }
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

    case 'call_tool': {
      // 查找匹配的动态工具
      const toolName = intent.target
      const tool = availableTools?.find(
        (t) => t.name === toolName || toolName.includes(t.name) || t.name.includes(toolName),
      )
      if (!tool) {
        throw new Error(`[步骤转换] 未找到匹配的快捷工具: "${toolName}"`)
      }

      if (tool.source === 'recorded_click' && tool.clickPos) {
        // 录制记录 → 点击对应坐标
        steps.push({
          type: 'click',
          data: { x: tool.clickPos.x, y: tool.clickPos.y },
          delay: 0.5,
        })
      } else if (tool.source === 'builtin') {
        if (tool.builtinAction === 'home') {
          steps.push({ type: 'home', data: {}, delay: 0.5 })
        } else if (tool.builtinAction === 'openApp') {
          const appName = tool.appName || intent.target
          steps.push({
            type: 'openApp',
            data: { appName },
            delay: 0.5,
          })
        }
      }
      break
    }

    default:
      throw new Error(`[步骤转换] 不支持的动作类型: ${action}`)
  }

  return steps
}
