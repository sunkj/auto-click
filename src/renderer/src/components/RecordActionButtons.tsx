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
      <div className="relative group">
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 px-2 py-0.5 rounded-md bg-foreground/10 backdrop-blur-md text-[10px] text-foreground/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          {isRecording ? '退出录制' : '录制点击'}
        </div>
        <button
          onClick={onToggleRecording}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full shadow-md border transition-all duration-150',
            isRecording
              ? 'text-red-500 bg-red-500/10 border-red-500/30 animate-pulse'
              : 'bg-background/90 text-muted-foreground hover:text-foreground hover:bg-background border-border'
          )}
        >
          <CircleDot className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative group">
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 px-2 py-0.5 rounded-md bg-foreground/10 backdrop-blur-md text-[10px] text-foreground/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          录制记录
        </div>
        <button
          onClick={onOpenList}
          className="flex h-7 w-7 items-center justify-center rounded-full shadow-md border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-background border-border transition-all duration-150"
        >
          <List className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
