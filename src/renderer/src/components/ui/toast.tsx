import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, X } from 'lucide-react'

// =============================================================================
// Toast 类型
// =============================================================================

export type ToastType = 'success' | 'error'

export interface ToastData {
  id: number
  type: ToastType
  message: string
}

// =============================================================================
// 全局 toast 事件管理（轻量，不依赖 Context）
// =============================================================================

type Listener = (toast: ToastData) => void

let toastId = 0
const listeners = new Set<Listener>()

export function showToast(type: ToastType, message: string) {
  const toast: ToastData = { id: ++toastId, type, message }
  listeners.forEach((fn) => fn(toast))
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// =============================================================================
// Toast 组件 — 浮动在右上角
// =============================================================================

interface ToastItemProps {
  toast: ToastData
  onDone: (id: number) => void
}

function ToastItem({ toast, onDone }: ToastItemProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setVisible(true))
    // 2.5 秒后退场
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDone(toast.id), 300)
    }, 2500)
    return () => clearTimeout(timer)
  }, [toast.id, onDone])

  const isSuccess = toast.type === 'success'

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border transition-all duration-300 pointer-events-auto',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      )}
    >
      {isSuccess ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
      )}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDone(toast.id), 300) }}
        className="ml-2 p-0.5 rounded hover:bg-black/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// =============================================================================
// Toast 容器 — 放在 App 顶层
// =============================================================================

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast])
    })
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={removeToast} />
      ))}
    </div>
  )
}
