import { contextBridge, ipcRenderer } from 'electron'

// =============================================================================
// IPC 通道常量（内联定义，避免 sandbox 下跨目录 require 失败）
// =============================================================================

const IPC = {
  SCRIPT_CREATE: 'script:create',
  SCRIPT_GET_ALL: 'script:getAll',
  SCRIPT_GET_BY_ID: 'script:getById',
  SCRIPT_UPDATE: 'script:update',
  SCRIPT_DELETE: 'script:delete',
  SCRIPT_UPDATE_ORDER: 'script:updateOrder',

  STEP_ADD: 'step:add',
  STEP_GET_BY_SCRIPT: 'step:getByScript',
  STEP_UPDATE: 'step:update',
  STEP_DELETE: 'step:delete',
  STEP_REPLACE: 'step:replace',
  STEP_UPDATE_ORDER: 'step:updateOrder',

  FOLDER_CREATE: 'folder:create',
  FOLDER_GET_ALL: 'folder:getAll',
  FOLDER_DELETE: 'folder:delete',

  SYNC_TO_FILE: 'script:syncToFile',
  LOAD_FROM_FILE: 'script:loadFromFile',
} as const

// =============================================================================
// 脚本管理 API
// =============================================================================

const scriptAPI = {
  // --- 脚本 ---
  createScript: (args: { name: string; filePath: string; description?: string; parentId?: string | null }) =>
    ipcRenderer.invoke(IPC.SCRIPT_CREATE, args),
  getAllScripts: () =>
    ipcRenderer.invoke(IPC.SCRIPT_GET_ALL),
  getScriptById: (id: string) =>
    ipcRenderer.invoke(IPC.SCRIPT_GET_BY_ID, id),
  updateScript: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.SCRIPT_UPDATE, { id, updates }),
  deleteScript: (id: string) =>
    ipcRenderer.invoke(IPC.SCRIPT_DELETE, id),
  updateScriptsOrder: (scriptIds: string[]) =>
    ipcRenderer.invoke(IPC.SCRIPT_UPDATE_ORDER, scriptIds),

  // --- 文件夹 ---
  createFolder: (name: string) =>
    ipcRenderer.invoke(IPC.FOLDER_CREATE, { name }),
  getAllFolders: () =>
    ipcRenderer.invoke(IPC.FOLDER_GET_ALL),
  deleteFolder: (id: string) =>
    ipcRenderer.invoke(IPC.FOLDER_DELETE, id),

  // --- 步骤 ---
  addStep: (args: { scriptId: string; type: string; params: Record<string, string>; insertIndex?: number }) =>
    ipcRenderer.invoke(IPC.STEP_ADD, args),
  getStepsByScriptId: (scriptId: string) =>
    ipcRenderer.invoke(IPC.STEP_GET_BY_SCRIPT, scriptId),
  updateStep: (stepId: number, type: string, params: Record<string, string>) =>
    ipcRenderer.invoke(IPC.STEP_UPDATE, { stepId, type, params }),
  deleteStep: (stepId: number) =>
    ipcRenderer.invoke(IPC.STEP_DELETE, stepId),
  replaceSteps: (scriptId: string, steps: Array<{ type: string; params: Record<string, string> }>) =>
    ipcRenderer.invoke(IPC.STEP_REPLACE, { scriptId, steps }),
  updateStepsOrder: (scriptId: string, stepIds: number[]) =>
    ipcRenderer.invoke(IPC.STEP_UPDATE_ORDER, { scriptId, stepIds }),

  // --- 文件同步 ---
  syncToFile: (scriptId: string) =>
    ipcRenderer.invoke(IPC.SYNC_TO_FILE, scriptId),
  loadFromFile: (filePath: string) =>
    ipcRenderer.invoke(IPC.LOAD_FROM_FILE, filePath),
}

// =============================================================================
// 暴露安全 API 到渲染进程
// =============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  script: scriptAPI,
})
