import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Play, Key, Wifi, Eye, Brain } from 'lucide-react'

// =============================================================================
// Tab 定义
// =============================================================================

type TabId = 'script' | 'llm' | 'vlm'

interface TabItem {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabItem[] = [
  { id: 'script', label: '脚本执行', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'llm', label: '意图解析模型', icon: <Brain className="h-3.5 w-3.5" /> },
  { id: 'vlm', label: '视觉分析模型', icon: <Eye className="h-3.5 w-3.5" /> },
]

// =============================================================================
// Props
// =============================================================================

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// =============================================================================
// 组件：LLM 设置表单（意图解析模型 — 通用 OpenAI 兼容 API）
// =============================================================================

function LLMSettingsForm({ config, onChange }: {
  config: {
    apiKey: string
    baseUrl: string
    model: string
    temperature: string
    maxTokens: string
    timeout: string
  }
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">意图解析模型（LLM）</div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Key className="h-3 w-3 text-muted-foreground" />
          API 密钥
        </label>
        <Input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange('apiKey', e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          className="h-10 text-sm font-mono bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Wifi className="h-3 w-3 text-muted-foreground" />
          API 地址
        </label>
        <Input
          value={config.baseUrl}
          onChange={(e) => onChange('baseUrl', e.target.value)}
          placeholder="https://api.deepseek.com"
          className="h-10 text-sm bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      <div className="flex flex-col gap-[8px] items-start max-w-[200px]">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">模型名</label>
        <Input
          value={config.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="deepseek-chat"
          className="h-10 text-sm bg-background border-input text-foreground"
        />
      </div>

      <div className="mt-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">请求参数</div>
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
    </div>
  )
}

// =============================================================================
// 组件：VLM 设置表单（视觉分析模型 — 通用多模态 API）
// =============================================================================

function VLMSettingsForm({ config, onChange }: {
  config: {
    apiKey: string
    baseUrl: string
    model: string
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
      <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">视觉分析模型（VLM）</div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Key className="h-3 w-3 text-muted-foreground" />
          API 密钥
        </label>
        <Input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange('apiKey', e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          className="h-10 text-sm font-mono bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground tracking-[0.24px]">
          <Wifi className="h-3 w-3 text-muted-foreground" />
          API 地址
        </label>
        <Input
          value={config.baseUrl}
          onChange={(e) => onChange('baseUrl', e.target.value)}
          placeholder="https://open.bigmodel.cn/api/paas/v4"
          className="h-10 text-sm bg-background border-input text-foreground w-full max-w-[320px]"
        />
      </div>

      <div className="flex flex-col gap-[8px] items-start max-w-[200px]">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">模型名</label>
        <Input
          value={config.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="glm-4v"
          className="h-10 text-sm bg-background border-input text-foreground"
        />
      </div>

      <div className="mt-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">请求参数</div>
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

      {/* 截图参数（VLM 专用） */}
      <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mt-2">截图</div>
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

function ScriptSettingsForm({ scriptTimeout, stepInterval, maxRetries, appScanPages, onChange }: {
  scriptTimeout: string
  stepInterval: string
  maxRetries: string
  appScanPages: string
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

      <div className="flex flex-col gap-[8px] items-start w-full">
        <label className="text-xs font-medium text-foreground tracking-[0.24px]">
          App 桌面扫描页数
        </label>
        <Input
          type="number"
          min="1"
          max="10"
          value={appScanPages}
          onChange={(e) => onChange('appScanPages', e.target.value)}
          className="h-10 text-sm bg-background border-input text-foreground font-mono w-[128px]"
        />
        <p className="text-xs text-muted-foreground/70 leading-5">
          打开 App 时扫描桌面的页数（先左滑 N 次，再右滑 N 次）
        </p>
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
  const [appScanPages, setAppScanPages] = useState('3')

  // LLM 设置（意图解析模型）
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.deepseek.com')
  const [llmModel, setLlmModel] = useState('deepseek-chat')
  const [llmTemperature, setLlmTemperature] = useState('0.1')
  const [llmMaxTokens, setLlmMaxTokens] = useState('4096')
  const [llmTimeout, setLlmTimeout] = useState('30000')

  // VLM 设置（视觉分析模型）
  const [vlmApiKey, setVlmApiKey] = useState('')
  const [vlmBaseUrl, setVlmBaseUrl] = useState('https://open.bigmodel.cn/api/paas/v4')
  const [vlmModel, setVlmModel] = useState('glm-4v')
  const [vlmTemperature, setVlmTemperature] = useState('0.1')
  const [vlmMaxTokens, setVlmMaxTokens] = useState('2048')
  const [vlmTimeout, setVlmTimeout] = useState('30000')

  // VLM 截图参数
  const [vlmMaxWidth, setVlmMaxWidth] = useState('1024')
  const [vlmQuality, setVlmQuality] = useState('80')

  // 打开时加载配置
  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.electronAPI?.config?.load().then((cfg: any) => {
      if (!cfg) return
      setScriptTimeout(String(cfg.scriptTimeout ?? 1800))
      setStepInterval(String(cfg.stepInterval ?? 0.5))
      setMaxRetries(String(cfg.maxRetries ?? 3))

      const wf = cfg.aiAgent?.workflow || {}
      setAppScanPages(String(wf.appScanPages ?? 3))

      const ai = cfg.aiAgent || {}
      const llm = ai.llm || {}
      setLlmApiKey(llm.apiKey ?? '')
      setLlmBaseUrl(llm.baseUrl ?? 'https://api.deepseek.com')
      setLlmModel(llm.model ?? 'deepseek-chat')
      setLlmTemperature(String(llm.temperature ?? 0.1))
      setLlmMaxTokens(String(llm.maxTokens ?? 4096))
      setLlmTimeout(String(llm.timeout ?? 30000))

      const vlm = ai.vlm || {}
      setVlmApiKey(vlm.apiKey ?? '')
      setVlmBaseUrl(vlm.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4')
      setVlmModel(vlm.model ?? 'glm-4v')
      setVlmTemperature(String(vlm.temperature ?? 0.1))
      setVlmMaxTokens(String(vlm.maxTokens ?? 2048))
      setVlmTimeout(String(vlm.timeout ?? 30000))

      const sc = vlm.screenshot || {}
      setVlmMaxWidth(String(sc.maxWidth ?? 1024))
      setVlmQuality(String(sc.quality ?? 80))
    }).finally(() => setLoading(false))
  }, [open])

  const handleScriptChange = (key: string, value: string) => {
    switch (key) {
      case 'scriptTimeout': setScriptTimeout(value); break
      case 'stepInterval': setStepInterval(value); break
      case 'maxRetries': setMaxRetries(value); break
      case 'appScanPages': setAppScanPages(value); break
    }
  }

  const handleLLMChange = (key: string, value: string) => {
    switch (key) {
      case 'apiKey': setLlmApiKey(value); break
      case 'baseUrl': setLlmBaseUrl(value); break
      case 'model': setLlmModel(value); break
      case 'temperature': setLlmTemperature(value); break
      case 'maxTokens': setLlmMaxTokens(value); break
      case 'timeout': setLlmTimeout(value); break
    }
  }

  const handleVLMChange = (key: string, value: string) => {
    switch (key) {
      case 'apiKey': setVlmApiKey(value); break
      case 'baseUrl': setVlmBaseUrl(value); break
      case 'model': setVlmModel(value); break
      case 'temperature': setVlmTemperature(value); break
      case 'maxTokens': setVlmMaxTokens(value); break
      case 'timeout': setVlmTimeout(value); break
      case 'maxWidth': setVlmMaxWidth(value); break
      case 'quality': setVlmQuality(value); break
    }
  }

  const handleSave = async () => {
    await window.electronAPI?.config?.save({
      scriptTimeout: Number(scriptTimeout) || 1800,
      stepInterval: Number(stepInterval) || 0.5,
      maxRetries: Number(maxRetries) || 3,
      aiAgent: {
        llm: {
          apiKey: llmApiKey,
          baseUrl: llmBaseUrl,
          model: llmModel,
          temperature: Number(llmTemperature) || 0.1,
          maxTokens: Number(llmMaxTokens) || 4096,
          timeout: Number(llmTimeout) || 30000,
        },
        vlm: {
          apiKey: vlmApiKey,
          baseUrl: vlmBaseUrl,
          model: vlmModel,
          temperature: Number(vlmTemperature) || 0.1,
          maxTokens: Number(vlmMaxTokens) || 2048,
          timeout: Number(vlmTimeout) || 30000,
          screenshot: {
            maxWidth: Number(vlmMaxWidth) || 1024,
            quality: Number(vlmQuality) || 80,
          },
        },
        workflow: {
          nodeTimeout: 60000,
          maxRetries: 2,
          retryDelay: 1000,
          defaultDuration: 300,
          longPressDuration: 1500,
          appScanPages: Number(appScanPages) || 3,
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
                    'flex items-center gap-3 w-full pl-[18px] pr-4 py-2 text-xs font-medium tracking-[0.24px] transition-all duration-150 border-l-2 text-left active:scale-[0.99]',
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
                appScanPages={appScanPages}
                onChange={handleScriptChange}
              />
            )}
            {activeTab === 'llm' && (
              <LLMSettingsForm
                config={{
                  apiKey: llmApiKey,
                  baseUrl: llmBaseUrl,
                  model: llmModel,
                  temperature: llmTemperature,
                  maxTokens: llmMaxTokens,
                  timeout: llmTimeout,
                }}
                onChange={handleLLMChange}
              />
            )}
            {activeTab === 'vlm' && (
              <VLMSettingsForm
                config={{
                  apiKey: vlmApiKey,
                  baseUrl: vlmBaseUrl,
                  model: vlmModel,
                  temperature: vlmTemperature,
                  maxTokens: vlmMaxTokens,
                  timeout: vlmTimeout,
                  maxWidth: vlmMaxWidth,
                  quality: vlmQuality,
                }}
                onChange={handleVLMChange}
              />
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 border-t border-border flex items-center justify-end gap-3 px-4 py-[17px]">
          <button
            onClick={() => onOpenChange(false)}
            className="px-[25px] py-[9px] text-xs font-medium text-muted-foreground tracking-[0.24px] border border-border rounded-md hover:bg-accent active:scale-[0.98] transition-all duration-150"
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
