/**
 * 应用配置管理
 *
 * 将脚本设置存储到 JSON 配置文件（userData/config.json）。
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface AppConfig {
  scriptTimeout: number   // 脚本超时（秒）
  stepInterval: number    // 步骤执行间隔（秒）
  maxRetries: number      // 最大重试次数
}

const DEFAULT_CONFIG: AppConfig = {
  scriptTimeout: 1800,
  stepInterval: 0.5,
  maxRetries: 3,
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return { ...DEFAULT_CONFIG, ...data }
    }
  } catch { /* 忽略解析错误 */ }
  return { ...DEFAULT_CONFIG }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}
