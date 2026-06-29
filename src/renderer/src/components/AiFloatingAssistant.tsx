import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'
import {
  Sparkles,
  Send,
  Loader2,
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
  const [hasExecuted, setHasExecuted] = useState(false) // 执行过则保持隐藏
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastClickRef = useRef(0) // 双击检测

  // ── 浮动步骤指示 ──
  const [currentStep, setCurrentStep] = useState<{ desc: string; idx: number; total: number } | null>(null)
  const [stepVisible, setStepVisible] = useState(false)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 当状态消息变化时（执行中），提取步骤信息
  const [prevStatusMsg, setPrevStatusMsg] = useState('')

  useEffect(() => {
    if (status !== 'running') {
      // 执行结束，渐出消失
      if (stepVisible) {
        setTimeout(() => {
          setStepVisible(false)
          setTimeout(() => setCurrentStep(null), 300)
        }, 500)
      }
      return
    }

    // 只在 statusMsg 变化时才更新
    if (statusMsg !== prevStatusMsg && statusMsg) {
      setPrevStatusMsg(statusMsg)

      // 跳过通用消息
      if (statusMsg === '正在理解指令...' || statusMsg === '执行完成' || statusMsg === '执行失败') {
        return
      }

      setCurrentStep({ desc: statusMsg, idx: 0, total: 0 })
      setStepVisible(true)

      // 清除之前的定时器
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    }
  }, [status, statusMsg])

  const handleSubmit = async () => {
    if (!input.trim() || status === 'running') return

    const api = window.electronAPI?.aiAgent
    if (api) {
      setStatus('running')
      setHasExecuted(true)
      setStatusMsg('正在理解指令...')

      const unsubStatus = api.onStatus((event: any) => {
        setStatusMsg(event.message)
        // 如果有步骤索引，更新浮动指示
        if (event.stepIndex !== undefined) {
          setCurrentStep({ desc: event.message, idx: event.stepIndex, total: event.totalSteps || 0 })
          setStepVisible(true)
        }
      })
      const unsubResult = api.onResult((result: any) => {
        unsubStatus()
        unsubResult()
        setInput('')
        setOpen(false)
        if (result?.success) {
          showToast('success', 'AI 指令执行完成')
        } else {
          showToast('error', result?.error || 'AI 指令执行失败')
        }
        setTimeout(() => { setStatus('idle'); setHasExecuted(false) }, 500)
      })
      const unsubError = api.onError((error) => {
        unsubStatus()
        unsubError()
        setOpen(false)
        showToast('error', error.message || 'AI 指令执行失败')
        setTimeout(() => { setStatus('idle'); setHasExecuted(false) }, 500)
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

  const closePanel = () => {
    setOpen(false)
    setStatus('idle')
    setHasExecuted(false)
    setCurrentStep(null)
    setStepVisible(false)
  }

  return (
    <>
      {/* 蒙版 - 面板打开且非执行时显示 */}
      {open && !isRunning && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={closePanel}
        />
      )}

      {/* 浮动按钮（带彩色环绕动画） */}
      <div className="absolute bottom-[92px] left-9 z-[55] group">
        {/* hover 提示 */}
        <div className={cn(
          'absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 px-2 py-0.5 rounded-md bg-foreground/10 backdrop-blur-md text-[10px] text-foreground/80 whitespace-nowrap transition-opacity duration-200 pointer-events-none',
          isRunning ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          {isRunning ? '双击停止执行' : 'AI 智能操控'}
        </div>
        {/* 彩色旋转光环 - 仅在执行时显示 */}
        {isRunning && (
          <>
            <div
              className={cn(
                'absolute -inset-[3px] rounded-full animate-spin-slow',
                'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,oklch(0.6_0.2_250)_270deg,oklch(0.6_0.25_190)_300deg,oklch(0.65_0.3_140)_330deg,oklch(0.7_0.25_50)_360deg)]',
                'before:absolute before:inset-[2px] before:rounded-full before:bg-background'
              )}
              style={{ animationDuration: '2.5s' }}
            />
            <div
              className={cn(
                'absolute -inset-[1px] rounded-full animate-spin-slow',
                'bg-[conic-gradient(from_180deg,transparent_0deg,transparent_200deg,oklch(0.65_0.2_330)_200deg,oklch(0.6_0.2_10)_250deg,transparent_300deg)] opacity-60'
              )}
              style={{ animationDuration: '3.5s', animationDirection: 'reverse' }}
            />
          </>
        )}
        {/* 按钮主体 */}
        <button
          onClick={() => {
            if (isRunning) {
              // 执行中：双击停止
              const now = Date.now()
              if (now - lastClickRef.current < 400) {
                lastClickRef.current = 0
                window.electronAPI?.aiAgent?.cancel()
                setOpen(false)
                setStatus('idle')
                setHasExecuted(false)
                setCurrentStep(null)
                setStepVisible(false)
                showToast('success', '已停止执行')
              } else {
                lastClickRef.current = now
              }
              return
            }
            setOpen(!open)
            if (!open) { setStatus('idle'); setHasExecuted(false) }
          }}
          className={cn(
            'relative z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-lg border transition-all duration-200',
            open
              ? 'bg-background text-foreground border-border scale-110'
              : 'bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 border-border'
          )}
        >
          <Sparkles className={cn(
            'h-4 w-4 transition-all duration-300',
            isRunning ? 'text-primary animate-spin' : open ? 'text-foreground' : 'text-muted-foreground'
          )} />
        </button>
      </div>

      {/* 浮动步骤指示 - AI 按钮右上角 */}
      {currentStep && (
        <div
          className={cn(
            'absolute bottom-[132px] left-[72px] z-[56] transition-all duration-300',
            stepVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2 pointer-events-none'
          )}
        >
          <div className="bg-background/85 backdrop-blur-lg border border-border/60 rounded-lg px-4 py-3 shadow-xl max-w-[300px]">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-foreground/90 leading-snug line-clamp-3 flex-1">
                {currentStep.desc}
              </span>
              {currentStep.total > 0 && (
                <span className="text-[11px] text-muted-foreground/60 font-mono shrink-0">
                  {currentStep.idx}/{currentStep.total}
                </span>
              )}
            </div>
          </div>
          {/* 小三角指向 AI 按钮 */}
          <div className="absolute -bottom-[5px] left-[18px] w-2.5 h-2.5 bg-background/85 backdrop-blur-md border-r border-b border-border/60 rotate-45" />
        </div>
      )}

      {/* 滑出面板 */}
      <div
        className={cn(
          'absolute bottom-20 left-20 z-[55] w-[380px] overflow-hidden rounded-lg border bg-background shadow-xl transition-all duration-200',
          open && !isRunning ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        )}
      >
        <div className="p-3 space-y-2">
          {/* 输入行 - 执行中或执行后隐藏 */}
          {!isRunning && !hasExecuted && (
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef as any}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入指令，如：点击微信"
                disabled={isRunning}
                rows={6}
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
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors mt-0.5',
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
          )}
        </div>
      </div>
    </>
  )
}
