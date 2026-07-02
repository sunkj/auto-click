/**
 * ADB 文件操作服务
 *
 * 通过 adb 命令行工具执行手机文件浏览、上传和下载操作。
 * 独立管理 adb 路径和超时（与 screen-mirror 共享 adb 路径缓存）。
 */
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import type { FileEntry } from './types'

const asyncExec = promisify(exec)

// =============================================================================
// 常量
// =============================================================================

/** 默认手机端根目录 */
export const DEFAULT_ROOT_PATH = '/sdcard'

/** 备选根目录（如果 /sdcard 不可用） */
export const FALLBACK_ROOT_PATH = '/storage/emulated/0'

/** 文件操作超时时间（毫秒）— 大目录/大文件需要更长超时 */
const TIMEOUT_LS = 15000    // 目录列表 15s
const TIMEOUT_PUSH = 120000 // 上传 2min
const TIMEOUT_PULL = 120000 // 下载 2min

// =============================================================================
// ADB 路径解析
// =============================================================================

async function resolveAdbPath(): Promise<string> {
  const commonPaths = [
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
    '/usr/bin/adb',
    '/opt/android/platform-tools/adb',
  ]
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }
  try {
    const { stdout } = await asyncExec('which adb', { encoding: 'utf-8', timeout: 3000 })
    const resolved = stdout.trim()
    if (resolved) return resolved
  } catch { /* ignore */ }
  return 'adb'
}

let adbPathPromise: Promise<string> | null = null

async function getAdbPath(): Promise<string> {
  if (!adbPathPromise) {
    adbPathPromise = resolveAdbPath()
  }
  return adbPathPromise
}

async function adbExec(args: string, timeout: number): Promise<string> {
  const adb = await getAdbPath()
  try {
    const { stdout } = await asyncExec(`${adb} ${args}`, {
      encoding: 'utf-8',
      timeout,
    })
    return stdout
  } catch (e: any) {
    throw new Error(e.stderr || e.message)
  }
}

async function adbShell(serial: string, cmd: string, timeout: number = TIMEOUT_LS): Promise<string> {
  return adbExec(`-s ${serial} shell ${cmd}`, timeout)
}

// =============================================================================
// 辅助函数
// =============================================================================

/** 获取当前已连接设备的 serial */
function getSerial(): string | null {
  try {
    const { ctrl } = require('../screen-mirror/control')
    return ctrl.getSerial() || null
  } catch {
    return null
  }
}

/** 检查设备是否已连接，返回 serial 或抛出错误 */
function requireSerial(): string {
  const serial = getSerial()
  if (!serial) {
    throw new Error('请先连接设备')
  }
  return serial
}

// =============================================================================
// ADB 文件操作
// =============================================================================

/**
 * 列出指定目录的内容
 *
 * 执行 adb shell ls -l 并解析为标准化的 FileEntry[]。
 * 目录在前，文件在后，各自按名称字母序排列。
 */
export async function listDir(dirPath: string): Promise<FileEntry[]> {
  const serial = requireSerial()

  // 规范化路径：去掉尾部斜杠
  const normalizedPath = dirPath.replace(/\/+$/, '') || '/'

  try {
    const output = await adbShell(serial, `ls -l "${normalizedPath}"`)
    const entries = parseLsOutput(output, normalizedPath)
    // 排序：目录在前，文件在后，各自按修改时间倒序（最新的在最上面）
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      // Toybox 格式 YYYY-MM-DD HH:MM 可直接字符串比较
      // GNU 格式 MMM DD HH:MM 也大致按时间排序
      return b.modifiedTime.localeCompare(a.modifiedTime)
    })
    return entries
  } catch (error: any) {
    // ls 失败可能是目录不存在
    throw new Error(`读取目录失败: ${error.message}`)
  }
}

/**
 * 解析 adb shell ls -l 输出
 *
 * Android 使用 toybox，日期格式为 YYYY-MM-DD HH:MM（8列）：
 *   drwxrwx--x 1 root sdcard_rw 4096 2026-07-01 10:30 Android
 *   -rw-rw---- 1 root sdcard_rw  1234 2026-07-01 10:30 test.txt
 *
 * GNU ls 日期格式为 MMM DD HH:MM 或 MMM DD  YYYY（9+列）：
 *   drwxrwx--x 1 root sdcard_rw 4096 Jul  1 10:30 Android
 *   -rw-rw---- 1 root sdcard_rw  1234 Jul  1  2025 test.txt
 *
 * 通过检测 parts[5] 是否包含连字符来区分两种格式。
 */
function parseLsOutput(output: string, basePath: string): FileEntry[] {
  const lines = output.trim().split('\n')
  const entries: FileEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过 total 行
    if (trimmed.startsWith('total ')) continue

    const parts = trimmed.split(/\s+/)

    // 最少需要 7 列：权限(1) 链接数(2) 所有者(3) 组(4) 大小(5) 日期(6) 名称(7+)
    if (parts.length < 7) continue

    const permissions = parts[0]
    if (permissions.length < 3) continue // 不是合法的权限字符串

    const sizeStr = parts[4]
    const isDirectory = permissions.startsWith('d')

    // ── 判断日期格式 ──
    // Toybox: parts[5] = "2026-07-01" 包含连字符
    // GNU:    parts[5] = "Jul" 月份缩写
    const isToyboxFormat = parts[5].includes('-')

    let name: string
    let modifiedTime: string

    if (isToyboxFormat) {
      // Toybox 格式: [权限] [链接] [所有者] [组] [大小] [YYYY-MM-DD] [HH:MM] [名称...]
      name = parts.slice(7).join(' ')
      modifiedTime = `${parts[5]} ${parts[6]}`
    } else {
      // GNU 格式: [权限] [链接] [所有者] [组] [大小] [MMM] [DD] [YYYY|HH:MM] [名称...]
      // parts[7] 可能是年份（旧文件）或时间（新文件）
      name = parts.slice(8).join(' ')
      modifiedTime = `${parts[5]} ${parts[6]} ${parts[7]}`
    }

    // 跳过 . 和 ..
    if (name === '.' || name === '..') continue

    const size = isDirectory ? 0 : parseInt(sizeStr, 10) || 0

    entries.push({
      name,
      path: joinPath(basePath, name),
      isDirectory,
      size,
      modifiedTime,
      permissions,
    })
  }

  return entries
}

/** 安全拼接路径 */
function joinPath(base: string, name: string): string {
  if (base.endsWith('/')) {
    return base + name
  }
  return base + '/' + name
}

/**
 * 上传文件：从电脑推送到手机
 *
 * 执行 adb push localPath remoteDir/
 * 返回上传的文件名
 */
export async function pushFile(localPath: string, remoteDir: string): Promise<string> {
  const serial = requireSerial()

  // 检查本地文件是否存在
  if (!fs.existsSync(localPath)) {
    throw new Error(`本地文件不存在: ${localPath}`)
  }

  const fileName = path.basename(localPath)

  // 规范化远程目录路径
  const normalizedRemoteDir = remoteDir.replace(/\/+$/, '') || '/'

  try {
    // adb push 的输出格式: "file: 1 file pushed. 0.3 MB/s (1234 bytes in 0.010s)"
    await adbExec(`-s ${serial} push "${localPath}" "${normalizedRemoteDir}/"`, TIMEOUT_PUSH)

    // 通知 Android MediaStore 扫描新文件，使其在图库/相册中可见
    const remotePath = `${normalizedRemoteDir}/${fileName}`
    try {
      await adbShell(serial, `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${remotePath}"`, 5000)
    } catch {
      // 媒体扫描通知失败不影响上传结果，静默忽略
    }

    return fileName
  } catch (error: any) {
    throw new Error(`上传失败: ${error.message}`)
  }
}

/**
 * 下载文件：从手机拉取到电脑
 *
 * 执行 adb pull remotePath localDir/
 * 如果本地已存在同名文件，自动添加时间戳后缀
 * 返回保存路径
 */
export async function pullFile(remotePath: string, localDir?: string): Promise<{ fileName: string; savePath: string }> {
  const serial = requireSerial()

  // 默认下载到系统下载目录
  const targetDir = localDir || app.getPath('downloads')

  // 确保目标目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const fileName = path.basename(remotePath)
  let savePath = path.join(targetDir, fileName)

  // 如果文件已存在，添加时间戳后缀
  if (fs.existsSync(savePath)) {
    const ext = path.extname(fileName)
    const baseName = path.basename(fileName, ext)
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    savePath = path.join(targetDir, `${baseName}(${timestamp})${ext}`)
  }

  try {
    await adbExec(`-s ${serial} pull "${remotePath}" "${savePath}"`, TIMEOUT_PULL)
    return { fileName, savePath }
  } catch (error: any) {
    throw new Error(`下载失败: ${error.message}`)
  }
}

/** 支持生成缩略图的图片扩展名 */
const THUMBNAIL_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
])

/** 缩略图最大尺寸（像素） */
const THUMBNAIL_SIZE = 120

/** 缩略图最大读取字节（超过此大小的文件跳过缩略图） */
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * 获取远程图片文件的缩略图（base64 data URL）
 *
 * 通过 adb exec-out cat 读取远程图片文件，使用 sharp 缩放到 120px，
 * 返回 `data:image/png;base64,...` 格式的 data URL。
 * 非图片格式或读取失败时返回 null。
 */
export async function getThumbnail(remotePath: string): Promise<string | null> {
  const serial = requireSerial()

  const ext = path.extname(remotePath).toLowerCase()
  if (!THUMBNAIL_EXTENSIONS.has(ext)) {
    return null
  }

  const adb = await getAdbPath()

  try {
    // 先检查文件大小，跳过过大的文件
    const sizeOutput = await adbShell(serial, `stat -c '%s' "${remotePath}"`, TIMEOUT_LS)
    const fileSize = parseInt(sizeOutput.trim(), 10)
    if (isNaN(fileSize) || fileSize > MAX_THUMBNAIL_BYTES || fileSize === 0) {
      return null
    }

    // 使用 exec-out 读取二进制数据（不经过 shell，避免二进制损坏）
    const { stdout } = await asyncExec(
      `${adb} -s ${serial} exec-out cat "${remotePath}"`,
      { encoding: 'buffer' as any, maxBuffer: MAX_THUMBNAIL_BYTES, timeout: 15000 }
    )

    const rawBuffer = stdout as unknown as Buffer
    if (!rawBuffer || rawBuffer.length === 0) return null

    // 使用 sharp 生成缩略图
    const sharp = await import('sharp')
    const thumbnailBuffer = await sharp.default(rawBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', withoutEnlargement: true })
      .png()
      .toBuffer()

    return `data:image/png;base64,${thumbnailBuffer.toString('base64')}`
  } catch {
    return null
  }
}
