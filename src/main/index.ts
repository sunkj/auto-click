import { app, BrowserWindow, ipcMain, nativeImage, protocol, net } from 'electron'
import path from 'path'
import { registerScriptHandlers } from './script'
import { registerScrcpyHandlers } from './screen-mirror'
import { registerEngineHandlers } from './script-engine'
import { loadConfig, saveConfig } from './config'

const isDev = !app.isPackaged

// 注册 app:// 为特权协议（支持 Web Worker、WASM、fetch 等）
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } },
])

let mainWindow: BrowserWindow | null = null
/** 最小化前保存的窗口内容尺寸，用于还原 */
let prevContentSize: { width: number; height: number } | null = null

function createWindow(): void {
  const iconPath = path.join(__dirname, '../../../resources/macos/icon.icns')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    // macOS dock 图标（开发模式下替换默认 Electron 图标）
    if (process.platform === 'darwin') {
      try {
        const ico = nativeImage.createFromPath(iconPath)
        if (!ico.isEmpty()) {
          app.dock.setIcon(ico)
        }
      } catch (_e) { /* 忽略 */ }
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    console.log('[main] loading renderer via app:// protocol')
    mainWindow.loadURL('app://renderer/index.html').then(() => {
      console.log('[main] renderer loaded')
    }).catch((err) => {
      console.error('[main] renderer load failed:', err)
    })
    // 输出渲染进程控制台日志到终端（调试用）
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      console.log(`[renderer] ${message}`)
    })
    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error('[main] did-fail-load:', code, desc, url)
    })
  }
}

// 窗口缩放 IPC：最小化到设备屏幕大小 / 还原
ipcMain.handle('window:resizeToScreen', async (_event, width: number, height: number) => {
  if (!mainWindow) return { success: false, error: '窗口未创建' }
  // 保存当前尺寸用于还原
  const [cw, ch] = mainWindow.getContentSize()
  prevContentSize = { width: cw, height: ch }
  // 临时解除最小宽度限制，允许缩到 328px
  mainWindow.setMinimumSize(200, 200)
  mainWindow.setContentSize(width, height)
  mainWindow.center()
  return { success: true }
})

ipcMain.handle('window:restoreSize', async () => {
  if (!mainWindow) return { success: false, error: '窗口未创建' }
  const w = prevContentSize?.width ?? 1280
  const h = prevContentSize?.height ?? 900
  // 恢复最小宽度限制
  mainWindow.setMinimumSize(960, 600)
  mainWindow.setContentSize(w, h)
  mainWindow.center()
  prevContentSize = null
  return { success: true }
})

app.whenReady().then(() => {
  // macOS dock 图标（尽早设置，替换默认 Electron 图标）
  if (process.platform === 'darwin') {
    try {
      const icon = nativeImage.createFromPath(path.join(__dirname, '../../../resources/macos/icon.icns'))
      if (!icon.isEmpty()) app.dock.setIcon(icon)
    } catch (_e) { /* 忽略 */ }
  }

  // 注册自定义协议 app://，用于加载渲染进程文件（解决 file:// 不支持模块脚本的问题）
  const rendererDir = path.join(__dirname, '../../renderer')
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    let filePath = decodeURIComponent(url.pathname)
    filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '')
    return net.fetch('file://' + path.join(rendererDir, filePath))
  })

  // 注册 IPC 处理器（窗口创建前注册，确保渲染进程就绪后可用）
  registerScriptHandlers()
  registerScrcpyHandlers()
  registerEngineHandlers()
  // 配置读写 IPC
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', (_event, config) => { saveConfig(config); return { success: true } })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
