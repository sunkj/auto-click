/**
 * AutoClick - 脚本执行引擎模块入口
 *
 * 注册 IPC 处理器，协调脚本加载、校验、执行和状态推送。
 * 不依赖 screen-mirror，通过渲染进程传递的设备 serial 独立执行 ADB 命令。
 */
import { ipcMain } from 'electron'
import { ScriptService } from '../script/services/script-service'
import { ScriptEngine } from './script-engine'

/** IPC 通道 */
export const ENGINE_CHANNELS = {
  RUN: 'engine:run',
  RUN_STEP: 'engine:runStep',
  STOP: 'engine:stop',
  GET_STATUS: 'engine:getStatus',
}

let engine: ScriptEngine | null = null

export function getEngine(): ScriptEngine | null {
  return engine
}

export function registerEngineHandlers(): void {
  const scriptService = new ScriptService()
  engine = new ScriptEngine(scriptService)

  // serial 由渲染进程从 deviceStore 获取后传入
  ipcMain.handle(ENGINE_CHANNELS.RUN, async (_event, scriptId: string, serial: string, externalContext?: Record<string, string>) => {
    if (!serial) return { success: false, error: '设备未连接' }
    try {
      return await engine!.runFullScript(scriptId, serial, externalContext)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(ENGINE_CHANNELS.RUN_STEP, async (_event, scriptId: string, stepIndex: number, serial: string, externalContext?: Record<string, string>) => {
    if (!serial) return { success: false, error: '设备未连接' }
    try {
      return await engine!.runSingleStep(scriptId, stepIndex, serial, externalContext)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(ENGINE_CHANNELS.STOP, async () => {
    engine?.stopExecution()
    return { success: true }
  })

  ipcMain.handle(ENGINE_CHANNELS.GET_STATUS, () => {
    return engine?.getStatus() || { isExecuting: false, currentScriptId: null, currentStepIndex: 0, totalSteps: 0 }
  })
}
