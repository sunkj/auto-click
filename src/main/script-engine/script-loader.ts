import { ScriptService } from '../script/services/script-service'
import type { ScriptObject, EngineStep } from './types'
import { ScriptEngineError, ErrorCode } from './errors'

/** 脚本加载器 — 从脚本管理模块加载脚本数据并转换为引擎格式 */
export class ScriptLoader {
  private scriptService: ScriptService
  private cache = new Map<string, { script: ScriptObject; mtime: number }>()

  constructor(scriptService: ScriptService) {
    this.scriptService = scriptService
  }

  /** 加载脚本，返回引擎标准格式 */
  async load(scriptId: string): Promise<ScriptObject> {
    const entity = await this.scriptService.getScriptById(scriptId)
    if (!entity) {
      throw new ScriptEngineError(ErrorCode.SCRIPT_NOT_FOUND, `脚本 ${scriptId} 不存在`)
    }
    const steps = await this.scriptService.getStepsByScriptId(scriptId)
    return {
      name: entity.name,
      description: entity.description || undefined,
      steps: steps.map((s) => this.toEngineStep(s)),
    }
  }

  /** 将数据库步骤实体转换为引擎标准步骤 */
  private toEngineStep(stepEntity: any): EngineStep {
    // StepEntity.data 是 JSON 字符串（如 {"x":500,"y":1000}）
    const parsed: Record<string, any> = typeof stepEntity.data === 'string'
      ? JSON.parse(stepEntity.data)
      : stepEntity.data || {}

    const base: EngineStep = {
      type: stepEntity.type as EngineStep['type'],
      data: parsed,
      delay: parsed.delay || undefined,
    }
    // 兼容：click 坐标可能是字符串
    if (base.type === 'click') {
      base.data = {
        x: typeof parsed.x === 'string' ? parseInt(parsed.x) : parsed.x,
        y: typeof parsed.y === 'string' ? parseInt(parsed.y) : parsed.y,
      }
    }
    return base
  }

  clearCache(scriptId?: string): void {
    if (scriptId) this.cache.delete(scriptId)
    else this.cache.clear()
  }
}
