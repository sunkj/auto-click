import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerScriptHandlers } from './script'
import { registerScrcpyHandlers } from './screen-mirror'
import { registerEngineHandlers } from './script-engine'

const isDev = process.env.NODE_ENV !== 'production'

let mainWindow: BrowserWindow | null = null
/** 最小化前保存的窗口内容尺寸，用于还原 */
let prevContentSize: { width: number; height: number } | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 600,
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
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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
  // 注册 IPC 处理器（窗口创建前注册，确保渲染进程就绪后可用）
  registerScriptHandlers()
  registerScrcpyHandlers()
  registerEngineHandlers()

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
