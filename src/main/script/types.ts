/**
 * script 模块类型定义
 *
 * 所有类型已迁移至 src/main/common/types.ts，此处仅做 re-export。
 */
export * from '../common/types'

/** 服务层操作结果 */
export interface ServiceResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
