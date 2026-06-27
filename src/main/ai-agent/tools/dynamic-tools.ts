/**
 * 动态工具生成器
 *
 * 从数据库中加载录制记录，结合内置操作（home / openApp），
 * 生成可供 AI 调用的动态工具列表。
 *
 * AI 调用流程：
 * 1. 用户描述需求
 * 2. AI 查看可用动态工具
 * 3. 有匹配的直接调用（call_tool），没有则回退常规流程
 */
import { RecordedClickRepository } from '../../record-script/repositories/recorded-click-repository'
import { initializeDatabase } from '../../script/data-source'

// =============================================================================
// 类型定义
// =============================================================================

export type ToolSource = 'recorded_click' | 'builtin'

export interface DynamicToolDef {
  /** 工具唯一标识 */
  id: string
  /** 工具名称（AI 匹配用） */
  name: string
  /** 工具描述 */
  description: string
  /** 来源类型 */
  source: ToolSource
  /** 内置动作类型（source=builtin 时有效） */
  builtinAction?: 'home' | 'openApp'
  /** 内置动作的目标 App 名称（openApp 时有效） */
  appName?: string
  /** 录制的点击坐标（source=recorded_click 时有效） */
  clickPos?: { x: number; y: number }
}

// =============================================================================
// 工具加载
// =============================================================================

/**
 * 加载所有可用的动态工具
 */
export async function loadDynamicTools(): Promise<DynamicToolDef[]> {
  const tools: DynamicToolDef[] = []

  // 1. 内置工具
  tools.push({
    id: 'builtin:home',
    name: '回到桌面',
    description: '返回手机主屏幕 / 桌面',
    source: 'builtin',
    builtinAction: 'home',
  })

  // 2. 从数据库加载录制记录
  try {
    await initializeDatabase()
    const repo = new RecordedClickRepository()
    const result = await repo.findAll(1, 1000)
    for (const item of result.items) {
      tools.push({
        id: `recorded_click:${item.id}`,
        name: item.name,
        description: `点击位置 (${item.x}, ${item.y}) — ${item.name}`,
        source: 'recorded_click',
        clickPos: { x: item.x, y: item.y },
      })
    }
  } catch (err) {
    console.warn('[DynamicTools] 加载录制记录失败:', err)
  }

  return tools
}

/**
 * 生成 AI 可读的工具描述文本（注入到提示词中）
 */
export function formatToolsForPrompt(tools: DynamicToolDef[]): string {
  if (tools.length === 0) return '（暂无可用快捷工具）'

  const lines = tools.map((t) => {
    if (t.source === 'builtin') {
      if (t.builtinAction === 'home') {
        return `- "${t.name}"：返回手机主屏幕`
      }
      if (t.builtinAction === 'openApp') {
        return `- "${t.name}"：打开指定 App`
      }
    }
    if (t.source === 'recorded_click') {
      return `- "${t.name}"：在位置 (${t.clickPos!.x}, ${t.clickPos!.y}) 处执行点击`
    }
    return ''
  })

  return lines.filter(Boolean).join('\n')
}

/**
 * 根据工具名称查找工具定义
 */
export function findToolByName(tools: DynamicToolDef[], name: string): DynamicToolDef | undefined {
  return tools.find(
    (t) => t.name === name || name.includes(t.name) || t.name.includes(name),
  )
}
