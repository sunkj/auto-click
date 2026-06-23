import { useState, useRef, useEffect, useCallback } from 'react'
import { useAiAgentStore, WORKFLOW_NODES, WorkflowStatus } from '@/stores/aiAgentStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Brain,
  Eye,
  Crosshair,
  Cpu,
  Play,
  History,
  Lightbulb,
  Command,
} from 'lucide-react'

// =============================================================================
// 快捷指令列表
// =============================================================================

const QUICK_COMMANDS = [
  '点击微信',
  '滑动到下一屏',
  '长按支付宝',
  '返回桌面',
  '打开设置',
]

// =============================================================================
// 节点图标映射
// =============================================================================

const NODE_ICONS: Record<string, React.ReactNode> = {
  intent_parser: <Brain className="h-3.5 w-3.5" />,
  screenshot: <Eye className="h-3.5 w-3.5" />,
  visual_analysis: <Crosshair className="h-3.5 w-3.5" />,
  coordinate_mapper: <Crosshair className="h-3.5 w-3.5" />,
  step_converter: <Cpu className="h-3.5 w-3.5" />,
  script_engine_executor: <Play className="h-3.5 w-3.5" />,
}

// =============================================================================
// 子组件：执行状态动画
// =============================================================================

function RunningAnimation() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

// =============================================================================
// 子组件：工作流进度指示器
// =============================================================================

function WorkflowProgress({ currentNode, status }: { currentNode: string | null; status: WorkflowStatus }) {
  const nodeOrder = ['intent_parser', 'screenshot', 'visual_analysis', 'coordinate_mapper', 'step_converter', 'script_engine_executor']

  if (status === 'idle') return null

  const currentIdx = currentNode ? nodeOrder.indexOf(currentNode) : -1

  return (
    <div className="space-y-1.5 px-1">
      {nodeOrder.map((nodeId, idx) => {
        const node = WORKFLOW_NODES[nodeId]
        const isCompleted = status === 'completed' || (currentIdx > idx)
        const isCurrent = nodeId === currentNode
        const isError = status === 'failed' && isCurrent

        return (
          <div key={nodeId} className="flex items-center gap-2.5">
            {/* 状态图标 */}
            <div className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300',
              isCompleted && 'bg-green-500/20 text-green-500',
              isCurrent && 'bg-blue-500/20 text-blue-500',
              isError && 'bg-red-500/20 text-red-500',
              !isCompleted && !isCurrent && !isError && 'bg-muted text-muted-foreground/40'
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : isCurrent ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isError ? (
                <XCircle className="h-3 w-3" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </div>

            {/* 节点名称 */}
            <span className={cn(
              'text-xs transition-colors duration-300',
              isCompleted && 'text-green-500',
              isCurrent && 'text-blue-500 font-medium',
              isError && 'text-red-500',
              !isCompleted && !isCurrent && !isError && 'text-muted-foreground/40'
            )}>
              {node.label}
            </span>

            {/* 描述文字 */}
            {isCurrent && (
              <span className="text-[10px] text-muted-foreground truncate ml-auto">
                {node.description}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// 子组件：结果展示
// =============================================================================

function ResultDisplay({ result }: { result: AiAgentScriptEngineResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-2">
      {/* 结果摘要 */}
      <div className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        result.success
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      )}>
        {result.success ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-medium',
            result.success ? 'text-green-500' : 'text-red-500'
          )}>
            {result.success ? '执行成功' : '执行失败'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            步骤 {result.completedSteps}/{result.totalSteps} · 耗时 {result.duration}ms
            {result.error && ` · ${result.error}`}
          </p>
        </div>
        {result.stepResults.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* 展开详情 */}
      {expanded && result.stepResults.length > 0 && (
        <div className="space-y-1 pl-6">
          {result.stepResults.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[10px]">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                step.success ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="text-muted-foreground">步骤 {step.index + 1}</span>
              <span className={step.success ? 'text-green-500' : 'text-red-500'}>
                {step.success ? `${step.duration}ms` : step.error || '失败'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 子组件：错误展示
// =============================================================================

function ErrorDisplay({ error }: { error: AiAgentError }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-red-500">
          {error.code === 'DEVICE_NOT_FOUND' && '设备未连接'}
          {error.code === 'SCREENSHOT_FAILED' && '截图失败'}
          {error.code === 'LLM_CALL_FAILED' && 'AI 理解失败'}
          {error.code === 'VLM_CALL_FAILED' && '视觉分析失败'}
          {error.code === 'COORDINATE_INVALID' && '未识别到目标'}
          {error.code === 'STEP_CONVERSION_FAILED' && '步骤转换失败'}
          {error.code === 'ENGINE_EXECUTION_FAILED' && '执行失败'}
          {error.code === 'TIMEOUT' && '执行超时'}
          {!['DEVICE_NOT_FOUND', 'SCREENSHOT_FAILED', 'LLM_CALL_FAILED', 'VLM_CALL_FAILED', 'COORDINATE_INVALID', 'STEP_CONVERSION_FAILED', 'ENGINE_EXECUTION_FAILED', 'TIMEOUT'].includes(error.code) && '未知错误'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{error.message}</p>
        {error.retryable && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">请重试或检查网络连接</p>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// 子组件：历史记录项
// =============================================================================

function HistoryItem({ entry }: { entry: AiAgentHistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const time = new Date(entry.timestamp)
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

  const isSuccess = entry.result?.success
  const isError = !!entry.error

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/50 transition-colors"
      >
        {/* 状态图标 */}
        <div className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center',
          isSuccess && 'text-green-500',
          isError && 'text-red-500',
          !isSuccess && !isError && 'text-muted-foreground'
        )}>
          {isSuccess ? <CheckCircle2 className="h-3.5 w-3.5" /> : isError ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        </div>

        {/* 指令文本 */}
        <span className="flex-1 truncate text-xs text-foreground/80">
          {entry.userInput}
        </span>

        {/* 时间 */}
        <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeStr}</span>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="ml-6 pb-1.5 space-y-1">
          {entry.intent && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">动作:</span>
              <span className="capitalize">{entry.intent.action}</span>
              <span className="text-muted-foreground/60">目标:</span>
              <span className="truncate">{entry.intent.target}</span>
            </div>
          )}
          {entry.result && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">结果:</span>
              <span className={entry.result.success ? 'text-green-500' : 'text-red-500'}>
                {entry.result.success ? `成功 (${entry.result.duration}ms)` : entry.result.error}
              </span>
            </div>
          )}
          {entry.error && (
            <p className="text-[10px] text-red-500">{entry.error.message}</p>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 主组件：AI 智能操控面板
// =============================================================================

export function AiAgentPanel() {
  const {
    workflowStatus,
    currentNode,
    statusMessage,
    inputText,
    lastResult,
    lastError,
    history,
    setInputText,
    submit,
    cancel,
    clearHistory,
  } = useAiAgentStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const [showQuickCommands, setShowQuickCommands] = useState(false)
  const isRunning = workflowStatus === 'running'

  // 提交处理
  const handleSubmit = useCallback(() => {
    if (isRunning) return
    submit()
  }, [isRunning, submit])

  // 快捷键：Enter 提交
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // 自动聚焦输入框
  useEffect(() => {
    if (!isRunning && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isRunning])

  return (
    <aside className="flex w-[300px] min-w-[300px] flex-col border-l bg-background">
      {/* 面板标题 */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium">AI 智能操控</span>
        </div>
        {!isRunning && history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={clearHistory}
            title="清空历史"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 输入区域 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入指令，如：点击微信"
            disabled={isRunning}
            className={cn(
              'h-9 pr-16 text-xs',
              isRunning && 'opacity-50'
            )}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {/* 快捷指令按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowQuickCommands(!showQuickCommands)}
              title="快捷指令"
            >
              <Command className="h-3 w-3" />
            </Button>
            {/* 发送/取消按钮 */}
            {isRunning ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={cancel}
                title="取消执行"
              >
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                onClick={handleSubmit}
                disabled={!inputText.trim()}
                title="发送指令"
              >
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* 快捷指令下拉 */}
        {showQuickCommands && !isRunning && (
          <div className="mt-1.5 rounded-md border bg-popover p-1 shadow-md">
            <p className="px-2 py-1 text-[10px] text-muted-foreground/60">快捷指令</p>
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground/80 hover:bg-accent transition-colors"
                onClick={() => {
                  setInputText(cmd)
                  setShowQuickCommands(false)
                  setTimeout(() => inputRef.current?.focus(), 100)
                }}
              >
                <Lightbulb className="h-3 w-3 text-muted-foreground" />
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* 主内容区域 */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {/* 工作流进度 */}
          {workflowStatus !== 'idle' && (
            <div className={cn(
              'rounded-lg border p-3 space-y-3',
              workflowStatus === 'running' && 'border-blue-500/20 bg-blue-500/5',
              workflowStatus === 'completed' && 'border-green-500/20 bg-green-500/5',
              workflowStatus === 'failed' && 'border-red-500/20 bg-red-500/5',
            )}>
              {/* 状态头 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {workflowStatus === 'running' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                  {workflowStatus === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  {workflowStatus === 'failed' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  <span className={cn(
                    'text-xs font-medium',
                    workflowStatus === 'running' && 'text-blue-500',
                    workflowStatus === 'completed' && 'text-green-500',
                    workflowStatus === 'failed' && 'text-red-500',
                  )}>
                    {workflowStatus === 'running' && '执行中'}
                    {workflowStatus === 'completed' && '执行完成'}
                    {workflowStatus === 'failed' && '执行失败'}
                  </span>
                </div>
                {workflowStatus === 'running' && <RunningAnimation />}
              </div>

              {/* 进度详情 */}
              {workflowStatus === 'running' && (
                <WorkflowProgress currentNode={currentNode} status={workflowStatus} />
              )}
              {workflowStatus === 'running' && currentNode && (
                <p className="text-[10px] text-muted-foreground/60">
                  {WORKFLOW_NODES[currentNode]?.description || statusMessage}
                </p>
              )}
            </div>
          )}

          {/* 空状态 */}
          {workflowStatus === 'idle' && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-xs text-muted-foreground/60 mb-1">AI 智能操控</p>
              <p className="text-[10px] text-muted-foreground/40 max-w-[200px]">
                输入自然语言指令，自动控制手机操作
              </p>
            </div>
          )}

          {/* 结果展示 */}
          {lastResult && workflowStatus === 'completed' && (
            <ResultDisplay result={lastResult} />
          )}

          {/* 错误展示 */}
          {lastError && workflowStatus === 'failed' && (
            <ErrorDisplay error={lastError} />
          )}

          {/* 历史记录 */}
          {history.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-1">
                <History className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground/60 font-medium">历史记录</span>
              </div>
              <div className="space-y-0.5">
                {history.map((entry, idx) => (
                  <HistoryItem key={entry.timestamp + '-' + idx} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部状态栏 */}
      <div className="flex h-6 items-center border-t px-3">
        <span className="text-[10px] text-muted-foreground/40">
          {isRunning ? 'AI 引擎运行中...' : '就绪'}
        </span>
      </div>
    </aside>
  )
}
