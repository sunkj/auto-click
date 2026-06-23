import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

/**
 * AI 助手浮动组件
 *
 * 显示在投屏区域右下角的浮动按钮，点击后展开输入面板。
 */
export function AiFloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!input.trim() || status === 'running') return

    const api = window.electronAPI?.aiAgent
    if (api) {
      setStatus('running')
      setStatusMsg('正在理解指令...')

      const unsubStatus = api.onStatus((event) => {
        setStatusMsg(event.message)
      })
      const unsubResult = api.onResult(() => {
        unsubStatus()
        unsubResult()
        setStatus('success')
        setStatusMsg('执行完成')
        setInput('')
        setTimeout(() => setStatus('idle'), 2000)
      })
      const unsubError = api.onError((error) => {
        unsubStatus()
        unsubError()
        setStatus('error')
        setStatusMsg(error.message || '执行失败')
        setTimeout(() => setStatus('idle'), 3000)
      })

      try {
        await api.submit(input)
      } catch {
        unsubStatus()
        unsubResult()
        unsubError()
        setStatus('error')
        setStatusMsg('提交失败')
        setTimeout(() => setStatus('idle'), 2000)
      }
    } else {
      setStatus('running')
      setStatusMsg('正在理解指令...')
      await new Promise((r) => setTimeout(r, 2000))
      setStatus('success')
      setStatusMsg('执行完成')
      setInput('')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const isRunning = status === 'running'

  return (
    <>
      {/* 浮动按钮（带彩色环绕动画） */}
      <div className="absolute bottom-[62px] right-3 z-20">
        {/* 彩色旋转光环 */}
        <div
          className={cn(
            'absolute -inset-[3px] rounded-full animate-spin-slow',
            'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,oklch(0.6_0.2_250)_270deg,oklch(0.6_0.25_190)_300deg,oklch(0.65_0.3_140)_330deg,oklch(0.7_0.25_50)_360deg)]',
            'before:absolute before:inset-[2px] before:rounded-full before:bg-background'
          )}
          style={{ animationDuration: '2.5s' }}
        />
        {/* 第二层反向旋转光环（更淡） */}
        <div
          className={cn(
            'absolute -inset-[1px] rounded-full animate-spin-slow',
            'bg-[conic-gradient(from_180deg,transparent_0deg,transparent_200deg,oklch(0.65_0.2_330)_200deg,oklch(0.6_0.2_10)_250deg,transparent_300deg)] opacity-60'
          )}
          style={{ animationDuration: '3.5s', animationDirection: 'reverse' }}
        />
        {/* 按钮主体 */}
        <button
          onClick={() => { setOpen(!open); if (!open) setStatus('idle') }}
          className={cn(
            'relative z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-lg border transition-all duration-200',
            open
              ? 'bg-primary text-primary-foreground border-primary scale-110'
              : 'bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 border-border'
          )}
          title="AI 智能操控"
        >
          <Sparkles className={cn(
            'h-4 w-4 transition-all duration-300',
            open ? 'text-primary-foreground' : 'text-muted-foreground'
          )} />
        </button>
      </div>

      {/* 滑出面板 */}
      <div
        className={cn(
          'absolute bottom-14 right-14 z-20 w-[380px] overflow-hidden rounded-lg border bg-background shadow-xl transition-all duration-200',
          open ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        )}
      >
        <div className="p-3 space-y-2">
          {/* 输入行 */}
          <div className="flex items-center gap-2">
            <textarea
              ref={inputRef as any}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入指令，如：点击微信"
              disabled={isRunning}
              rows={2}
              className={cn(
                'flex-1 min-h-[52px] resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none ring-offset-background',
                'placeholder:text-muted-foreground/50',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isRunning && 'opacity-50'
              )}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isRunning}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors mt-0.5',
                isRunning
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* 状态提示 */}
          {status !== 'idle' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              {isRunning && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              {status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
              <span className={cn(
                'text-muted-foreground',
                status === 'success' && 'text-green-500',
                status === 'error' && 'text-red-500'
              )}>
                {statusMsg}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
