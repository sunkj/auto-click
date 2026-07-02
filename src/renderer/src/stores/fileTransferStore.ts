import { create } from 'zustand'
import { showToast } from '@/components/ui/toast'

// =============================================================================
// 类型定义
// =============================================================================

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: string
  permissions: string
}

/** 文件类型图标分类 */
export type FileTypeCategory = 'folder' | 'image' | 'video' | 'audio' | 'apk' | 'archive' | 'file'

/** 根据文件名/扩展名判断文件类型分类 */
export function getFileTypeCategory(name: string, isDirectory: boolean): FileTypeCategory {
  if (isDirectory) return 'folder'
  const ext = name.toLowerCase().split('.').pop() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image'
  if (['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext)) return 'audio'
  if (ext === 'apk') return 'apk'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst'].includes(ext)) return 'archive'
  return 'file'
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// =============================================================================
// IPC 辅助
// =============================================================================

function getAPI() {
  return window.electronAPI?.fileTransfer
}

// =============================================================================
// Store 定义
// =============================================================================

export const ROOT_PATH = '/'

interface FileTransferStore {
  // 状态
  currentPath: string
  entries: FileEntry[]
  selectedFile: FileEntry | null
  breadcrumbs: string[]
  loading: boolean
  uploading: boolean
  downloading: boolean
  error: string | null

  // 缩略图缓存
  thumbnailCache: Map<string, string | null>

  // 操作
  navigateTo: (path: string) => Promise<void>
  navigateUp: () => Promise<void>
  navigateToBreadcrumb: (index: number) => Promise<void>
  selectFile: (entry: FileEntry | null) => void
  uploadFile: () => Promise<void>
  downloadFile: () => Promise<void>
  refresh: () => Promise<void>
  getThumbnail: (path: string) => Promise<string | null>
}

export const useFileTransferStore = create<FileTransferStore>((set, get) => ({
  // ---- 初始状态 ----
  currentPath: ROOT_PATH,
  entries: [],
  selectedFile: null,
  breadcrumbs: [],
  loading: false,
  uploading: false,
  downloading: false,
  error: null,
  thumbnailCache: new Map(),

  // ---- 导航 ----

  navigateTo: async (path: string) => {
    const api = getAPI()
    if (!api) {
      set({ error: '文件传输 API 不可用' })
      return
    }

    set({ loading: true, error: null, selectedFile: null, thumbnailCache: new Map() })
    try {
      const result = await api.listDir(path)
      if (result.success && result.data) {
        // 构建面包屑路径
        const parts = path.split('/').filter(Boolean)
        set({
          currentPath: path,
          entries: result.data,
          breadcrumbs: parts,
          loading: false,
        })
      } else {
        set({ error: result.error || '读取目录失败', loading: false })
      }
    } catch (err) {
      set({ error: `读取目录失败: ${err}`, loading: false })
    }
  },

  navigateUp: () => {
    const { currentPath } = get()
    if (currentPath === '/') return
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/'))
    get().navigateTo(parent || '/')
  },

  navigateToBreadcrumb: (index: number) => {
    const { breadcrumbs } = get()
    if (index < 0 || index >= breadcrumbs.length) return
    const path = '/' + breadcrumbs.slice(0, index + 1).join('/')
    get().navigateTo(path)
  },

  /** 快速跳转到 /sdcard（手机内部存储） */
  goToInternalStorage: async () => {
    await get().navigateTo('/sdcard')
  },

  // ---- 选中 ----

  selectFile: (entry: FileEntry | null) => {
    set({ selectedFile: entry })
  },

  // ---- 上传 ----

  uploadFile: async () => {
    const api = getAPI()
    if (!api) {
      showToast('error', '文件传输 API 不可用')
      return
    }

    set({ uploading: true, error: null })
    try {
      const result = await api.upload('', get().currentPath)
      if (result.success && result.data) {
        showToast('success', `文件 "${result.data.fileName}" 上传成功`)
        // 上传完成后刷新目录
        await get().refresh()
      } else {
        showToast('error', result.error || '上传失败')
        set({ error: result.error || '上传失败' })
      }
    } catch (err) {
      showToast('error', `上传失败: ${err}`)
      set({ error: `上传失败: ${err}` })
    } finally {
      set({ uploading: false })
    }
  },

  // ---- 下载 ----

  downloadFile: async () => {
    const { selectedFile } = get()
    if (!selectedFile) return

    const api = getAPI()
    if (!api) {
      showToast('error', '文件传输 API 不可用')
      return
    }

    set({ downloading: true, error: null })
    try {
      const result = await api.download(selectedFile.path, '')
      if (result.success && result.data) {
        showToast('success', `文件已下载到: ${result.data.savePath}`)
      } else {
        showToast('error', result.error || '下载失败')
        set({ error: result.error || '下载失败' })
      }
    } catch (err) {
      showToast('error', `下载失败: ${err}`)
      set({ error: `下载失败: ${err}` })
    } finally {
      set({ downloading: false })
    }
  },

  // ---- 刷新 ----

  refresh: async () => {
    const { currentPath } = get()
    await get().navigateTo(currentPath)
  },

  // ---- 缩略图 ----

  getThumbnail: async (path: string) => {
    const { thumbnailCache } = get()

    // 缓存命中
    if (thumbnailCache.has(path)) {
      return thumbnailCache.get(path) ?? null
    }

    const api = getAPI()
    if (!api) return null

    try {
      const result = await api.getThumbnail(path)
      const data = result.success ? (result.data ?? null) : null
      // 写入缓存
      set((state) => {
        const cache = new Map(state.thumbnailCache)
        cache.set(path, data)
        return { thumbnailCache: cache }
      })
      return data
    } catch {
      return null
    }
  },
}))
