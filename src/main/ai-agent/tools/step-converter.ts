import type { IntentResult, CalibratedCoord, DynamicToolDef, EngineStep } from '../../common/types'

export function convertToEngineSteps(
  intent: IntentResult, calibratedCoords: CalibratedCoord | null, availableTools?: DynamicToolDef[],
): EngineStep[] {
  const { action, params, target } = intent
  const steps: EngineStep[] = []
  const desc = (d: string) => ({ description: d })

  switch (action) {
    case 'tap': {
      if (!calibratedCoords || calibratedCoords.points.length === 0) {
        console.warn('[步骤转换] 点击缺少坐标，跳过:', target)
        break
      }
      steps.push({ type: 'click', data: { x: calibratedCoords.points[0].x, y: calibratedCoords.points[0].y, ...desc(`点击 ${target}`) }, delay: 0.5 })
      break
    }
    case 'swipe': {
      if (!calibratedCoords || calibratedCoords.points.length < 2) {
        steps.push({ type: 'swipe', data: { direction: params?.direction || 'left', duration: (params?.duration || 300) / 1000, ...desc(`滑动 ${params?.direction || ''}`) }, delay: 0.5 })
      } else {
        const [p1, p2] = calibratedCoords.points
        const dx = p2.x - p1.x; const dy = p2.y - p1.y
        const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
        steps.push({ type: 'swipe', data: { direction, distance: Math.round(Math.max(Math.abs(dx), Math.abs(dy))), duration: (calibratedCoords.params.duration || 300) / 1000, ...desc(`滑动 ${direction}`) }, delay: 0.5 })
      }
      break
    }
    case 'longPress': {
      if (!calibratedCoords || calibratedCoords.points.length === 0) throw new Error('[步骤转换] 长按缺少坐标')
      steps.push({ type: 'longpress', data: { x: calibratedCoords.points[0].x, y: calibratedCoords.points[0].y, duration: (calibratedCoords.params.duration || 1500) / 1000, ...desc(`长按 ${target}`) }, delay: 0.5 })
      break
    }
    case 'input': {
      if (calibratedCoords && calibratedCoords.points.length > 0) steps.push({ type: 'click', data: { x: calibratedCoords.points[0].x, y: calibratedCoords.points[0].y, ...desc(`聚焦输入框`) }, delay: 0.3 })
      if (params?.text) steps.push({ type: 'type', data: { content: params.text, ...desc(`输入 ${params.text}`) }, delay: 0.5 })
      break
    }
    case 'home': steps.push({ type: 'home', data: { ...desc('回主屏幕') }, delay: 0.5 }); break
    case 'openApp': {
      if (!target) throw new Error('[步骤转换] 打开 App 缺少应用名称')
      steps.push({ type: 'openApp', data: { appName: target, ...desc(`打开 ${target}`) }, delay: 0.5 })
      break
    }
    case 'keyEvent': {
      const key = params?.key || 'HOME'
      const keyMap: Record<string, string> = { HOME: 'KEYCODE_HOME', BACK: 'KEYCODE_BACK', MENU: 'KEYCODE_MENU', POWER: 'KEYCODE_POWER', APP_SWITCH: 'KEYCODE_APP_SWITCH' }
      if (key === 'HOME') steps.push({ type: 'home', data: { ...desc('回主屏幕') }, delay: 0.5 })
      else steps.push({ type: 'click', data: { keyEvent: keyMap[key] || 'KEYCODE_HOME', ...desc(`按键 ${key}`) }, delay: 0.5 })
      break
    }
    case 'sequence': {
      if (params?.steps) for (const s of params.steps) steps.push(...convertToEngineSteps(s, calibratedCoords, availableTools))
      break
    }
    case 'call_tool': {
      const tool = availableTools?.find(t => t.name === target || target.includes(t.name) || t.name.includes(target))
      if (!tool) throw new Error(`[步骤转换] 未找到工具: "${target}"`)
      if (tool.source === 'recorded_click' && tool.clickPos) steps.push({ type: 'click', data: { x: tool.clickPos.x, y: tool.clickPos.y, ...desc(`工具-${tool.name}`) }, delay: 0.5 })
      else if (tool.source === 'builtin' && tool.builtinAction === 'home') steps.push({ type: 'home', data: { ...desc(`工具-${tool.name}`) }, delay: 0.5 })
      else if (tool.source === 'builtin' && tool.builtinAction === 'openApp') steps.push({ type: 'openApp', data: { appName: tool.appName || target, ...desc(`工具-${tool.name}`) }, delay: 0.5 })
      break
    }
    default: throw new Error(`[步骤转换] 不支持的动作: ${action}`)
  }
  return steps
}
