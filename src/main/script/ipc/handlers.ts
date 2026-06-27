/**
 * AutoClick - 脚本管理 IPC 处理器
 */
import { ipcMain, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { IPC } from '../channels'
import { ScriptService } from '../services/script-service'
import {
  scriptEntityToRenderer,
  stepEntityToRenderer,
  rendererFormToCreateStep,
} from './converter'
import type { UpdateStepParams, CreateStepParams, StepData } from '../types'

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
      const script = await service.createScript(args.name, args.filePath, args.description, undefined, args.parentId)
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

  ipcMain.handle(IPC.SCRIPT_UPDATE, async (_event, args: { id: string; updates: Record<string, unknown> }) => {
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
    name?: string
  }) => {
    try {
      const service = getService()
      const stepData = rendererFormToCreateStep(args.type, args.params, args.name)
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

  ipcMain.handle(IPC.STEP_UPDATE, async (_event, args: { stepId: number; type: string; params?: Record<string, string>; name?: string }) => {
    try {
      const service = getService()
      const updateData: UpdateStepParams = { type: args.type as UpdateStepParams['type'] }
      if (args.params) {
        updateData.data = rendererFormToCreateStep(args.type, args.params).data
      }
      if (args.name !== undefined) {
        updateData.name = args.name
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
      const createSteps = args.steps.map((s) => rendererFormToCreateStep(s.type, s.params))
      const steps = await service.replaceSteps(args.scriptId, createSteps)
      return { success: true, data: steps.map(stepEntityToRenderer) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.STEP_UPDATE_ORDER, async (_event, args: { scriptId: string; stepIds: number[] }) => {
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
      if (!result) return { success: false, error: '文件不存在或加载失败' }
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

  // =========================================================================
  // 文件对话框
  // =========================================================================

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入脚本',
        filters: [{ name: '脚本文件', extensions: ['js'] }],
        properties: ['openFile'],
      })
      return { success: true, data: result.filePaths[0] || null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (_event, defaultName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '导出脚本',
        defaultPath: defaultName,
        filters: [{ name: '脚本文件', extensions: ['js'] }],
      })
      return { success: true, data: result.filePath || null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // 导入/导出
  // =========================================================================

  /**
   * 导入：打开文件对话框 → 读取 .js 文件 → 解析 steps → 入库
   */
  ipcMain.handle(IPC.SCRIPT_IMPORT, async () => {
    try {
      // 1. 打开文件对话框
      const dialogResult = await dialog.showOpenDialog({
        title: '导入脚本',
        filters: [{ name: '脚本文件', extensions: ['js'] }],
        properties: ['openFile'],
      })
      if (dialogResult.canceled || !dialogResult.filePaths[0]) {
        return { success: false, error: '已取消' }
      }

      const filePath = dialogResult.filePaths[0]
      const fileName = path.basename(filePath, '.js')

      // 2. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8')

      // 3. 解析：去掉首行注释（// ...），解析 JSON 数组
      const lines = content.split('\n')
      const jsonStr = lines
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
        .trim()

      let stepsData: Array<{ type: string; data: Record<string, unknown> }> = []
      try {
        stepsData = JSON.parse(jsonStr)
        if (!Array.isArray(stepsData)) throw new Error('不是数组')
      } catch {
        return { success: false, error: '文件格式无效：无法解析步骤数据' }
      }

      // 4. 入库
      const service = getService()
      const script = await service.createScript(fileName, filePath)

      for (let i = 0; i < stepsData.length; i++) {
        const s = stepsData[i]
        await service.addStep(script.id, {
          type: s.type as CreateStepParams['type'],
          data: s.data as unknown as StepData,
        })
      }

      const fullScript = await service.getScriptById(script.id)
      return {
        success: true,
        data: fullScript ? scriptEntityToRenderer(fullScript) : null,
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  /**
   * 导出：选中脚本 → 打开保存对话框 → 写入 .js 文件
   */
  ipcMain.handle(IPC.SCRIPT_EXPORT, async (_event, scriptId: string) => {
    try {
      const service = getService()
      const script = await service.getScriptById(scriptId)
      if (!script) return { success: false, error: '脚本不存在' }

      const steps = await service.getStepsByScriptId(scriptId)

      const dialogResult = await dialog.showSaveDialog({
        title: '导出脚本',
        defaultPath: script.name,
        filters: [{ name: '脚本文件', extensions: ['js'] }],
      })
      if (dialogResult.canceled || !dialogResult.filePath) {
        return { success: false, error: '已取消' }
      }

      // 2. 生成文件内容
      const stepsJson = steps.map((step) => {
        const data = JSON.parse(step.data)
        return { type: step.type, data }
      })

      const fileContent = [
        `// AutoClick Script: ${script.name}`,
        `// Generated at: ${new Date().toISOString()}`,
        `// Steps: ${steps.length}`,
        '',
        JSON.stringify(stepsJson, null, 2),
        '',
      ].join('\n')

      // 3. 写入文件
      await fs.writeFile(dialogResult.filePath, fileContent, 'utf-8')

      return { success: true, data: dialogResult.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
