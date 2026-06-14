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

  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',

  SCRIPT_IMPORT: 'script:import',
  SCRIPT_EXPORT: 'script:export',

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

  // --- 导入/导出 ---
  importScript: () =>
    ipcRenderer.invoke(IPC.SCRIPT_IMPORT),
  exportScript: (scriptId: string) =>
    ipcRenderer.invoke(IPC.SCRIPT_EXPORT, scriptId),

  // --- 文件同步 ---
  syncToFile: (scriptId: string) =>
    ipcRenderer.invoke(IPC.SYNC_TO_FILE, scriptId),
  loadFromFile: (filePath: string) =>
    ipcRenderer.invoke(IPC.LOAD_FROM_FILE, filePath),
}

// =============================================================================
// 投屏管理 IPC 常量 + API
// =============================================================================

const SMC = {
  CONNECT: 'scrcpy:connect',
  DISCONNECT: 'scrcpy:disconnect',
  GET_DEVICES: 'scrcpy:getDevices',
  GET_STATUS: 'scrcpy:getStatus',
  TAP: 'scrcpy:tap',
  SWIPE: 'scrcpy:swipe',
  BACK: 'scrcpy:back',
  HOME: 'scrcpy:home',
  TEXT: 'scrcpy:text',
  FRAME: 'scrcpy:frame',
  CONNECTED: 'scrcpy:connected',
  DISCONNECTED: 'scrcpy:disconnected',
  ERROR: 'scrcpy:error',
} as const

const screenMirrorAPI = {
  getDevices: () => ipcRenderer.invoke(SMC.GET_DEVICES),
  getStatus: () => ipcRenderer.invoke(SMC.GET_STATUS),
  connect: (serial?: string) => ipcRenderer.invoke(SMC.CONNECT, serial),
  disconnect: () => ipcRenderer.invoke(SMC.DISCONNECT),
  tap: (x: number, y: number) => ipcRenderer.invoke(SMC.TAP, x, y),
  swipe: (x1: number, y1: number, x2: number, y2: number, duration?: number) =>
    ipcRenderer.invoke(SMC.SWIPE, x1, y1, x2, y2, duration),
  back: () => ipcRenderer.invoke(SMC.BACK),
  home: () => ipcRenderer.invoke(SMC.HOME),
  text: (t: string) => ipcRenderer.invoke(SMC.TEXT, t),

  // 帧事件监听
  onFrame: (callback: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(SMC.FRAME, handler)
    return () => ipcRenderer.removeListener(SMC.FRAME, handler)
  },
  onConnected: (callback: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as string)
    ipcRenderer.on(SMC.CONNECTED, handler)
    return () => ipcRenderer.removeListener(SMC.CONNECTED, handler)
  },
  onDisconnected: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(SMC.DISCONNECTED, handler)
    return () => ipcRenderer.removeListener(SMC.DISCONNECTED, handler)
  },
  onError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as string)
    ipcRenderer.on(SMC.ERROR, handler)
    return () => ipcRenderer.removeListener(SMC.ERROR, handler)
  },
}

// =============================================================================
// 暴露安全 API 到渲染进程
// =============================================================================

// =============================================================================
// 脚本引擎 API
// =============================================================================

const ENGINE = {
  RUN: 'engine:run',
  RUN_STEP: 'engine:runStep',
  STOP: 'engine:stop',
  GET_STATUS: 'engine:getStatus',
  STEP_START: 'engine:stepStart',
  STEP_END: 'engine:stepEnd',
  STEP_ERROR: 'engine:stepError',
  COMPLETE: 'engine:complete',
}

const engineAPI = {
  runScript: (scriptId: string, serial: string) => ipcRenderer.invoke(ENGINE.RUN, scriptId, serial),
  runStep: (scriptId: string, stepIndex: number, serial: string) => ipcRenderer.invoke(ENGINE.RUN_STEP, scriptId, stepIndex, serial),
  stopExecution: () => ipcRenderer.invoke(ENGINE.STOP),
  getStatus: () => ipcRenderer.invoke(ENGINE.GET_STATUS),

  onStepStart: (callback: (event: any) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(ENGINE.STEP_START, handler)
    return () => ipcRenderer.removeListener(ENGINE.STEP_START, handler)
  },
  onStepEnd: (callback: (event: any) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(ENGINE.STEP_END, handler)
    return () => ipcRenderer.removeListener(ENGINE.STEP_END, handler)
  },
  onStepError: (callback: (event: any) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(ENGINE.STEP_ERROR, handler)
    return () => ipcRenderer.removeListener(ENGINE.STEP_ERROR, handler)
  },
  onComplete: (callback: (event: any) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(ENGINE.COMPLETE, handler)
    return () => ipcRenderer.removeListener(ENGINE.COMPLETE, handler)
  },
}

// =============================================================================
// 窗口控制
// =============================================================================

const windowAPI = {
  resizeToScreen: (width: number, height: number) =>
    ipcRenderer.invoke('window:resizeToScreen', width, height),
  restoreSize: () =>
    ipcRenderer.invoke('window:restoreSize'),
}

// =============================================================================
// 暴露安全 API 到渲染进程
// =============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  script: scriptAPI,
  screenMirror: screenMirrorAPI,
  engine: engineAPI,
  window: windowAPI,
})
