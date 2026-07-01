/**
 * Scrcpy 视频流桥接进程 (ESM)
 *
 * 与 demo/api/scrcpy/stream/route.ts 相同逻辑，通过 stdin/stdout JSON lines 通信。
 *
 * 用法: node bridge.mjs <deviceSerial>
 */
import { AdbServerClient } from '@yume-chan/adb'
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp'
import { AdbScrcpyClient, AdbScrcpyOptionsLatest } from '@yume-chan/adb-scrcpy'
import { DefaultServerPath, ScrcpyCodecOptions } from '@yume-chan/scrcpy'
import { PushReadableStream } from '@yume-chan/stream-extra'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serial = process.argv[2]
const audioEnabled = process.argv[3] === 'true'
if (!serial) { console.error('Usage: node bridge.mjs <serial> [audioEnabled]'); process.exit(1) }

function send(type, data = {}) {
  process.stdout.write(JSON.stringify({ type, ...data }) + '\n')
}

async function main() {
  // 1. 连接 ADB
  const connector = new AdbServerNodeTcpConnector({ host: '127.0.0.1', port: 5037 })
  const client = new AdbServerClient(connector)
  const devices = await client.getDevices()
  const device = devices.find((d) => d.serial === serial) || devices[0]
  if (!device) throw new Error('设备未找到')
  const adb = await client.createAdb(device)
  const model = device.model || (await adb.getProp('ro.product.model')) || serial
  send('meta', { serial, model })

  // 2. 推送 scrcpy-server（从 node_modules 读取已下载的 server.bin）
  const serverPath = resolve(__dirname, '../../../../node_modules/@yume-chan/fetch-scrcpy-server/server.bin')
  const jarBuffer = await readFile(serverPath)
  const jarStream = new PushReadableStream((controller) => {
    controller.enqueue(new Uint8Array(jarBuffer))
    controller.close()
  })
  await AdbScrcpyClient.pushServer(adb, jarStream, DefaultServerPath)

  // 3. 启动 scrcpy（与 demo 完全一致）
  const scrcpy = await AdbScrcpyClient.start(
    adb,
    DefaultServerPath,
    new AdbScrcpyOptionsLatest(
      {
        video: true,
        audio: audioEnabled,
        control: true,
        powerOn: true,
        maxSize: 1080,
        videoBitRate: 2_000_000,
        videoCodecOptions: new ScrcpyCodecOptions({ profile: 1, level: 4096 }),
      },
      { version: '3.3.4' }
    )
  )

  // 4. 获取视频流元数据
  const videoStream = await scrcpy.videoStream
  const meta = videoStream.metadata
  send('meta', { width: meta?.width, height: meta?.height, codec: meta?.codec })

  // 5. 并行读取视频和音频流
  async function readVideo() {
    const reader = videoStream.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === 'configuration') {
        send('config', { data: Buffer.from(value.data).toString('base64') })
      } else {
        send('frame', {
          data: Buffer.from(value.data).toString('base64'),
          keyframe: value.keyframe,
          pts: value.pts != null ? Number(value.pts) : undefined,
        })
      }
    }
  }

  async function readAudio() {
    try {
      const audioStream = await scrcpy.audioStream
      if (!audioStream) {
        console.error('[audio] audioStream is null/undefined')
        return
      }
      console.error('[audio] audioStream available, metadata:', JSON.stringify(audioStream.metadata))
      const reader = audioStream.stream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        console.error('[audio] packet type:', value.type, 'hasData:', !!value.data, 'dataLen:', value.data?.byteLength, 'pts:', value.pts != null ? Number(value.pts) : 'null')
        if (value.type === 'configuration') {
          send('audio-config', { data: Buffer.from(value.data).toString('base64') })
        } else if (value.data && value.data.byteLength > 0) {
          send('audio-frame', {
            data: Buffer.from(value.data).toString('base64'),
            pts: value.pts != null ? Number(value.pts) : undefined,
          })
        }
      }
    } catch (e) {
      console.error('[audio] readAudio error:', e.message, e.stack)
    }
  }

  await Promise.all([readVideo(), readAudio()])
}

main().catch((err) => {
  send('error', { error: err.message })
  process.exit(1)
})
