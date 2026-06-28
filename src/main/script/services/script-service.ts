/**
 * AutoClick - 脚本管理服务
 *
 * 运行于 Electron 主进程，负责脚本及其步骤数据的持久化存储与操作管理。
 */
import fs from 'fs/promises'
import { ScriptRepository } from '../repositories/script-repository'
import { StepRepository } from '../repositories/step-repository'
import { ScriptEntity } from '../entities/script-entity'
import { StepEntity } from '../entities/step-entity'
import { initializeDatabase } from '../data-source'
import type {
  CreateScriptParams,
  UpdateScriptParams,
  CreateStepParams,
  UpdateStepParams,
  StepData,
} from '../types'

export class ScriptService {
  private scriptRepo: ScriptRepository
  private stepRepo: StepRepository
  private initialized = false

  constructor() {
    this.scriptRepo = new ScriptRepository()
    this.stepRepo = new StepRepository()
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initializeDatabase()
      this.initialized = true
    }
  }

  // =========================================================================
  // 脚本操作
  // =========================================================================

  async createScript(
    name: string,
    filePath: string,
    description?: string,
    sortOrder?: number,
    parentId?: string | null,
    initialContext?: Record<string, string>
  ): Promise<ScriptEntity> {
    await this.ensureInitialized()
    let order = sortOrder
    if (order === undefined) {
      const maxOrder = await this.scriptRepo.getMaxSortOrder()
      order = maxOrder + 1
    }
    const params: CreateScriptParams = {
      type: 'script',
      parentId: parentId ?? null,
      name,
      filePath,
      description,
      initialContext,
      sortOrder: order,
    }
    return this.scriptRepo.create(params)
  }

  async createFolder(name: string, sortOrder?: number): Promise<ScriptEntity> {
    await this.ensureInitialized()
    let order = sortOrder
    if (order === undefined) {
      const maxOrder = await this.scriptRepo.getMaxSortOrder()
      order = maxOrder + 1
    }
    const params: CreateScriptParams = {
      type: 'folder',
      name,
      filePath: null,
      sortOrder: order,
    }
    return this.scriptRepo.create(params)
  }

  async getAllScripts(): Promise<ScriptEntity[]> {
    await this.ensureInitialized()
    return this.scriptRepo.findAll()
  }

  async getAllFolders(): Promise<ScriptEntity[]> {
    await this.ensureInitialized()
    const all = await this.scriptRepo.findAll()
    return all.filter((s) => s.type === 'folder')
  }

  async getScriptById(id: string): Promise<ScriptEntity | null> {
    await this.ensureInitialized()
    return this.scriptRepo.findById(id)
  }

  async updateScript(id: string, updates: UpdateScriptParams): Promise<ScriptEntity | null> {
    await this.ensureInitialized()
    return this.scriptRepo.update(id, updates)
  }

  async deleteScript(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.scriptRepo.delete(id)
  }

  async updateScriptsOrder(scriptIds: string[]): Promise<void> {
    await this.ensureInitialized()
    await this.scriptRepo.updateOrder(scriptIds)
  }

  // =========================================================================
  // 步骤操作
  // =========================================================================

  async addStep(scriptId: string, stepData: CreateStepParams, insertIndex?: number): Promise<StepEntity> {
    await this.ensureInitialized()
    if (insertIndex === undefined) {
      const maxIndex = await this.stepRepo.getMaxStepIndex(scriptId)
      return this.stepRepo.create(scriptId, maxIndex + 1, stepData)
    }
    await this.stepRepo.shiftStepIndices(scriptId, insertIndex, 1)
    return this.stepRepo.create(scriptId, insertIndex, stepData)
  }

  async getStepsByScriptId(scriptId: string): Promise<StepEntity[]> {
    await this.ensureInitialized()
    return this.stepRepo.findByScriptId(scriptId)
  }

  async updateStep(stepId: number, stepData: UpdateStepParams): Promise<StepEntity | null> {
    await this.ensureInitialized()
    return this.stepRepo.update(stepId, stepData)
  }

  async deleteStep(stepId: number): Promise<boolean> {
    await this.ensureInitialized()
    const step = await this.stepRepo.findById(stepId)
    if (!step) return false
    const deleted = await this.stepRepo.delete(stepId)
    if (deleted) {
      await this.stepRepo.shiftStepIndices(step.scriptId, step.stepIndex + 1, -1)
    }
    return deleted
  }

  async replaceSteps(scriptId: string, steps: CreateStepParams[]): Promise<StepEntity[]> {
    await this.ensureInitialized()
    await this.stepRepo.deleteByScriptId(scriptId)
    const newSteps: StepEntity[] = []
    for (let index = 0; index < steps.length; index++) {
      const step = await this.stepRepo.create(scriptId, index + 1, steps[index])
      newSteps.push(step)
    }
    return newSteps
  }

  async updateStepsOrder(scriptId: string, stepIds: number[]): Promise<void> {
    await this.ensureInitialized()
    await this.stepRepo.updateOrder(scriptId, stepIds)
  }

  // =========================================================================
  // 文件同步
  // =========================================================================

  async syncToFile(scriptId: string): Promise<boolean> {
    await this.ensureInitialized()
    const script = await this.scriptRepo.findById(scriptId)
    if (!script || !script.filePath) return false

    const steps = await this.stepRepo.findByScriptId(scriptId)
    const stepsJs = steps.map((step) => {
      const data = JSON.parse(step.data) as StepData
      return `  { type: '${step.type}', data: ${JSON.stringify(data)} }`
    })
    const fileContent = [
      '// AutoClick - 自动生成，请勿手动修改',
      `// Script: ${script.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
      'const steps = [',
      stepsJs.join(',\n'),
      '];',
      '',
      'export default steps;',
      '',
    ].join('\n')
    await fs.writeFile(script.filePath, fileContent, 'utf-8')
    return true
  }

  async loadFromFile(filePath: string): Promise<{ script: ScriptEntity; steps: StepEntity[] } | null> {
    await this.ensureInitialized()
    try {
      await fs.access(filePath)
    } catch {
      return null
    }
    const fileModule = require(filePath)
    const stepsData: CreateStepParams[] = fileModule.default ?? fileModule.steps ?? []
    const fileName = filePath.replace(/^.*[/\\]/, '').replace('.js', '')
    const params: CreateScriptParams = { name: fileName, filePath }
    const script = await this.scriptRepo.create(params)
    const steps: StepEntity[] = []
    for (let index = 0; index < stepsData.length; index++) {
      const step = await this.stepRepo.create(script.id, index + 1, stepsData[index])
      steps.push(step)
    }
    return { script, steps }
  }
}
