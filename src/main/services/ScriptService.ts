/**
 * AutoClick - 脚本管理服务
 *
 * 运行于 Electron 主进程，负责脚本及其步骤数据的持久化存储与操作管理。
 * 通过 TypeORM + SQLite 实现数据持久化，对外提供统一的数据访问接口。
 */
import fs from 'fs/promises'
import path from 'path'
import { ScriptRepository } from '../database/repositories/ScriptRepository'
import { StepRepository } from '../database/repositories/StepRepository'
import { ScriptEntity } from '../database/entities/ScriptEntity'
import { StepEntity } from '../database/entities/StepEntity'
import { initializeDatabase } from '../database/data-source'
import type {
  CreateScriptParams,
  UpdateScriptParams,
  CreateStepParams,
  UpdateStepParams,
  StepData,
} from '../types/service.types'

export class ScriptService {
  private scriptRepo: ScriptRepository
  private stepRepo: StepRepository
  private initialized = false

  constructor() {
    this.scriptRepo = new ScriptRepository()
    this.stepRepo = new StepRepository()
  }

  // =========================================================================
  // 数据库初始化
  // =========================================================================

  /**
   * 确保数据库已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initializeDatabase()
      this.initialized = true
    }
  }

  // =========================================================================
  // 脚本操作
  // =========================================================================

  /**
   * 创建新脚本
   *
   * 未指定 sortOrder 时，自动追加到末尾（当前最大排序值 + 1）
   */
  async createScript(
    name: string,
    filePath: string,
    description?: string,
    sortOrder?: number,
    parentId?: string | null
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
      sortOrder: order,
    }

    return this.scriptRepo.create(params)
  }

  /**
   * 创建新文件夹
   */
  async createFolder(
    name: string,
    sortOrder?: number
  ): Promise<ScriptEntity> {
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

  /**
   * 获取所有脚本和文件夹（按 sort_order 排序，含 steps 关联）
   */
  async getAllScripts(): Promise<ScriptEntity[]> {
    await this.ensureInitialized()
    return this.scriptRepo.findAll()
  }

  /**
   * 获取所有文件夹
   */
  async getAllFolders(): Promise<ScriptEntity[]> {
    await this.ensureInitialized()
    const all = await this.scriptRepo.findAll()
    return all.filter((s) => s.type === 'folder')
  }

  /**
   * 根据ID获取脚本（含 steps 关联）
   */
  async getScriptById(id: string): Promise<ScriptEntity | null> {
    await this.ensureInitialized()
    return this.scriptRepo.findById(id)
  }

  /**
   * 更新脚本信息
   */
  async updateScript(
    id: string,
    updates: UpdateScriptParams
  ): Promise<ScriptEntity | null> {
    await this.ensureInitialized()
    return this.scriptRepo.update(id, updates)
  }

  /**
   * 删除脚本/文件夹及关联步骤
   *
   * TypeORM 的 ON DELETE CASCADE 会自动删除关联的步骤记录
   */
  async deleteScript(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.scriptRepo.delete(id)
  }

  /**
   * 批量调整脚本顺序
   *
   * 根据传入的脚本ID数组顺序，重新设置每个脚本的 sort_order
   */
  async updateScriptsOrder(scriptIds: string[]): Promise<void> {
    await this.ensureInitialized()
    await this.scriptRepo.updateOrder(scriptIds)
  }

  // =========================================================================
  // 步骤操作
  // =========================================================================

  /**
   * 添加步骤
   *
   * 未指定 insertIndex 时追加到末尾（当前最大序号 + 1）；
   * 指定时插入到该位置，后续步骤序号自动 +1
   */
  async addStep(
    scriptId: string,
    stepData: CreateStepParams,
    insertIndex?: number
  ): Promise<StepEntity> {
    await this.ensureInitialized()

    if (insertIndex === undefined) {
      // 追加到末尾
      const maxIndex = await this.stepRepo.getMaxStepIndex(scriptId)
      const newIndex = maxIndex + 1
      return this.stepRepo.create(scriptId, newIndex, stepData)
    }

    // 插入到指定位置，后续步骤后移
    await this.stepRepo.shiftStepIndices(scriptId, insertIndex, 1)
    return this.stepRepo.create(scriptId, insertIndex, stepData)
  }

  /**
   * 获取脚本的所有步骤（按 step_index 排序）
   */
  async getStepsByScriptId(scriptId: string): Promise<StepEntity[]> {
    await this.ensureInitialized()
    return this.stepRepo.findByScriptId(scriptId)
  }

  /**
   * 更新步骤
   */
  async updateStep(
    stepId: number,
    stepData: UpdateStepParams
  ): Promise<StepEntity | null> {
    await this.ensureInitialized()
    return this.stepRepo.update(stepId, stepData)
  }

  /**
   * 删除步骤
   *
   * 删除后，后续步骤序号自动 -1，保持连续性
   */
  async deleteStep(stepId: number): Promise<boolean> {
    await this.ensureInitialized()

    const step = await this.stepRepo.findById(stepId)
    if (!step) {
      return false
    }

    const deleted = await this.stepRepo.delete(stepId)
    if (deleted) {
      // 后续步骤序号 -1
      await this.stepRepo.shiftStepIndices(
        step.scriptId,
        step.stepIndex + 1,
        -1
      )
    }

    return deleted
  }

  /**
   * 全量替换步骤列表
   *
   * 清空脚本原有步骤，替换为新的步骤列表
   */
  async replaceSteps(
    scriptId: string,
    steps: CreateStepParams[]
  ): Promise<StepEntity[]> {
    await this.ensureInitialized()

    // 删除原有步骤
    await this.stepRepo.deleteByScriptId(scriptId)

    // 创建新步骤
    const newSteps: StepEntity[] = []
    for (let index = 0; index < steps.length; index++) {
      const step = await this.stepRepo.create(
        scriptId,
        index + 1,
        steps[index]
      )
      newSteps.push(step)
    }

    return newSteps
  }

  /**
   * 批量调整步骤顺序
   *
   * 根据传入的步骤ID数组顺序，重新设置每个步骤的 step_index
   */
  async updateStepsOrder(scriptId: string, stepIds: number[]): Promise<void> {
    await this.ensureInitialized()
    await this.stepRepo.updateOrder(scriptId, stepIds)
  }

  // =========================================================================
  // 文件同步
  // =========================================================================

  /**
   * 将步骤数据同步到脚本文件
   *
   * 将数据库中的步骤数据序列化后写入对应的 .js 文件
   */
  async syncToFile(scriptId: string): Promise<boolean> {
    await this.ensureInitialized()

    const script = await this.scriptRepo.findById(scriptId)
    if (!script) {
      return false
    }

    const steps = await this.stepRepo.findByScriptId(scriptId)

    // 将步骤数据序列化为 .js 文件内容
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

    if (!script.filePath) {
      return false
    }
    await fs.writeFile(script.filePath, fileContent, 'utf-8')
    return true
  }

  /**
   * 从文件加载脚本并入库
   *
   * 读取 .js 文件中的步骤数据，创建或更新脚本及步骤记录
   */
  async loadFromFile(filePath: string): Promise<{
    script: ScriptEntity
    steps: StepEntity[]
  } | null> {
    await this.ensureInitialized()

    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch {
      return null
    }

    // 动态导入 .js 文件
    // 注意：在 Electron 主进程中使用 require
    const fileModule = require(filePath)
    const stepsData: CreateStepParams[] = fileModule.default ?? fileModule.steps ?? []

    const fileName = path.basename(filePath, '.js')
    const scriptName = fileName

    // 创建或更新脚本
    const params: CreateScriptParams = {
      name: scriptName,
      filePath,
    }
    const script = await this.scriptRepo.create(params)

    // 批量创建步骤
    const steps: StepEntity[] = []
    for (let index = 0; index < stepsData.length; index++) {
      const step = await this.stepRepo.create(
        script.id,
        index + 1,
        stepsData[index]
      )
      steps.push(step)
    }

    return { script, steps }
  }
}
