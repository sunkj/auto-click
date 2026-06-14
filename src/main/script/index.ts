/**
 * AutoClick - 脚本管理模块入口
 *
 * 统一导出脚本管理模块的公开接口。
 */
export { registerScriptHandlers } from './ipc/handlers'
export { initializeDatabase, closeDatabase } from './data-source'
