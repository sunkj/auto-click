import { Repository } from 'typeorm'
import { AppDataSource } from '../../script/data-source'
import { RecordedClickEntity } from '../entities/recorded-click-entity'

export interface CreateRecordedClickParams {
  name: string
  x: number
  y: number
  type: string
  ext?: string | null
}

export interface UpdateRecordedClickParams {
  name?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export class RecordedClickRepository {
  private repo: Repository<RecordedClickEntity>

  constructor() {
    this.repo = AppDataSource.getRepository(RecordedClickEntity)
  }

  async create(params: CreateRecordedClickParams): Promise<RecordedClickEntity> {
    const entity = this.repo.create({
      name: params.name,
      x: params.x,
      y: params.y,
      type: params.type,
      ext: params.ext ?? null,
    })
    return this.repo.save(entity)
  }

  async findAll(page: number, pageSize: number): Promise<PaginatedResult<RecordedClickEntity>> {
    const [items, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findById(id: number): Promise<RecordedClickEntity | null> {
    return this.repo.findOneBy({ id })
  }

  async update(id: number, updates: UpdateRecordedClickParams): Promise<RecordedClickEntity | null> {
    const entity = await this.repo.findOneBy({ id })
    if (!entity) return null
    if (updates.name !== undefined) entity.name = updates.name
    return this.repo.save(entity)
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repo.delete(id)
    return (result.affected ?? 0) > 0
  }

  async count(): Promise<number> {
    return this.repo.count()
  }
}
