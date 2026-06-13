import { create } from 'zustand'

interface DeviceInfo {
  model: string
  resolution: string
  battery: number
}

interface DeviceStore {
  isConnected: boolean
  deviceInfo: DeviceInfo | null
  screenStreamUrl: string | null
  connect: () => void
  disconnect: () => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  isConnected: false,
  deviceInfo: null,
  screenStreamUrl: null,
  connect: () => set({
    isConnected: true,
    deviceInfo: { model: 'Pixel 6', resolution: '1080x2400', battery: 85 },
  }),
  disconnect: () => set({
    isConnected: false,
    deviceInfo: null,
    screenStreamUrl: null,
  }),
}))
