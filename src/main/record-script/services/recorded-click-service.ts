/**
 * AutoClick - 录制点击服务
 *
 * 运行于 Electron 主进程，负责录制点击数据的持久化存储与操作管理。
 */
import { initializeDatabase } from '../../script/data-source'
import { RecordedClickRepository, PaginatedResult } from '../repositories/recorded-click-repository'
import { RecordedClickEntity } from '../entities/recorded-click-entity'
import type { CreateRecordedClickParams, UpdateRecordedClickParams } from '../repositories/recorded-click-repository'

export class RecordedClickService {
  private repo: RecordedClickRepository
  private initialized = false

  constructor() {
    this.repo = new RecordedClickRepository()
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initializeDatabase()
      this.initialized = true
    }
  }

  async create(params: CreateRecordedClickParams): Promise<RecordedClickEntity> {
    await this.ensureInitialized()
    return this.repo.create(params)
  }

  async getAll(page: number = 1, pageSize: number = 10): Promise<PaginatedResult<RecordedClickEntity>> {
    await this.ensureInitialized()
    return this.repo.findAll(page, pageSize)
  }

  async update(id: number, updates: UpdateRecordedClickParams): Promise<RecordedClickEntity | null> {
    await this.ensureInitialized()
    return this.repo.update(id, updates)
  }

  async delete(id: number): Promise<boolean> {
    await this.ensureInitialized()
    return this.repo.delete(id)
  }
}
