/**
 * 应用配置管理
 *
 * 将脚本设置 + AI Agent 设置统一存储到 JSON 配置文件（userData/config.json）。
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// AI Agent 子配置
// =============================================================================

export interface AiAgentConfig {
  deepseek: {
    apiKey: string
    baseUrl: string
    chatModel: string
    temperature: number
    maxTokens: number
    timeout: number
  }
  zhipu: {
    apiKey: string
    baseUrl: string
    visionModel: string
    temperature: number
    maxTokens: number
    timeout: number
  }
  screenshot: {
    maxWidth: number
    quality: number
    cacheSize: number
  }
  workflow: {
    nodeTimeout: number
    maxRetries: number
    retryDelay: number
    defaultDuration: number
    longPressDuration: number
    /** 打开 App 时扫描桌面页数（先左滑 N 次，再右滑 N 次） */
    appScanPages: number
  }
}

const DEFAULT_AI_CONFIG: AiAgentConfig = {
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    chatModel: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    timeout: 30000,
  },
  zhipu: {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    visionModel: 'glm-4v',
    temperature: 0.1,
    maxTokens: 2048,
    timeout: 30000,
  },
  screenshot: {
    maxWidth: 1024,
    quality: 80,
    cacheSize: 3,
  },
  workflow: {
    nodeTimeout: 60000,
    maxRetries: 2,
    retryDelay: 1000,
    defaultDuration: 300,
    longPressDuration: 1500,
    appScanPages: 3,
  },
}

// =============================================================================
// 主配置
// =============================================================================

export interface AppConfig {
  scriptTimeout: number   // 脚本超时（秒）
  stepInterval: number    // 步骤执行间隔（秒）
  maxRetries: number      // 最大重试次数
  aiAgent?: AiAgentConfig // AI Agent 配置
}

const DEFAULT_CONFIG: AppConfig = {
  scriptTimeout: 1800,
  stepInterval: 3,
  maxRetries: 3,
  aiAgent: { ...DEFAULT_AI_CONFIG },
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return {
        ...DEFAULT_CONFIG,
        ...data,
        aiAgent: { ...DEFAULT_AI_CONFIG, ...(data.aiAgent || {}) },
      }
    }
  } catch { /* 忽略解析错误 */ }
  return { ...DEFAULT_CONFIG, aiAgent: { ...DEFAULT_AI_CONFIG } }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/** 获取 DeepSeek API Key（用于意图理解） */
export function getDeepSeekKey(): string {
  const config = loadConfig()
  if (config.aiAgent?.deepseek?.apiKey) return config.aiAgent.deepseek.apiKey
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  return ''
}

/** 获取智谱 API Key（用于视觉分析） */
export function getZhipuKey(): string {
  const config = loadConfig()
  return config.aiAgent?.zhipu?.apiKey || ''
}
