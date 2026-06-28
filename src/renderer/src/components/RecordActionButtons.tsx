import { cn } from '@/lib/utils'
import { CircleDot, List } from 'lucide-react'

interface RecordActionButtonsProps {
  isRecording: boolean
  onToggleRecording: () => void
  onOpenList: () => void
}

/**
 * 录制操作按钮组
 *
 * 浮动在投屏区域右上角的两个竖向排列按钮：
 * - 录制按钮：激活时红色脉冲动画
 * - 查看按钮：打开录制模板列表
 */
export function RecordActionButtons({
  isRecording,
  onToggleRecording,
  onOpenList,
}: RecordActionButtonsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={onToggleRecording}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full shadow-md border transition-all duration-150',
          isRecording
            ? 'text-red-500 bg-red-500/10 border-red-500/30 animate-pulse'
            : 'bg-background/90 text-muted-foreground hover:text-foreground hover:bg-background border-border'
        )}
        title={isRecording ? '退出录制' : '录制点击'}
      >
        <CircleDot className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onOpenList}
        className="flex h-7 w-7 items-center justify-center rounded-full shadow-md border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-background border-border transition-all duration-150"
        title="查看录制的点击事件"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
