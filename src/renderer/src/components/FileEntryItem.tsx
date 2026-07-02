import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Folder,
  File,
  Image,
  Video,
  Music,
  Package,
  Archive,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { type FileEntry, getFileTypeCategory, formatFileSize } from '@/stores/fileTransferStore'

// =============================================================================
// 图标映射
// =============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  image: Image,
  video: Video,
  audio: Music,
  apk: Package,
  archive: Archive,
  file: File,
}

const ICON_COLOR_MAP: Record<string, string> = {
  folder: 'text-sky-500',
  image: 'text-emerald-500',
  video: 'text-purple-500',
  audio: 'text-rose-500',
  apk: 'text-orange-500',
  archive: 'text-amber-500',
  file: 'text-muted-foreground',
}

/** 支持缩略图的文件类型 */
const THUMBNAIL_CATEGORIES = new Set(['image'])

// =============================================================================
// Props
// =============================================================================

interface FileEntryItemProps {
  entry: FileEntry
  selected: boolean
  onSelect: (entry: FileEntry | null) => void
  onNavigate: (path: string) => void
  getThumbnail?: (path: string) => Promise<string | null>
}

// =============================================================================
// 缩略图组件（带懒加载）
// =============================================================================

function FileThumbnail({ path, getThumbnail }: { path: string; getThumbnail: (path: string) => Promise<string | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadedRef.current) {
          loadedRef.current = true
          observer.disconnect()
          setLoading(true)
          getThumbnail(path).then((url) => {
            setThumbUrl(url)
            setLoading(false)
            if (!url) setFailed(true)
          }).catch(() => {
            setLoading(false)
            setFailed(true)
          })
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [path, getThumbnail])

  // 加载中
  if (loading) {
    return (
      <div ref={ref} className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center bg-muted/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
      </div>
    )
  }

  // 加载成功
  if (thumbUrl) {
    return (
      <div ref={ref} className="h-9 w-9 shrink-0 rounded-md overflow-hidden bg-muted/30">
        <img
          src={thumbUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  // 加载失败 / 未进入视口
  return (
    <div ref={ref} className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center bg-muted/30">
      <Image className="h-4 w-4 text-emerald-500/60" />
    </div>
  )
}

// =============================================================================
// 组件
// =============================================================================

export function FileEntryItem({ entry, selected, onSelect, onNavigate, getThumbnail }: FileEntryItemProps) {
  const category = getFileTypeCategory(entry.name, entry.isDirectory)
  const showThumbnail = getThumbnail && THUMBNAIL_CATEGORIES.has(category) && !entry.isDirectory
  const Icon = ICON_MAP[category] || File
  const iconColor = ICON_COLOR_MAP[category] || 'text-muted-foreground'

  const handleClick = useCallback(() => {
    if (entry.isDirectory) {
      onNavigate(entry.path)
    } else {
      onSelect(selected ? null : entry)
    }
  }, [entry, selected, onSelect, onNavigate])

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full min-w-0 justify-between items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
        'hover:bg-accent/50',
        selected && !entry.isDirectory && 'bg-accent',
        'border-b border-border/30 last:border-b-0'
      )}
    >
        <div className='flex items-center gap-2'>
            {/* 图标 / 缩略图（固定宽度） */}
            {showThumbnail ? (
                <FileThumbnail path={entry.path} getThumbnail={getThumbnail} />
            ) : (
                <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
            )}

            {/* 文件名（溢出省略 + 自动填充） */}
            <span className={cn(
                'flex-1 truncate max-w-[200px]',
                entry.isDirectory ? 'font-medium' : ''
            )}>
                {entry.name}
            </span>
        </div>
      {/* 时间 + 大小（固定，不折行） */}
      <div className="shrink-0 inline-flex items-center gap-1.5 text-muted-foreground/60 tabular-nums whitespace-nowrap">
        {entry.modifiedTime && (
          <span className="hidden sm:inline">{entry.modifiedTime}</span>
        )}
        <span>
          {entry.isDirectory ? '' : formatFileSize(entry.size)}
        </span>
      </div>
    </button>
  )
}

// =============================================================================
// 返回上级目录项
// =============================================================================

interface BackEntryProps {
  onNavigate: () => void
}

export function BackEntry({ onNavigate }: BackEntryProps) {
  return (
    <button
      onClick={onNavigate}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-accent/50 text-muted-foreground"
    >
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      <span className="flex-1 font-medium">..</span>
      <span className="shrink-0 text-muted-foreground/60">上级目录</span>
    </button>
  )
}
