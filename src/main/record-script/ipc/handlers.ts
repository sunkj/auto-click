/**
 * AutoClick - 录制脚本 IPC 处理器
 */
import { ipcMain } from 'electron'
import { RPC } from '../channels'
import { RecordedClickService } from '../services/recorded-click-service'
import type { CreateRecordedClickParams, UpdateRecordedClickParams } from '../repositories/recorded-click-repository'

let service: RecordedClickService | null = null

function getService(): RecordedClickService {
  if (!service) {
    service = new RecordedClickService()
  }
  return service
}

export function registerRecordedClickHandlers(): void {
  ipcMain.handle(RPC.RECORDED_CLICK_CREATE, async (_event, params: CreateRecordedClickParams) => {
    try {
      const svc = getService()
      const entity = await svc.create(params)
      return { success: true, data: entity }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(RPC.RECORDED_CLICK_GET_ALL, async (_event, args: { page: number; pageSize: number }) => {
    try {
      const svc = getService()
      const result = await svc.getAll(args.page, args.pageSize)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(RPC.RECORDED_CLICK_UPDATE, async (_event, args: { id: number; updates: UpdateRecordedClickParams }) => {
    try {
      const svc = getService()
      const entity = await svc.update(args.id, args.updates)
      return { success: true, data: entity }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(RPC.RECORDED_CLICK_DELETE, async (_event, id: number) => {
    try {
      const svc = getService()
      const result = await svc.delete(id)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
