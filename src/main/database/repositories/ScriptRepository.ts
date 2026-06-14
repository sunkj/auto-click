import { randomUUID } from 'crypto'
import { Repository } from 'typeorm'
import { AppDataSource } from '../data-source'
import { ScriptEntity } from '../entities/ScriptEntity'
import { CreateScriptParams, UpdateScriptParams } from '../../types/service.types'

export class ScriptRepository {
  private repo: Repository<ScriptEntity>

  constructor() {
    this.repo = AppDataSource.getRepository(ScriptEntity)
  }

  /**
   * 创建脚本记录
   */
  async create(params: CreateScriptParams): Promise<ScriptEntity> {
    const entity = this.repo.create({
      id: randomUUID(),
      type: params.type ?? 'script',
      parentId: params.parentId ?? null,
      name: params.name,
      filePath: params.filePath ?? null,
      description: params.description ?? null,
      sortOrder: params.sortOrder ?? 0,
    })

    return this.repo.save(entity)
  }

  /**
   * 根据ID查询脚本
   */
  async findById(id: string): Promise<ScriptEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['steps'],
    })
  }

  /**
   * 查询所有脚本（按 sort_order 排序）
   */
  async findAll(): Promise<ScriptEntity[]> {
    return this.repo.find({
      order: { sortOrder: 'ASC' },
      relations: ['steps'],
    })
  }

  /**
   * 更新脚本信息
   */
  async update(id: string, updates: UpdateScriptParams): Promise<ScriptEntity | null> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['steps'],
    })
    if (!entity) {
      return null
    }

    if (updates.name !== undefined) {
      entity.name = updates.name
    }
    if (updates.type !== undefined) {
      entity.type = updates.type
    }
    if (updates.parentId !== undefined) {
      entity.parentId = updates.parentId
    }
    if (updates.filePath !== undefined) {
      entity.filePath = updates.filePath
    }
    if (updates.description !== undefined) {
      entity.description = updates.description
    }
    if (updates.sortOrder !== undefined) {
      entity.sortOrder = updates.sortOrder
    }

    return this.repo.save(entity)
  }

  /**
   * 删除脚本
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id)
    return (result.affected ?? 0) > 0
  }

  /**
   * 批量更新脚本排序
   * 根据传入的脚本ID数组顺序，依次设置 sort_order
   */
  async updateOrder(scriptIds: string[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      for (let index = 0; index < scriptIds.length; index++) {
        await manager.update(
          ScriptEntity,
          { id: scriptIds[index] },
          { sortOrder: index }
        )
      }
    })
  }

  /**
   * 获取当前最大排序值
   */
  async getMaxSortOrder(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('script')
      .select('MAX(script.sortOrder)', 'maxOrder')
      .getRawOne()

    return result?.maxOrder ?? 0
  }
}
