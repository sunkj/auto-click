/**
 * OCR 文字识别服务
 *
 * 使用 tesseract.js 对手机截图进行文字识别，
 * 找到用户目标文字在屏幕上的精确位置。
 * 比 VLM 视觉定位更可靠，直接基于像素级文字检测。
 */
import { createWorker } from 'tesseract.js'
import type { VisualResult, VisualElement } from '../types'

// 单例 worker（避免重复加载语言包）
let worker: import('tesseract.js').Worker | null = null

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!worker) {
    worker = await createWorker('chi_sim+eng')
  }
  return worker
}

/**
 * 在截图中查找目标文字的位置
 *
 * @param imagePath 截图本地文件路径
 * @param targetText 要查找的文字（如 "微信"）
 * @param imageWidth 截图宽度（缩放后）
 * @param imageHeight 截图高度（缩放后）
 * @param originalWidth 原始设备宽度
 * @param originalHeight 原始设备高度
 */
export async function findTextInScreenshot(
  imagePath: string,
  targetText: string,
  imageWidth: number,
  imageHeight: number,
  originalWidth: number,
  originalHeight: number,
): Promise<VisualResult> {
  const w = await getWorker()
  const { data } = await w.recognize(imagePath)
  const page = data as any

  const scaleX = originalWidth / imageWidth
  const scaleY = originalHeight / imageHeight

  const elements: VisualElement[] = []

  for (const word of page.words || []) {
    // 检查是否包含目标文字（模糊匹配）
    if (matchesText(word.text, targetText)) {
      const { bbox } = word
      elements.push({
        label: word.text,
        bounds: {
          x: Math.round(bbox.x0 * scaleX),
          y: Math.round(bbox.y0 * scaleY),
          width: Math.round((bbox.x1 - bbox.x0) * scaleX),
          height: Math.round((bbox.y1 - bbox.y0) * scaleY),
        },
        center: {
          x: Math.round(((bbox.x0 + bbox.x1) / 2) * scaleX),
          y: Math.round(((bbox.y0 + bbox.y1) / 2) * scaleY),
        },
        confidence: word.confidence ? word.confidence / 100 : 0.5,
        text: word.text,
        type: 'text',
      })
    }
  }

  // 也检查按行识别的结果
  for (const line of page.lines || []) {
    // 跳过已通过 words 匹配到的
    const alreadyFound = elements.some((e) => {
      const dx = Math.abs(e.center.x - ((line.bbox.x0 + line.bbox.x1) / 2) * scaleX)
      const dy = Math.abs(e.center.y - ((line.bbox.y0 + line.bbox.y1) / 2) * scaleY)
      return dx < 50 && dy < 50
    })
    if (!alreadyFound && matchesText(line.text, targetText)) {
      elements.push({
        label: line.text,
        bounds: {
          x: Math.round(line.bbox.x0 * scaleX),
          y: Math.round(line.bbox.y0 * scaleY),
          width: Math.round((line.bbox.x1 - line.bbox.x0) * scaleX),
          height: Math.round((line.bbox.y1 - line.bbox.y0) * scaleY),
        },
        center: {
          x: Math.round(((line.bbox.x0 + line.bbox.x1) / 2) * scaleX),
          y: Math.round(((line.bbox.y0 + line.bbox.y1) / 2) * scaleY),
        },
        confidence: 0.5,
        text: line.text,
        type: 'text',
      })
    }
  }

  return {
    elements,
    rawDescription: elements.length > 0
      ? `OCR 找到 "${targetText}" 在 ${elements.length} 个位置`
      : `OCR 未找到 "${targetText}"`,
  }
}

/**
 * 判断 OCR 识别的文字是否匹配目标文字
 * 支持完全匹配和子串匹配
 */
function matchesText(ocrText: string, target: string): boolean {
  const clean = (s: string) => s.replace(/[\s　]/g, '').toLowerCase()
  const ocr = clean(ocrText)
  const tgt = clean(target)
  return ocr === tgt || ocr.includes(tgt) || tgt.includes(ocr)
}
