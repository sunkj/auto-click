/// <reference types="vite/client" />

/** IPC 调用返回的通用包装 */
interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 渲染进程使用的步骤数据模型 */
interface RendererStep {
  id: string
  index: number
  type: 'click' | 'type' | 'swipe' | 'script'
  params: Record<string, string>
  description: string
}

/** 渲染进程使用的脚本数据模型 */
interface RendererScript {
  id: string
  name: string
  type: 'folder' | 'script'
  parentId: string | null
  steps?: RendererStep[]
}

interface ElectronScriptAPI {
  createScript: (args: {
    name: string
    filePath: string
    description?: string
    parentId?: string | null
  }) => Promise<IpcResult<RendererScript>>
  getAllScripts: () => Promise<IpcResult<RendererScript[]>>
  getScriptById: (id: string) => Promise<IpcResult<RendererScript | null>>
  updateScript: (id: string, updates: Record<string, unknown>) => Promise<IpcResult<RendererScript | null>>
  deleteScript: (id: string) => Promise<IpcResult<boolean>>
  updateScriptsOrder: (scriptIds: string[]) => Promise<IpcResult<void>>

  createFolder: (name: string) => Promise<IpcResult<RendererScript>>
  getAllFolders: () => Promise<IpcResult<RendererScript[]>>
  deleteFolder: (id: string) => Promise<IpcResult<boolean>>

  addStep: (args: {
    scriptId: string
    type: string
    params: Record<string, string>
    insertIndex?: number
  }) => Promise<IpcResult<RendererStep>>
  getStepsByScriptId: (scriptId: string) => Promise<IpcResult<RendererStep[]>>
  updateStep: (stepId: number, type: string, params: Record<string, string>) => Promise<IpcResult<RendererStep | null>>
  deleteStep: (stepId: number) => Promise<IpcResult<boolean>>
  replaceSteps: (scriptId: string, steps: Array<{ type: string; params: Record<string, string> }>) => Promise<IpcResult<RendererStep[]>>
  updateStepsOrder: (scriptId: string, stepIds: number[]) => Promise<IpcResult<void>>

  syncToFile: (scriptId: string) => Promise<IpcResult<boolean>>
  loadFromFile: (filePath: string) => Promise<IpcResult<{
    script: RendererScript
    steps: RendererStep[]
  }>>
}

interface Window {
  electronAPI: {
    platform: string
    script: ElectronScriptAPI
  }
}
