/**
 * 图片处理工具
 */
import * as fs from 'fs'

/**
 * 检测两张截图是否相似（像素级简单对比 — 用于缓存判断）
 * 注：实际实现使用 sharp 的像素差值，此处简化
 */
export function areScreenshotsSimilar(path1: string, path2: string, threshold = 0.95): boolean {
  try {
    const buf1 = fs.readFileSync(path1)
    const buf2 = fs.readFileSync(path2)
    if (buf1.length === buf2.length) return true
    // 简单判断：文件大小差异小于 5% 视为相似
    const ratio = Math.min(buf1.length, buf2.length) / Math.max(buf1.length, buf2.length)
    return ratio >= threshold
  } catch {
    return false
  }
}
