import { Annotation, StateGraph, END } from '@langchain/langgraph'
import type { AgentState, Resolution, IntentResult, DynamicToolDef, EngineExecutionResult, AgentError, HistoryEntry, ScreenCheckResult } from './types'
import type { EngineStep } from '../script-engine/types'
import { intentParserNode } from './nodes/intent-parser'
import { screenshotNode } from './nodes/screenshot'
import { textCheckNode } from './nodes/text-check'
import { stepConverterNode } from './nodes/step-converter'
import { scriptEngineExecutorNode } from './nodes/script-engine-executor'

/** 用 Annotation.Root 定义状态模式 */
const AgentStateAnnotation = Annotation.Root({
  userInput: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceSerial: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceResolution: Annotation<Resolution>({ reducer: (a?: Resolution, b?: Resolution) => b ?? a ?? { width: 0, height: 0 } }),
  intent: Annotation<IntentResult | null>({ reducer: (a?: IntentResult | null, b?: IntentResult | null) => b ?? a ?? null }),
  availableTools: Annotation<DynamicToolDef[]>({ reducer: (a?: DynamicToolDef[], b?: DynamicToolDef[]) => b ?? a ?? [] }),
  screenshotBase64: Annotation<string | null>({ reducer: (a?: string | null, b?: string | null) => b ?? a ?? null }),
  screenCheckResult: Annotation<ScreenCheckResult | null>({ reducer: (a?: ScreenCheckResult | null, b?: ScreenCheckResult | null) => b ?? a ?? null }),
  engineSteps: Annotation<EngineStep[]>({ reducer: (a?: EngineStep[], b?: EngineStep[]) => b ?? a ?? [] }),
  result: Annotation<EngineExecutionResult | null>({ reducer: (a?: EngineExecutionResult | null, b?: EngineExecutionResult | null) => b ?? a ?? null }),
  error: Annotation<AgentError | null>({ reducer: (a?: AgentError | null, b?: AgentError | null) => b ?? a ?? null }),
  history: Annotation<HistoryEntry[]>({ reducer: (a?: HistoryEntry[], b?: HistoryEntry[]) => [...(b ?? a ?? [])] }),
})

/** 判断 intent 是否包含 check_text 步骤 */
function hasCheckText(intent: IntentResult | null): boolean {
  if (!intent) return false
  if (intent.action === 'check_text') return true
  if (intent.action === 'sequence') {
    return intent.params?.steps?.some((s) => s.action === 'check_text') ?? false
  }
  return false
}

/**
 * 创建 AI Agent StateGraph
 *
 * 节点路由：
 * - 如果包含 check_text 步骤 → screenshot → text_check → step_converter → executor
 * - 其他 → 直接 step_converter → executor
 */
export function createAiAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation) as any

  workflow.addNode('intent_parser', intentParserNode)
  workflow.addNode('screenshot', screenshotNode)
  workflow.addNode('text_check', textCheckNode)
  workflow.addNode('step_converter', stepConverterNode)
  workflow.addNode('script_engine_executor', scriptEngineExecutorNode)

  workflow.addEdge('__start__', 'intent_parser')

  workflow.addConditionalEdges('intent_parser', (state: AgentState) => {
    return hasCheckText(state.intent) ? 'screenshot' : 'step_converter'
  })

  workflow.addEdge('screenshot', 'text_check')
  workflow.addEdge('text_check', 'step_converter')
  workflow.addEdge('step_converter', 'script_engine_executor')
  workflow.addEdge('script_engine_executor', END)

  return workflow.compile()
}
