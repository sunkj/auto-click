/**
 * 文件传输模块 — 类型定义
 */

/** 文件/目录条目 */
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: string
  permissions: string
}

/** 文件信息 */
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: string
}

/** IPC 参数 */
export interface ListDirParams {
  path: string
}

export interface UploadParams {
  localPath: string
  remoteDir: string
}

export interface DownloadParams {
  remotePath: string
  localDir: string
}

/** IPC 返回 */
export interface UploadResult {
  fileName: string
}

export interface DownloadResult {
  fileName: string
  savePath: string
}
