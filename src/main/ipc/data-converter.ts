/**
 * AutoClick - 数据模型转换器
 *
 * 桥接主进程 Service 层数据模型与渲染进程 UI 数据模型。
 */

import type { ScriptEntity } from '../database/entities/ScriptEntity'
import type { StepEntity } from '../database/entities/StepEntity'
import type {
  StepData,
  ClickStepData,
  TypeStepData,
  SwipeStepData,
  ScriptStepData,
  CreateStepParams,
} from '../types/service.types'

// =============================================================================
// 渲染进程使用的数据模型（与 stores/scriptStore.ts 匹配）
// =============================================================================

export interface RendererStep {
  id: string
  index: number
  type: 'click' | 'type' | 'swipe' | 'script'
  params: Record<string, string>
  description: string
}

export interface RendererScript {
  id: string
  name: string
  type: 'folder' | 'script'
  parentId: string | null
  steps?: RendererStep[]
}

// =============================================================================
// 转换函数：Entity → Renderer
// =============================================================================

/**
 * 将步骤数据对象展平为 params 字典 + description
 */
function flattenStepData(type: string, data: StepData): {
  params: Record<string, string>
  description: string
} {
  const params: Record<string, string> = {}
  let description = ''

  switch (type) {
    case 'click': {
      const d = data as ClickStepData
      params.x = String(d.x)
      params.y = String(d.y)
      description = d.description ?? `(${d.x}, ${d.y})`
      break
    }
    case 'type': {
      const d = data as TypeStepData
      params.text = d.content
      description = d.description ?? `"${d.content}"`
      break
    }
    case 'swipe': {
      const d = data as SwipeStepData
      params.direction = d.direction.charAt(0).toUpperCase() + d.direction.slice(1)
      params.duration = String(d.duration)
      description = d.description ?? `${params.direction} (${d.duration}s)`
      break
    }
    case 'script': {
      const d = data as ScriptStepData
      params.scriptName = d.scriptName
      description = d.description ?? d.scriptName
      break
    }
  }

  return { params, description }
}

/**
 * 将 StepEntity 转换为渲染进程的 Step
 */
export function stepEntityToRenderer(step: StepEntity): RendererStep {
  const data = JSON.parse(step.data) as StepData
  const { params, description } = flattenStepData(step.type, data)

  return {
    id: String(step.id),
    index: step.stepIndex,
    type: step.type as RendererStep['type'],
    params,
    description,
  }
}

/**
 * 将 ScriptEntity 转换为渲染进程的 Script
 */
export function scriptEntityToRenderer(script: ScriptEntity): RendererScript {
  return {
    id: script.id,
    name: script.name,
    type: (script.type as RendererScript['type']) || 'script',
    parentId: script.parentId ?? null,
    steps: script.steps?.map(stepEntityToRenderer),
  }
}

// =============================================================================
// 转换函数：Renderer → Service
// =============================================================================

/**
 * 将渲染进程的步骤参数重建为 Service 层的 StepData
 */
export function rendererParamsToStepData(
  type: string,
  params: Record<string, string>
): StepData {
  switch (type) {
    case 'click':
      return {
        x: Number(params.x),
        y: Number(params.y),
        description: params.description || undefined,
      } as ClickStepData

    case 'type':
      return {
        content: params.text || '',
        description: params.description || undefined,
      } as TypeStepData

    case 'swipe':
      return {
        direction: (params.direction?.toLowerCase() as SwipeStepData['direction']) || 'up',
        duration: Number(params.duration) || 1,
        description: params.description || undefined,
      } as SwipeStepData

    case 'script':
      return {
        scriptName: params.scriptName || '',
        description: params.description || undefined,
      } as ScriptStepData

    default:
      throw new Error(`未知的步骤类型: ${type}`)
  }
}

/**
 * 将渲染进程的步骤表单数据转换为 CreateStepParams
 */
export function rendererFormToCreateStep(
  type: string,
  params: Record<string, string>
): CreateStepParams {
  return {
    type: type as CreateStepParams['type'],
    data: rendererParamsToStepData(type, params),
  }
}
