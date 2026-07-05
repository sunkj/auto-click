import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Send, Sparkles, Loader2, Square } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'sending' | 'completed' | 'error'
  statusMsg?: string
  stepInfo?: { desc: string; idx: number; total: number } | null
}

export function AiChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async () => {
    if (!input.trim() || isRunning) return

    const userContent = input.trim()
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    const api = window.electronAPI?.aiAgent
    if (api) {
      setIsRunning(true)

      // 添加 AI 消息占位
      const aiMsgId = (Date.now() + 1).toString()
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'sending',
      }
      setMessages((prev) => [...prev, aiMsg])

      const unsubStatus = api.onStatus((event: any) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  statusMsg: event.message,
                  stepInfo:
                    event.stepIndex !== undefined
                      ? { desc: event.message, idx: event.stepIndex, total: event.totalSteps || 0 }
                      : m.stepInfo,
                }
              : m
          )
        )
      })

      const unsubResult = api.onResult((result: any) => {
        unsubStatus()
        unsubResult()
        setIsRunning(false)

        // 格式化步骤列表
        const steps = result?.engineSteps || []
        const results = result?.stepResults || []
        let msg = ''
        if (steps.length > 0) {
          const lines = steps.map((s: any, i: number) => {
            const desc = s.data?.description || s.type
            const status = results[i]
            const mark = status?.success ? '✔' : status ? '✘' : '·'
            return `  ${mark} ${desc}`
          })
          msg = `共识别到 ${steps.length} 个任务：\n\n${lines.join('\n')}`
          const failed = results.find((r: any) => r && !r.success)
          if (failed) msg += `\n\n❌ 执行失败: ${failed.error || '未知错误'}`
          else msg += `\n\n✅ 全部执行完成 (${((result?.duration || 0) / 1000).toFixed(1)}s)`
        } else {
          msg = result?.description || result?.error || '执行完成'
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: msg, status: 'completed' }
              : m
          )
        )
      })

      const unsubError = api.onError((error: any) => {
        unsubStatus()
        unsubError()
        setIsRunning(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: error.message || '执行失败', status: 'error' }
              : m
          )
        )
      })

      try {
        await api.submit(userContent)
      } catch {
        unsubStatus()
        unsubResult()
        unsubError()
        setIsRunning(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: '提交失败', status: 'error' }
              : m
          )
        )
      }
    } else {
      // 演示模式
      setIsRunning(true)
      const aiMsgId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          status: 'sending',
          statusMsg: '正在理解指令...',
        },
      ])
      await new Promise((r) => setTimeout(r, 2000))
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: `已收到指令: "${userContent}"\n\n> 演示模式 - 实际功能需要连接设备`,
                status: 'completed',
              }
            : m
        )
      )
      setIsRunning(false)
    }
  }

  const handleStop = async () => {
    const api = window.electronAPI?.aiAgent
    if (api) {
      await api.cancel()
    }
    setIsRunning(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI 智能助手</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                告诉我你想要对设备执行的操作，我来帮你完成
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2.5',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* 头像 */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    msg.role === 'assistant'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent text-accent-foreground'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[11px] font-medium">我</span>
                  )}
                </div>

                {/* 气泡 */}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed',
                    msg.role === 'assistant'
                      ? 'bg-accent/60 text-accent-foreground rounded-tl-sm'
                      : 'bg-primary text-primary-foreground rounded-tr-sm'
                  )}
                >
                  {msg.status === 'sending' && !msg.content ? (
                    <div className="space-y-1.5 min-w-[100px]">
                      {msg.statusMsg && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          <span className="text-foreground/80">{msg.statusMsg}</span>
                        </div>
                      )}
                      {msg.stepInfo && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span>
                            步骤 {msg.stepInfo.idx}/{msg.stepInfo.total}
                          </span>
                        </div>
                      )}
                      {!msg.statusMsg && (
                        <div className="flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                  <div
                    className={cn(
                      'text-[10px] mt-1.5',
                      msg.role === 'assistant' ? 'text-muted-foreground/40' : 'text-primary-foreground/50'
                    )}
                  >
                    {formatTime(msg.timestamp)}
                    {msg.status === 'error' && (
                      <span className="ml-1.5 text-red-400">发送失败</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 停止按钮 - 底部居中 */}
      {isRunning && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 active:scale-95 transition-colors shadow-lg"
            title="停止执行"
          >
            <Square className="h-3.5 w-3.5" />
            <span>停止执行</span>
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="border-t p-4 shrink-0">
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入指令，如：点击微信"
            disabled={isRunning}
            rows={4}
            className="flex-1 min-h-[80px] max-h-[140px] resize-none rounded-md bg-background px-3 py-0 text-md outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <div className="flex items-center">
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isRunning}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                isRunning || !input.trim()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
              )}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
