export type ToolSource = 'recorded_click' | 'builtin'

export interface DynamicToolDef {
  id: string
  name: string
  description: string
  source: ToolSource
  builtinAction?: 'home' | 'openApp'
  appName?: string
  clickPos?: { x: number; y: number }
}

import { RecordedClickRepository } from '../../record-script/repositories/recorded-click-repository'
import { initializeDatabase } from '../../script/data-source'

export async function loadDynamicTools(): Promise<DynamicToolDef[]> {
  const tools: DynamicToolDef[] = []
  tools.push({ id: 'builtin:home', name: '回到桌面', description: '返回手机主屏幕', source: 'builtin', builtinAction: 'home' })

  try {
    await initializeDatabase()
    const repo = new RecordedClickRepository()
    const result = await repo.findAll(1, 1000)
    for (const item of result.items) {
      tools.push({ id: `recorded_click:${item.id}`, name: item.name, description: `点击位置 (${item.x}, ${item.y}) — ${item.name}`, source: 'recorded_click', clickPos: { x: item.x, y: item.y } })
    }
  } catch (err) { console.warn('[DynamicTools] 加载录制记录失败:', err) }

  return tools
}

export function formatToolsForPrompt(tools: DynamicToolDef[]): string {
  if (tools.length === 0) return '（暂无可用快捷工具）'
  return tools.map(t => {
    if (t.source === 'builtin') return t.builtinAction === 'home' ? `- "${t.name}"：返回手机主屏幕` : `- "${t.name}"：打开指定 App`
    return `- "${t.name}"：在位置 (${t.clickPos!.x}, ${t.clickPos!.y}) 处执行点击`
  }).filter(Boolean).join('\n')
}
