import type { ScriptObject, EngineStep } from './types'
import { ScriptEngineError, ErrorCode } from './errors'

/** 脚本校验器 */
export class ScriptValidator {
  /** 校验整个脚本 */
  validate(script: ScriptObject): void {
    if (!script || typeof script !== 'object') {
      throw new ScriptEngineError(ErrorCode.SCRIPT_FORMAT_ERROR, '脚本格式无效')
    }
    if (!Array.isArray(script.steps) || script.steps.length === 0) {
      throw new ScriptEngineError(ErrorCode.SCRIPT_FORMAT_ERROR, '脚本步骤不能为空')
    }
    script.steps.forEach((step, i) => this.validateStep(step, i))
  }

  /** 校验单个步骤 */
  validateStep(step: EngineStep, index: number): void {
    if (!step || typeof step !== 'object') {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `步骤 ${index} 格式无效`, index)
    }
    if (!['click', 'type', 'swipe', 'longpress'].includes(step.type)) {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `步骤 ${index} 类型 "${step.type}" 不支持`, index)
    }
    this.validateData(step.type, step.data, index)
  }

  private validateData(type: string, data: Record<string, any>, index: number): void {
    if (!data || typeof data !== 'object') {
      throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `步骤 ${index} 参数缺失`, index)
    }
    switch (type) {
      case 'click':
        if (typeof data.x !== 'number' || typeof data.y !== 'number') {
          throw new ScriptEngineError(ErrorCode.COORD_OUT_OF_RANGE, `步骤 ${index} 坐标无效`, index)
        }
        break
      case 'type':
        if (!data.content) {
          throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `步骤 ${index} 输入内容不能为空`, index)
        }
        break
      case 'swipe':
        if (!['up', 'down', 'left', 'right'].includes(data.direction)) {
          throw new ScriptEngineError(ErrorCode.STEP_TYPE_INVALID, `步骤 ${index} 滑动方向无效`, index)
        }
        break
      case 'longpress':
        if (typeof data.x !== 'number' || typeof data.y !== 'number') {
          throw new ScriptEngineError(ErrorCode.COORD_OUT_OF_RANGE, `步骤 ${index} 坐标无效`, index)
        }
        break
    }
  }
}
