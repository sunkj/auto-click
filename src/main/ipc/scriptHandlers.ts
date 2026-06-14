/**
 * AutoClick - 脚本管理 IPC 处理器
 *
 * 注册所有脚本/步骤相关的主进程 IPC 通道，调用 ScriptService 完成业务逻辑，
 * 并通过 data-converter 将 Entity 转换为渲染进程可用的数据格式。
 */
import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { ScriptService } from '../services/ScriptService'
import {
  scriptEntityToRenderer,
  stepEntityToRenderer,
  rendererFormToCreateStep,
} from './data-converter'
import type { UpdateStepParams } from '../types/service.types'

let scriptService: ScriptService | null = null

function getService(): ScriptService {
  if (!scriptService) {
    scriptService = new ScriptService()
  }
  return scriptService
}

export function registerScriptHandlers(): void {
  // =========================================================================
  // 脚本
  // =========================================================================

  ipcMain.handle(IPC.SCRIPT_CREATE, async (_event, args: {
    name: string
    filePath: string
    description?: string
    parentId?: string | null
  }) => {
    try {
      const service = getService()
      const script = await service.createScript(
        args.name,
        args.filePath,
        args.description,
        undefined,
        args.parentId
      )
      return { success: true, data: scriptEntityToRenderer(script) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.SCRIPT_GET_ALL, async () => {
    try {
      const service = getService()
      const scripts = await service.getAllScripts()
      return { success: true, data: scripts.map(scriptEntityToRenderer) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.SCRIPT_GET_BY_ID, async (_event, id: string) => {
    try {
      const service = getService()
      const script = await service.getScriptById(id)
      return { success: true, data: script ? scriptEntityToRenderer(script) : null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.SCRIPT_UPDATE, async (_event, args: {
    id: string
    updates: Record<string, unknown>
  }) => {
    try {
      const service = getService()
      const script = await service.updateScript(args.id, args.updates)
      return { success: true, data: script ? scriptEntityToRenderer(script) : null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.SCRIPT_DELETE, async (_event, id: string) => {
    try {
      const service = getService()
      const result = await service.deleteScript(id)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.SCRIPT_UPDATE_ORDER, async (_event, scriptIds: string[]) => {
    try {
      const service = getService()
      await service.updateScriptsOrder(scriptIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 文件夹
  // =========================================================================

  ipcMain.handle(IPC.FOLDER_CREATE, async (_event, args: { name: string }) => {
    try {
      const service = getService()
      const folder = await service.createFolder(args.name)
      return { success: true, data: scriptEntityToRenderer(folder) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.FOLDER_GET_ALL, async () => {
    try {
      const service = getService()
      const folders = await service.getAllFolders()
      return { success: true, data: folders.map(scriptEntityToRenderer) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.FOLDER_DELETE, async (_event, id: string) => {
    try {
      const service = getService()
      const result = await service.deleteScript(id)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 步骤
  // =========================================================================

  ipcMain.handle(IPC.STEP_ADD, async (_event, args: {
    scriptId: string
    type: string
    params: Record<string, string>
    insertIndex?: number
  }) => {
    try {
      const service = getService()
      const stepData = rendererFormToCreateStep(args.type, args.params)
      const step = await service.addStep(args.scriptId, stepData, args.insertIndex)
      return { success: true, data: stepEntityToRenderer(step) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_GET_BY_SCRIPT, async (_event, scriptId: string) => {
    try {
      const service = getService()
      const steps = await service.getStepsByScriptId(scriptId)
      return { success: true, data: steps.map(stepEntityToRenderer) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_UPDATE, async (_event, args: {
    stepId: number
    type: string
    params?: Record<string, string>
  }) => {
    try {
      const service = getService()
      const updateData: UpdateStepParams = {
        type: args.type as UpdateStepParams['type'],
      }
      if (args.params) {
        updateData.data = rendererFormToCreateStep(args.type, args.params).data
      }
      const step = await service.updateStep(args.stepId, updateData)
      return { success: true, data: step ? stepEntityToRenderer(step) : null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_DELETE, async (_event, stepId: number) => {
    try {
      const service = getService()
      const result = await service.deleteStep(stepId)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_REPLACE, async (_event, args: {
    scriptId: string
    steps: Array<{ type: string; params: Record<string, string> }>
  }) => {
    try {
      const service = getService()
      const createSteps = args.steps.map((s) =>
        rendererFormToCreateStep(s.type, s.params)
      )
      const steps = await service.replaceSteps(args.scriptId, createSteps)
      return { success: true, data: steps.map(stepEntityToRenderer) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_UPDATE_ORDER, async (_event, args: {
    scriptId: string
    stepIds: number[]
  }) => {
    try {
      const service = getService()
      await service.updateStepsOrder(args.scriptId, args.stepIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 文件同步
  // =========================================================================

  ipcMain.handle(IPC.SYNC_TO_FILE, async (_event, scriptId: string) => {
    try {
      const service = getService()
      const result = await service.syncToFile(scriptId)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.LOAD_FROM_FILE, async (_event, filePath: string) => {
    try {
      const service = getService()
      const result = await service.loadFromFile(filePath)
      if (!result) {
        return { success: false, error: '文件不存在或加载失败' }
      }
      return {
        success: true,
        data: {
          script: scriptEntityToRenderer(result.script),
          steps: result.steps.map(stepEntityToRenderer),
        },
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
