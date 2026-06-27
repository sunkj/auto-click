import { Annotation, StateGraph, END } from '@langchain/langgraph'
import type { AgentState, Resolution, IntentResult, DynamicToolDef, EngineExecutionResult, AgentError, HistoryEntry } from './types'
import type { EngineStep } from '../script-engine/types'
import { intentParserNode } from './nodes/intent-parser'
import { stepConverterNode } from './nodes/step-converter'
import { scriptEngineExecutorNode } from './nodes/script-engine-executor'

/** 用 Annotation.Root 定义状态模式 */
const AgentStateAnnotation = Annotation.Root({
  userInput: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceSerial: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceResolution: Annotation<Resolution>({ reducer: (a?: Resolution, b?: Resolution) => b ?? a ?? { width: 0, height: 0 } }),
  intent: Annotation<IntentResult | null>({ reducer: (a?: IntentResult | null, b?: IntentResult | null) => b ?? a ?? null }),
  availableTools: Annotation<DynamicToolDef[]>({ reducer: (a?: DynamicToolDef[], b?: DynamicToolDef[]) => b ?? a ?? [] }),
  engineSteps: Annotation<EngineStep[]>({ reducer: (a?: EngineStep[], b?: EngineStep[]) => b ?? a ?? [] }),
  result: Annotation<EngineExecutionResult | null>({ reducer: (a?: EngineExecutionResult | null, b?: EngineExecutionResult | null) => b ?? a ?? null }),
  error: Annotation<AgentError | null>({ reducer: (a?: AgentError | null, b?: AgentError | null) => b ?? a ?? null }),
  history: Annotation<HistoryEntry[]>({ reducer: (a?: HistoryEntry[], b?: HistoryEntry[]) => [...(b ?? a ?? [])] }),
})

/**
 * 创建 AI Agent StateGraph
 *
 * 节点路由逻辑：
 * - intent_parser → keyEvent 类型直接到 step_converter（跳过视觉分析）
 * - intent_parser → 其他类型走 screenshot → visual_analysis → coordinate_mapper → step_converter
 * - step_converter → script_engine_executor → END
 */
export function createAiAgentGraph() {
  // 使用 any 处理 LangGraph 强类型泛型（运行时行为不受影响）
  const workflow = new StateGraph(AgentStateAnnotation) as any

  // 添加节点
  workflow.addNode('intent_parser', intentParserNode)
  workflow.addNode('step_converter', stepConverterNode)
  workflow.addNode('script_engine_executor', scriptEngineExecutorNode)

  // 定义边
  workflow.addEdge('__start__', 'intent_parser')
  workflow.addEdge('intent_parser', 'step_converter')
  workflow.addEdge('step_converter', 'script_engine_executor')
  workflow.addEdge('script_engine_executor', END)

  return workflow.compile()
}
