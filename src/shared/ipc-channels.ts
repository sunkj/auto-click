/**
 * AutoClick - IPC 通道常量定义
 *
 * 主进程与渲染进程共享，确保通道名称一致
 */

export const IPC = {
  // 脚本操作
  SCRIPT_CREATE: 'script:create',
  SCRIPT_GET_ALL: 'script:getAll',
  SCRIPT_GET_BY_ID: 'script:getById',
  SCRIPT_UPDATE: 'script:update',
  SCRIPT_DELETE: 'script:delete',
  SCRIPT_UPDATE_ORDER: 'script:updateOrder',

  // 步骤操作
  STEP_ADD: 'step:add',
  STEP_GET_BY_SCRIPT: 'step:getByScript',
  STEP_UPDATE: 'step:update',
  STEP_DELETE: 'step:delete',
  STEP_REPLACE: 'step:replace',
  STEP_UPDATE_ORDER: 'step:updateOrder',

  // 文件夹操作
  FOLDER_CREATE: 'folder:create',
  FOLDER_GET_ALL: 'folder:getAll',
  FOLDER_DELETE: 'folder:delete',

  // 文件同步
  SYNC_TO_FILE: 'script:syncToFile',
  LOAD_FROM_FILE: 'script:loadFromFile',
} as const
