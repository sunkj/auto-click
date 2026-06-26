import { Repository } from 'typeorm'
import { AppDataSource } from '../data-source'
import { StepEntity } from '../entities/step-entity'
import { CreateStepParams, UpdateStepParams } from '../types'

export class StepRepository {
  private repo: Repository<StepEntity>

  constructor() {
    this.repo = AppDataSource.getRepository(StepEntity)
  }

  async create(scriptId: string, stepIndex: number, params: CreateStepParams): Promise<StepEntity> {
    const entity = this.repo.create({
      scriptId,
      stepIndex,
      type: params.type,
      data: JSON.stringify(params.data),
      name: params.name || undefined,
    })
    return this.repo.save(entity)
  }

  async findById(id: number): Promise<StepEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['script'],
    })
  }

  async findByScriptId(scriptId: string): Promise<StepEntity[]> {
    return this.repo.find({
      where: { scriptId },
      order: { stepIndex: 'ASC' },
    })
  }

  async update(id: number, updates: UpdateStepParams): Promise<StepEntity | null> {
    const entity = await this.repo.findOneBy({ id })
    if (!entity) return null

    if (updates.type !== undefined) entity.type = updates.type
    if (updates.data !== undefined) entity.data = JSON.stringify(updates.data)
    if (updates.name !== undefined) entity.name = updates.name

    return this.repo.save(entity)
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repo.delete(id)
    return (result.affected ?? 0) > 0
  }

  async deleteByScriptId(scriptId: string): Promise<void> {
    await this.repo.delete({ scriptId })
  }

  async getMaxStepIndex(scriptId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('step')
      .select('MAX(step.stepIndex)', 'maxIndex')
      .where('step.scriptId = :scriptId', { scriptId })
      .getRawOne()
    return result?.maxIndex ?? 0
  }

  async shiftStepIndices(scriptId: string, fromIndex: number, offset: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(StepEntity)
      .set({ stepIndex: () => `step_index + ${offset}` })
      .where('scriptId = :scriptId', { scriptId })
      .andWhere('stepIndex >= :fromIndex', { fromIndex })
      .execute()
  }

  async updateOrder(scriptId: string, stepIds: number[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      // 第一阶段：将所有步骤的 step_index 设为临时负值，释放原值避免唯一约束冲突
      for (let index = 0; index < stepIds.length; index++) {
        await manager.update(
          StepEntity,
          { id: stepIds[index], scriptId },
          { stepIndex: -(index + 1) }
        )
      }
      // 第二阶段：设为正确的目标值
      for (let index = 0; index < stepIds.length; index++) {
        await manager.update(
          StepEntity,
          { id: stepIds[index], scriptId },
          { stepIndex: index + 1 }
        )
      }
    })
  }

  async deleteNotIn(scriptId: string, keepIds: number[]): Promise<void> {
    if (keepIds.length === 0) {
      await this.deleteByScriptId(scriptId)
      return
    }
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(StepEntity)
      .where('scriptId = :scriptId', { scriptId })
      .andWhere('id NOT IN (:...keepIds)', { keepIds })
      .execute()
  }
}
