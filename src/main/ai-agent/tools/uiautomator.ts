/**
 * UI Automator 布局解析工具
 *
 * 通过 `adb shell uiautomator dump` 获取当前屏幕的 UI 层级布局，
 * 解析 XML 找到目标元素的精确坐标（bounds）。
 *
 * 相比 VLM 视觉定位，UI Automator 直接读取原生控件位置，
 * 坐标精度是像素级的，不受模型降采样影响。
 *
 * 设备端使用固定文件名 /data/local/tmp/autoclick_ui.xml，每次覆盖。
 * PC 端使用临时目录存放 pull 下来的文件，用完即删。
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { VisualResult, VisualElement } from '../types'

const execAsync = promisify(exec)

/** 设备端固定的 XML 导出路径（每次覆盖，不会累积） */
const REMOTE_PATH = '/data/local/tmp/autoclick_ui.xml'
/** 本地临时目录 */
const LOCAL_DIR = path.join(app.getPath('temp'), 'autoclick-uiautomator')
const LOCAL_FILE = path.join(LOCAL_DIR, 'autoclick_ui.xml')

/**
 * 通过 UI Automator 在屏幕中查找目标元素
 *
 * @param serial 设备序列号
 * @param targetText 目标文字（如 "微信"）
 * @param deviceWidth 设备宽度（用于 bounds 归一化容错）
 * @param deviceHeight 设备高度
 */
export async function findElementByUiAutomator(
  serial: string,
  targetText: string,
  deviceWidth: number,
  deviceHeight: number,
): Promise<VisualResult> {
  // 1. 确保本地目录存在
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true })
  }

  // 2. 通过 adb 执行 uiautomator dump，输出到固定路径（覆盖写）
  const dumpCmd = `adb -s ${serial} shell uiautomator dump ${REMOTE_PATH}`
  console.log('[UiAutomator] 执行 dump:', dumpCmd)
  await execAsync(dumpCmd, { timeout: 10000 })

  // 3. pull XML 到本地
  const pullCmd = `adb -s ${serial} pull ${REMOTE_PATH} "${LOCAL_FILE}"`
  console.log('[UiAutomator] pull XML:', pullCmd)
  await execAsync(pullCmd, { timeout: 10000 })

  // 4. 读取并解析 XML
  const xmlContent = fs.readFileSync(LOCAL_FILE, 'utf-8')
  console.log('[UiAutomator] XML 大小:', xmlContent.length, 'bytes')

  // 5. 删除本地临时文件
  try { fs.unlinkSync(LOCAL_FILE) } catch { /* ignore */ }

  // 6. 解析 XML 查找目标元素
  const elements = parseUiXml(xmlContent, targetText, deviceWidth, deviceHeight)

  if (elements.length > 0) {
    const desc = elements.map(e => `"${e.label}" @ (${e.center.x}, ${e.center.y})`).join('; ')
    console.log('[UiAutomator] 找到元素:', desc)
  } else {
    console.log('[UiAutomator] 未找到目标:', targetText)
  }

  return {
    elements,
    rawDescription: elements.length > 0
      ? `UI Automator 找到 ${elements.length} 个匹配元素`
      : `UI Automator 未找到 "${targetText}"`,
  }
}

/**
 * 解析 uiautomator dump 输出的 XML，查找匹配目标文字的节点
 *
 * XML 节点示例：
 *   <node text="微信" bounds="[310,882][472,1044]" .../>
 *
 * bounds 格式：[left,top][right,bottom]
 */
function parseUiXml(
  xml: string,
  targetText: string,
  deviceWidth: number,
  deviceHeight: number,
): VisualElement[] {
  const results: VisualElement[] = []
  const target = targetText.toLowerCase().replace(/\s/g, '')

  // 匹配所有 <node ...> 标签
  const nodeRegex = /<node\s+([^>]*?)\/?\s*>/gi
  let match: RegExpExecArray | null

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1]

    // 提取 text 和 content-desc
    const text = extractAttr(attrs, 'text')
    const contentDesc = extractAttr(attrs, 'content-desc')
    const boundsStr = extractAttr(attrs, 'bounds')

    // 如果没有 bounds 或没有文字，跳过
    if (!boundsStr || (!text && !contentDesc)) continue

    // 检查是否匹配目标文字
    const label = text || contentDesc || ''
    const cleanLabel = label.toLowerCase().replace(/\s/g, '')
    if (!cleanLabel.includes(target) && !target.includes(cleanLabel)) continue

    // 解析 bounds: "[310,882][472,1044]"
    const bounds = parseBounds(boundsStr)
    if (!bounds) continue

    const centerX = Math.round((bounds.left + bounds.right) / 2)
    const centerY = Math.round((bounds.top + bounds.bottom) / 2)
    const width = bounds.right - bounds.left
    const height = bounds.bottom - bounds.top

    results.push({
      label,
      bounds: {
        x: bounds.left,
        y: bounds.top,
        width,
        height,
      },
      center: { x: centerX, y: centerY },
      confidence: 0.95,
    })
  }

  // 按面积从小到大排序（优先匹配最具体的元素）
  results.sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height)

  return results
}

/** 从 XML 属性字符串中提取指定属性的值 */
function extractAttr(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i')
  const m = attrs.match(regex)
  return m ? m[1] : null
}

/** 解析 bounds 字符串 "[x1,y1][x2,y2]" → { left, top, right, bottom } */
function parseBounds(str: string): { left: number; top: number; right: number; bottom: number } | null {
  const m = str.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/)
  if (!m) return null
  return {
    left: parseInt(m[1]),
    top: parseInt(m[2]),
    right: parseInt(m[3]),
    bottom: parseInt(m[4]),
  }
}
