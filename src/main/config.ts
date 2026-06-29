/**
 * 应用配置管理
 *
 * 将脚本设置 + AI Agent 设置统一存储到 JSON 配置文件（userData/config.json）。
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// AI Agent 子配置 — 按角色（LLM/VLM）而非厂商组织
// =============================================================================

/** LLM 模型配置（意图解析）— 兼容 OpenAI 格式的 API */
export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string          // 如 deepseek-chat、gpt-4o-mini
  temperature: number
  maxTokens: number
  timeout: number
}

/** VLM 模型配置（视觉分析）— 兼容多模态 API */
export interface VLMConfig {
  apiKey: string
  baseUrl: string
  model: string          // 如 glm-4v、gpt-4o
  temperature: number
  maxTokens: number
  timeout: number
  /** 截图参数（VLM 专用） */
  screenshot: {
    maxWidth: number
    quality: number
  }
}

export interface AiAgentConfig {
  llm: LLMConfig
  vlm: VLMConfig
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
  llm: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    timeout: 30000,
  },
  vlm: {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4v',
    temperature: 0.1,
    maxTokens: 200,
    timeout: 30000,
    screenshot: {
      maxWidth: 1024,
      quality: 80,
    },
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

/** 迁移旧配置到新结构（deepseek/zhipu → llm/vlm） */
function migrateLegacyAiConfig(data: any): void {
  const ai = data.aiAgent
  if (!ai) return

  // 已迁移，跳过
  if (ai.llm && ai.vlm) return

  // 从旧 deepseek → llm
  if (ai.deepseek && !ai.llm) {
    ai.llm = {
      apiKey: ai.deepseek.apiKey || '',
      baseUrl: ai.deepseek.baseUrl || 'https://api.deepseek.com',
      model: ai.deepseek.chatModel || 'deepseek-chat',
      temperature: ai.deepseek.temperature ?? 0.1,
      maxTokens: ai.deepseek.maxTokens ?? 4096,
      timeout: ai.deepseek.timeout ?? 30000,
    }
  }

  // 从旧 zhipu → vlm
  if (ai.zhipu && !ai.vlm) {
    ai.vlm = {
      apiKey: ai.zhipu.apiKey || '',
      baseUrl: ai.zhipu.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      model: ai.zhipu.visionModel || 'glm-4v',
      temperature: ai.zhipu.temperature ?? 0.1,
      maxTokens: ai.zhipu.maxTokens ?? 2048,
      timeout: ai.zhipu.timeout ?? 30000,
      screenshot: {
        maxWidth: ai.screenshot?.maxWidth ?? 1024,
        quality: ai.screenshot?.quality ?? 80,
      },
    }
  }

  // 清理旧字段
  delete ai.deepseek
  delete ai.zhipu
  delete ai.screenshot
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      migrateLegacyAiConfig(data)
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

/** 获取 LLM API Key（意图解析） */
export function getLLMKey(): string {
  const config = loadConfig()
  if (config.aiAgent?.llm?.apiKey) return config.aiAgent.llm.apiKey
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  return ''
}

/** 获取 VLM API Key（视觉分析） */
export function getVLMKey(): string {
  const config = loadConfig()
  return config.aiAgent?.vlm?.apiKey || ''
}
