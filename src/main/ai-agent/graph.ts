/**
 * 解析子图 — 意图解析 → 步骤转换
 */
import { Annotation, StateGraph, END } from '@langchain/langgraph'
import type { AgentState, Resolution, IntentResult, DynamicToolDef, ScreenCheckResult } from '../common/types'
import type { EngineStep } from '../common/types'
import { intentParserNode } from './nodes/intent-parser'
import { screenshotNode } from './nodes/screenshot'
import { textCheckNode } from './nodes/text-check'
import { stepConverterNode } from './nodes/step-converter'

const ParseAnnotation = Annotation.Root({
  userInput: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceSerial: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceResolution: Annotation<Resolution>({ reducer: (a?: Resolution, b?: Resolution) => b ?? a ?? { width: 0, height: 0 } }),
  intent: Annotation<IntentResult | null>({ reducer: (a?: IntentResult | null, b?: IntentResult | null) => b ?? a ?? null }),
  availableTools: Annotation<DynamicToolDef[]>({ reducer: (a?: DynamicToolDef[], b?: DynamicToolDef[]) => b ?? a ?? [] }),
  screenshotBase64: Annotation<string | null>({ reducer: (a?: string | null, b?: string | null) => b ?? a ?? null }),
  screenCheckResult: Annotation<ScreenCheckResult | null>({ reducer: (a?: ScreenCheckResult | null, b?: ScreenCheckResult | null) => b ?? a ?? null }),
  engineSteps: Annotation<EngineStep[]>({ reducer: (a?: EngineStep[], b?: EngineStep[]) => b ?? a ?? [] }),
})

function hasCheckText(intent: IntentResult | null): boolean {
  if (!intent) return false
  if (intent.action === 'check_text') return true
  if (intent.action === 'sequence') {
    return intent.params?.steps?.some((s) => s.action === 'check_text') ?? false
  }
  return false
}

export function createParseGraph() {
  const workflow = new StateGraph(ParseAnnotation) as any

  workflow.addNode('intent_parser', intentParserNode)
  workflow.addNode('screenshot', screenshotNode)
  workflow.addNode('text_check', textCheckNode)
  workflow.addNode('step_converter', stepConverterNode)

  workflow.addEdge('__start__', 'intent_parser')

  workflow.addConditionalEdges('intent_parser', (state: AgentState) => {
    return hasCheckText(state.intent) ? 'screenshot' : 'step_converter'
  })

  workflow.addEdge('screenshot', 'text_check')
  workflow.addEdge('text_check', 'step_converter')
  workflow.addEdge('step_converter', END)

  return workflow.compile()
}
