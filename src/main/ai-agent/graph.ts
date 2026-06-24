import { Annotation, StateGraph, END } from '@langchain/langgraph'
import type { AgentState, Resolution, IntentResult, VisualResult, CalibratedCoord, EngineExecutionResult, AgentError, HistoryEntry } from './types'
import type { EngineStep } from '../script-engine/types'
import { intentParserNode } from './nodes/intent-parser'
import { screenshotNode } from './nodes/screenshot'
import { visualAnalysisNode } from './nodes/visual-analysis'
import { coordinateMapperNode } from './nodes/coordinate-mapper'
import { stepConverterNode } from './nodes/step-converter'
import { scriptEngineExecutorNode } from './nodes/script-engine-executor'

/** 用 Annotation.Root 定义状态模式 */
const AgentStateAnnotation = Annotation.Root({
  userInput: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceSerial: Annotation<string>({ reducer: (a?: string, b?: string) => b ?? a ?? '' }),
  deviceResolution: Annotation<Resolution>({ reducer: (a?: Resolution, b?: Resolution) => b ?? a ?? { width: 0, height: 0 } }),
  intent: Annotation<IntentResult | null>({ reducer: (a?: IntentResult | null, b?: IntentResult | null) => b ?? a ?? null }),
  screenshotBase64: Annotation<string | null>({ reducer: (a?: string | null, b?: string | null) => b ?? a ?? null }),
  screenshotPath: Annotation<string | null>({ reducer: (a?: string | null, b?: string | null) => b ?? a ?? null }),
  visualResult: Annotation<VisualResult | null>({ reducer: (a?: VisualResult | null, b?: VisualResult | null) => b ?? a ?? null }),
  calibratedCoords: Annotation<CalibratedCoord | null>({ reducer: (a?: CalibratedCoord | null, b?: CalibratedCoord | null) => b ?? a ?? null }),
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
  workflow.addNode('screenshot', screenshotNode)
  workflow.addNode('visual_analysis', visualAnalysisNode)
  workflow.addNode('coordinate_mapper', coordinateMapperNode)
  workflow.addNode('step_converter', stepConverterNode)
  workflow.addNode('script_engine_executor', scriptEngineExecutorNode)

  // 定义边
  workflow.addEdge('__start__', 'intent_parser')

  // 意图理解后的条件路由
  workflow.addConditionalEdges('intent_parser', (state: AgentState) => {
    if (state.intent?.action === 'keyEvent') {
      return 'step_converter' // 系统按键跳过视觉分析
    }
    return 'screenshot' // 需要坐标的走视觉链路
  })

  workflow.addEdge('screenshot', 'visual_analysis')
  workflow.addEdge('visual_analysis', 'coordinate_mapper')
  workflow.addEdge('coordinate_mapper', 'step_converter')
  workflow.addEdge('step_converter', 'script_engine_executor')
  workflow.addEdge('script_engine_executor', END)

  return workflow.compile()
}
