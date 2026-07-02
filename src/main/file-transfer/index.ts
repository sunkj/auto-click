/**
 * 文件传输模块入口
 *
 * 注册 IPC 处理器，协调 ADB 文件操作的执行和结果返回。
 */
import { ipcMain } from 'electron'
import { listDir, pushFile, pullFile, getThumbnail } from './adb-file-service'
import type { FileEntry, ListDirParams, UploadParams, DownloadParams } from './types'

// =============================================================================
// IPC 通道常量
// =============================================================================

export const FILE_TRANSFER_CHANNELS = {
  LIST_DIR: 'file-transfer:listDir',
  UPLOAD: 'file-transfer:upload',
  DOWNLOAD: 'file-transfer:download',
  GET_THUMBNAIL: 'file-transfer:getThumbnail',
} as const

// =============================================================================
// IPC 处理器注册
// =============================================================================

export function registerFileTransferHandlers(): void {
  /**
   * 列出手机端目录内容
   */
  ipcMain.handle(FILE_TRANSFER_CHANNELS.LIST_DIR, async (_event, params: ListDirParams) => {
    try {
      const entries: FileEntry[] = await listDir(params.path)
      return { success: true, data: entries }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  /**
   * 上传文件（电脑 → 手机）
   *
   * 渲染进程先通过 dialog.showOpenDialog 选择文件，
   * 再将 localPath 和当前手机目录 remoteDir 传给此 IPC。
   */
  ipcMain.handle(FILE_TRANSFER_CHANNELS.UPLOAD, async (_event, params: UploadParams) => {
    try {
      // 如果没有提供 localPath 或为空，弹出文件选择对话框
      if (!params.localPath) {
        const { dialog } = require('electron')
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          title: '选择要上传的文件',
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, error: '已取消选择' }
        }
        params.localPath = result.filePaths[0]
      }

      const fileName = await pushFile(params.localPath, params.remoteDir)
      return { success: true, data: { fileName } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  /**
   * 下载文件（手机 → 电脑）
   *
   * 将手机端文件下载到电脑本地目录。
   * 默认使用系统下载目录（~/Downloads）。
   */
  ipcMain.handle(FILE_TRANSFER_CHANNELS.DOWNLOAD, async (_event, params: DownloadParams) => {
    try {
      const result = await pullFile(params.remotePath, params.localDir || undefined)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  /**
   * 获取图片文件的缩略图（base64 data URL）
   */
  ipcMain.handle(FILE_TRANSFER_CHANNELS.GET_THUMBNAIL, async (_event, params: { path: string }) => {
    try {
      const thumbnail = await getThumbnail(params.path)
      return { success: true, data: thumbnail }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
