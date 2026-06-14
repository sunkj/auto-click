/**
 * AutoClick - 脚本管理模块类型定义
 */

/** 步骤类型枚举 */
export type StepType = 'click' | 'type' | 'swipe' | 'script'

/** click 步骤参数 */
export interface ClickStepData {
  x: number
  y: number
  description?: string
}

/** type 步骤参数 */
export interface TypeStepData {
  content: string
  description?: string
}

/** swipe 步骤参数 */
export interface SwipeStepData {
  direction: 'up' | 'down' | 'left' | 'right'
  duration: number
  description?: string
}

/** script 步骤参数 */
export interface ScriptStepData {
  scriptName: string
  description?: string
}

/** 步骤参数联合类型 */
export type StepData = ClickStepData | TypeStepData | SwipeStepData | ScriptStepData

/** 脚本类型 */
export type ScriptType = 'folder' | 'script'

/** 创建脚本时的请求参数 */
export interface CreateScriptParams {
  type?: ScriptType
  parentId?: string | null
  name: string
  filePath?: string | null
  description?: string
  sortOrder?: number
}

/** 更新脚本时的请求参数 */
export interface UpdateScriptParams {
  name?: string
  type?: ScriptType
  parentId?: string | null
  filePath?: string
  description?: string
  sortOrder?: number
}

/** 创建步骤时的请求参数 */
export interface CreateStepParams {
  type: StepType
  data: StepData
}

/** 更新步骤时的请求参数 */
export interface UpdateStepParams {
  type?: StepType
  data?: StepData
}

/** 从文件加载脚本的返回结构 */
export interface LoadFromFileResult {
  script: {
    name: string
    filePath: string
    description?: string
  }
  steps: CreateStepParams[]
}

/** 服务层操作结果 */
export interface ServiceResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
