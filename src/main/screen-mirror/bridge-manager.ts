/**
 * 视频流桥接进程管理
 *
 * 启动/停止 bridge.mjs（ESM 子进程），解析 stdout JSON lines 并广播到渲染进程。
 */
import { spawn } from 'child_process'
import path from 'path'
import { BrowserWindow } from 'electron'
import { SMC } from './channels'

/** 向所有窗口广播消息 */
function send(channel: string, data?: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data))
}

let bridgeProcess: import('child_process').ChildProcess | null = null

export const bridge = {
  /** 启动桥接进程 */
  start(serial: string, audioEnabled = false): void {
    stop()
    const bridgePath = path.join(__dirname, 'bridge.mjs')
    // 在完整 PATH 环境下用 node 运行桥接进程
    const env = {
      ...process.env,
      PATH: [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin',
        '/bin',
        process.env.PATH || '',
      ].join(':'),
    }
    bridgeProcess = spawn('node', [bridgePath, serial, String(audioEnabled)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    let buffer = ''
    bridgeProcess.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)

          if (msg.type === 'meta') {
            if (msg.width && msg.height) {
              send(SMC.FRAME, { type: 'meta', meta: { width: msg.width, height: msg.height } })
            }
          } else if (msg.type === 'config') {
            send(SMC.FRAME, { type: 'config', data: [...Buffer.from(msg.data, 'base64')] })
          } else if (msg.type === 'frame') {
            send(SMC.FRAME, {
              type: 'frame',
              data: [...Buffer.from(msg.data, 'base64')],
              keyframe: msg.keyframe,
              pts: msg.pts,
            })
          } else if (msg.type === 'error') {
            send(SMC.ERROR, msg.error)
          }
        } catch { /* 忽略解析错误 */ }
      }
    })

    bridgeProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[bridge]', data.toString())
    })

    bridgeProcess.on('exit', (code) => {
      console.log('[bridge] 退出 code:', code)
      bridgeProcess = null
    })
  },

  /** 停止桥接进程 */
  stop(): void {
    if (bridgeProcess) {
      bridgeProcess.kill()
      bridgeProcess = null
    }
  },
}

const stop = bridge.stop
