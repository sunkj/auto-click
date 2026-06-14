import { create } from 'zustand'

interface DeviceInfo {
  serial: string
  model: string
  resolution: string
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error'

interface DeviceStore {
  status: ConnectionStatus
  deviceInfo: DeviceInfo | null
  errorMsg: string
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /** 由 MirrorPanel 在收到帧时调用更新 */
  _setFrameMeta: (width: number, height: number) => void
}

function getAPI() {
  return window.electronAPI?.screenMirror
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  status: 'idle',
  deviceInfo: null,
  errorMsg: '',

  connect: async () => {
    const api = getAPI()
    if (!api) {
      // fallback: 无 electronAPI 时用 mock
      set({ status: 'connected', deviceInfo: { serial: 'mock', model: 'Test Device', resolution: '1080x2400' } })
      return
    }
    set({ status: 'connecting', errorMsg: '' })
    try {
      const result = await api.connect()
      if (result.success && result.data) {
        set({
          status: 'connected',
          deviceInfo: {
            serial: result.data.serial,
            model: result.data.model,
            resolution: result.data.resolution || '未知',
          },
          errorMsg: '',
        })
      } else {
        set({ status: 'error', errorMsg: result.error || '连接失败' })
      }
    } catch (error) {
      set({ status: 'error', errorMsg: String(error) })
    }
  },

  disconnect: async () => {
    const api = getAPI()
    if (!api) {
      set({ status: 'idle', deviceInfo: null })
      return
    }
    set({ status: 'disconnecting' })
    try {
      await api.disconnect()
      set({ status: 'idle', deviceInfo: null, errorMsg: '' })
    } catch (error) {
      console.error('[DeviceStore] 断开失败:', error)
      set({ status: 'error', errorMsg: String(error) })
    }
  },

  _setFrameMeta: (width, height) => {
    set((state) => ({
      deviceInfo: state.deviceInfo
        ? { ...state.deviceInfo, resolution: `${width}x${height}` }
        : state.deviceInfo,
    }))
  },
}))

