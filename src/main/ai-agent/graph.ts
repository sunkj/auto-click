/**
 * 解析子图 — 意图解析 → 步骤转换
 *
 * 注意：check_text 条件判断不在本图中处理，而是由 execute-ai-workflow
 * 在执行阶段实时截图+调用VLM来决策。本图只做意图解析和步骤转换。
 */
import { Annotation, StateGraph, END } from '@langchain/langgraph'
import type { AgentState, Resolution, IntentResult, DynamicToolDef } from '../common/types'
import type { EngineStep } from '../common/types'
import { intentParserNode } from './nodes/intent-parser'
import { stepConverterNode } from './nodes/step-converter'

const ParseAnnotation = Annotation.Root({
  userInput: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceSerial: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceResolution: Annotation<Resolution>({ reducer: (a?: Resolution, b?: Resolution) => b ?? a ?? { width: 0, height: 0 } }),
  intent: Annotation<IntentResult | null>({ reducer: (a?: IntentResult | null, b?: IntentResult | null) => b ?? a ?? null }),
  availableTools: Annotation<DynamicToolDef[]>({ reducer: (a?: DynamicToolDef[], b?: DynamicToolDef[]) => b ?? a ?? [] }),
  engineSteps: Annotation<EngineStep[]>({ reducer: (a?: EngineStep[], b?: EngineStep[]) => b ?? a ?? [] }),
})

export function createParseGraph() {
  const workflow = new StateGraph(ParseAnnotation) as any

  workflow.addNode('intent_parser', intentParserNode)
  workflow.addNode('step_converter', stepConverterNode)

  workflow.addEdge('__start__', 'intent_parser')
  workflow.addEdge('intent_parser', 'step_converter')
  workflow.addEdge('step_converter', END)

  return workflow.compile()
}
