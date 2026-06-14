import { randomUUID } from 'crypto'
import { Repository } from 'typeorm'
import { AppDataSource } from '../data-source'
import { ScriptEntity } from '../entities/script-entity'
import { CreateScriptParams, UpdateScriptParams } from '../types'

export class ScriptRepository {
  private repo: Repository<ScriptEntity>

  constructor() {
    this.repo = AppDataSource.getRepository(ScriptEntity)
  }

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

  async findById(id: string): Promise<ScriptEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['steps'],
    })
  }

  async findAll(): Promise<ScriptEntity[]> {
    return this.repo.find({
      order: { sortOrder: 'ASC' },
      relations: ['steps'],
    })
  }

  async update(id: string, updates: UpdateScriptParams): Promise<ScriptEntity | null> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['steps'],
    })
    if (!entity) return null

    if (updates.name !== undefined) entity.name = updates.name
    if (updates.type !== undefined) entity.type = updates.type
    if (updates.parentId !== undefined) entity.parentId = updates.parentId
    if (updates.filePath !== undefined) entity.filePath = updates.filePath
    if (updates.description !== undefined) entity.description = updates.description
    if (updates.sortOrder !== undefined) entity.sortOrder = updates.sortOrder

    return this.repo.save(entity)
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id)
    return (result.affected ?? 0) > 0
  }

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

  async getMaxSortOrder(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('script')
      .select('MAX(script.sortOrder)', 'maxOrder')
      .getRawOne()
    return result?.maxOrder ?? 0
  }
}
