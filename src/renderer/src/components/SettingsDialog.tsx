import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Play, Cpu, Key, Wifi } from 'lucide-react'

// =============================================================================
// Tab 定义
// =============================================================================

type TabId = 'script' | 'ai'

interface TabItem {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabItem[] = [
  { id: 'script', label: '脚本执行', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'ai', label: 'AI 设置', icon: <Cpu className="h-3.5 w-3.5" /> },
]

// =============================================================================
// Props
// =============================================================================

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// =============================================================================
// 组件：AI 设置表单
// =============================================================================

function AiSettingsForm({ config, onChange }: {
  config: {
    apiKey: string
    baseUrl: string
    chatModel: string
    visionModel: string
    temperature: string
    maxTokens: string
    timeout: string
    maxWidth: string
    quality: string
  }
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* API Key */}
      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Key className="h-3 w-3 text-muted-foreground" />
          DeepSeek API 密钥
        </label>
        <Input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange('apiKey', e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          className="h-10 text-sm font-mono bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      {/* API 地址 */}
      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Wifi className="h-3 w-3 text-muted-foreground" />
          API 地址
        </label>
        <Input
          value={config.baseUrl}
          onChange={(e) => onChange('baseUrl', e.target.value)}
          className="h-10 text-sm bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      {/* 模型选择 */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-[320px]">
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">对话模型</label>
          <Input
            value={config.chatModel}
            onChange={(e) => onChange('chatModel', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground"
          />
        </div>
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">视觉模型</label>
          <Input
            value={config.visionModel}
            onChange={(e) => onChange('visionModel', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground"
          />
        </div>
      </div>

      {/* 高级参数 */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[400px]">
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">超时 (ms)</label>
          <Input
            type="number"
            value={config.timeout}
            onChange={(e) => onChange('timeout', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground font-mono"
          />
        </div>
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">Max Token</label>
          <Input
            type="number"
            value={config.maxTokens}
            onChange={(e) => onChange('maxTokens', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground font-mono"
          />
        </div>
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">温度</label>
          <Input
            type="number"
            step="0.05"
            min="0"
            max="2"
            value={config.temperature}
            onChange={(e) => onChange('temperature', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground font-mono"
          />
        </div>
      </div>

      {/* 截图参数 */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-[240px]">
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">截图宽度</label>
          <Input
            type="number"
            value={config.maxWidth}
            onChange={(e) => onChange('maxWidth', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground font-mono"
          />
        </div>
        <div className="flex flex-col gap-[8px] items-start">
          <label className="text-xs font-medium text-foreground tracking-[0.24px]">质量</label>
          <Input
            type="number"
            min="1"
            max="100"
            value={config.quality}
            onChange={(e) => onChange('quality', e.target.value)}
            className="h-10 text-sm bg-background border-input text-foreground font-mono"
          />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// 组件：脚本设置表单
// =============================================================================

function ScriptSettingsForm({ scriptTimeout, stepInterval, maxRetries, onChange }: {
  scriptTimeout: string
  stepInterval: string
  maxRetries: string
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">
          步骤间隔（秒）
        </label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={stepInterval}
          onChange={(e) => onChange('stepInterval', e.target.value)}
          className="h-10 text-sm bg-background border-input text-foreground font-mono w-[128px]"
        />
        <p className="text-xs text-muted-foreground/70 leading-5">
          每一步执行完成后等待的延迟时间
        </p>
      </div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">
          脚本超时（秒）
        </label>
        <Input
          type="number"
          value={scriptTimeout}
          onChange={(e) => onChange('scriptTimeout', e.target.value)}
          className="h-10 text-sm bg-background border-input text-foreground font-mono w-[128px]"
        />
        <p className="text-xs text-muted-foreground/70 leading-5">
          脚本执行超过此时间将自动终止
        </p>
      </div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">
          最大重试次数
        </label>
        <Input
          type="number"
          value={maxRetries}
          onChange={(e) => onChange('maxRetries', e.target.value)}
          className="h-10 text-sm bg-background border-input text-foreground font-mono w-[128px]"
        />
      </div>
    </div>
  )
}

// =============================================================================
// 主组件
// =============================================================================

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('script')
  const [loading, setLoading] = useState(false)

  // 脚本设置
  const [scriptTimeout, setScriptTimeout] = useState('1800')
  const [stepInterval, setStepInterval] = useState('0.5')
  const [maxRetries, setMaxRetries] = useState('3')

  // AI 设置
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.deepseek.com')
  const [aiChatModel, setAiChatModel] = useState('deepseek-chat')
  const [aiVisionModel, setAiVisionModel] = useState('deepseek-vision')
  const [aiTemperature, setAiTemperature] = useState('0.1')
  const [aiMaxTokens, setAiMaxTokens] = useState('2048')
  const [aiTimeout, setAiTimeout] = useState('30000')
  const [aiMaxWidth, setAiMaxWidth] = useState('1024')
  const [aiQuality, setAiQuality] = useState('80')

  // 打开时加载配置
  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.electronAPI?.config?.load().then((cfg: any) => {
      if (!cfg) return
      setScriptTimeout(String(cfg.scriptTimeout ?? 1800))
      setStepInterval(String(cfg.stepInterval ?? 0.5))
      setMaxRetries(String(cfg.maxRetries ?? 3))

      const ai = cfg.aiAgent || {}
      const ds = ai.deepseek || {}
      setAiApiKey(ds.apiKey ?? '')
      setAiBaseUrl(ds.baseUrl ?? 'https://api.deepseek.com')
      setAiChatModel(ds.chatModel ?? 'deepseek-chat')
      setAiVisionModel(ds.visionModel ?? 'deepseek-vision')
      setAiTemperature(String(ds.temperature ?? 0.1))
      setAiMaxTokens(String(ds.maxTokens ?? 2048))
      setAiTimeout(String(ds.timeout ?? 30000))

      const sc = ai.screenshot || {}
      setAiMaxWidth(String(sc.maxWidth ?? 1024))
      setAiQuality(String(sc.quality ?? 80))
    }).finally(() => setLoading(false))
  }, [open])

  const handleScriptChange = (key: string, value: string) => {
    switch (key) {
      case 'scriptTimeout': setScriptTimeout(value); break
      case 'stepInterval': setStepInterval(value); break
      case 'maxRetries': setMaxRetries(value); break
    }
  }

  const handleAiChange = (key: string, value: string) => {
    switch (key) {
      case 'apiKey': setAiApiKey(value); break
      case 'baseUrl': setAiBaseUrl(value); break
      case 'chatModel': setAiChatModel(value); break
      case 'visionModel': setAiVisionModel(value); break
      case 'temperature': setAiTemperature(value); break
      case 'maxTokens': setAiMaxTokens(value); break
      case 'timeout': setAiTimeout(value); break
      case 'maxWidth': setAiMaxWidth(value); break
      case 'quality': setAiQuality(value); break
    }
  }

  const handleSave = async () => {
    await window.electronAPI?.config?.save({
      scriptTimeout: Number(scriptTimeout) || 1800,
      stepInterval: Number(stepInterval) || 0.5,
      maxRetries: Number(maxRetries) || 3,
      aiAgent: {
        deepseek: {
          apiKey: aiApiKey,
          baseUrl: aiBaseUrl,
          chatModel: aiChatModel,
          visionModel: aiVisionModel,
          temperature: Number(aiTemperature) || 0.1,
          maxTokens: Number(aiMaxTokens) || 2048,
          timeout: Number(aiTimeout) || 30000,
        },
        screenshot: {
          maxWidth: Number(aiMaxWidth) || 1024,
          quality: Number(aiQuality) || 80,
          cacheSize: 3,
        },
        workflow: {
          nodeTimeout: 60000,
          maxRetries: 2,
          retryDelay: 1000,
          defaultDuration: 300,
          longPressDuration: 1500,
        },
      },
    })
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      {/* Dialog */}
      <div className="relative z-50 w-[640px] max-h-[480px] flex flex-col bg-background border border-border rounded-lg shadow-lg overflow-clip">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-[17px] border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">系统设置</h2>
        </div>

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 min-h-px">
          {/* Left Sidebar */}
          <aside className="w-[192px] shrink-0 bg-muted/30 border-r border-border py-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-3 w-full pl-[18px] pr-4 py-2 text-xs font-medium tracking-[0.24px] transition-all border-l-2 text-left',
                    isActive
                      ? 'border-l-primary bg-primary/10 text-primary'
                      : 'border-l-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </aside>

          {/* Right Content */}
          <main className="flex-1 p-6 overflow-auto">
            {activeTab === 'script' && (
              <ScriptSettingsForm
                scriptTimeout={scriptTimeout}
                stepInterval={stepInterval}
                maxRetries={maxRetries}
                onChange={handleScriptChange}
              />
            )}
            {activeTab === 'ai' && (
              <AiSettingsForm
                config={{
                  apiKey: aiApiKey,
                  baseUrl: aiBaseUrl,
                  chatModel: aiChatModel,
                  visionModel: aiVisionModel,
                  temperature: aiTemperature,
                  maxTokens: aiMaxTokens,
                  timeout: aiTimeout,
                  maxWidth: aiMaxWidth,
                  quality: aiQuality,
                }}
                onChange={handleAiChange}
              />
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 border-t border-border flex items-center justify-end gap-3 px-4 py-[17px]">
          <button
            onClick={() => onOpenChange(false)}
            className="px-[25px] py-[9px] text-xs font-medium text-muted-foreground tracking-[0.24px] border border-border rounded-md hover:bg-accent transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-[9px] text-xs font-bold text-primary-foreground tracking-[0.24px] bg-primary rounded-md shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
