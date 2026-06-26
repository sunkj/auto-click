/** 投屏管理 IPC 通道常量 */
export const SMC = {
  CONNECT: 'scrcpy:connect',
  DISCONNECT: 'scrcpy:disconnect',
  GET_DEVICES: 'scrcpy:getDevices',
  GET_STATUS: 'scrcpy:getStatus',
  TAP: 'scrcpy:tap',
  SWIPE: 'scrcpy:swipe',
  SWIPE_UP: 'scrcpy:swipeUp',
  SWIPE_DOWN: 'scrcpy:swipeDown',
  BACK: 'scrcpy:back',
  HOME: 'scrcpy:home',
  FRAME: 'scrcpy:frame',
  CONNECTED: 'scrcpy:connected',
  DISCONNECTED: 'scrcpy:disconnected',
  ERROR: 'scrcpy:error',
} as const

export type ScrcpyChannel = (typeof SMC)[keyof typeof SMC]

export interface SimpleDeviceInfo {
  serial: string
  model: string
  resolution: string
  deviceWidth?: number
  deviceHeight?: number
  /** 'usb' | 'wi-fi' */
  transport?: string
}
