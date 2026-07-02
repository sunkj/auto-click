import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileBreadcrumb } from '@/components/FileBreadcrumb'
import { FileEntryItem, BackEntry } from '@/components/FileEntryItem'
import {
  useFileTransferStore,
} from '@/stores/fileTransferStore'
import {
  Upload,
  Download,
  FolderOpen,
  Folder,
  Loader2,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Image,
  Film,
  FileText,
  ArrowDownToLine,
  Music,
} from 'lucide-react'

export function FileTransferPanel() {
  const store = useFileTransferStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // 首次挂载时导航到手机内部存储 /sdcard
  useEffect(() => {
    store.navigateTo('/sdcard').finally(() => setInitialLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNavigate = (path: string) => {
    store.navigateTo(path)
  }

  const handleBreadcrumbNavigate = (index: number) => {
    store.navigateToBreadcrumb(index)
  }

  const handleSelect = (entry: typeof store.entries[0] | null) => {
    store.selectFile(entry)
  }

  // 滚动到顶部当路径变化时
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [store.currentPath])

  // ---- 设备未连接提示 ----
  const deviceConnected = false // TODO: 后续接入 deviceStore

  // ---- 渲染 ----

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* 面包屑导航 */}
      <FileBreadcrumb
        breadcrumbs={store.breadcrumbs}
        currentPath={store.currentPath}
        onNavigate={handleBreadcrumbNavigate}
      />

      {/* 文件列表区域 */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0 overflow-x-hidden">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">加载中...</span>
          </div>
        ) : store.error ? (
          /* 错误状态 */
          <div className="flex flex-col items-center justify-center h-80 gap-2 px-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-xs text-muted-foreground text-center">{store.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.refresh()}
              className="mt-1"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              重试
            </Button>
          </div>
        ) : store.currentPath === '/' && !store.error ? (
          /* 根目录 - 显示快速入口 */
          <div className="py-0.5">
            <div className="px-3 py-2 text-[11px] text-muted-foreground/60 font-medium">
              快速入口
            </div>
            <button
              onClick={() => store.navigateTo('/sdcard')}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/50"
            >
              <Smartphone className="h-4 w-4 shrink-0 text-sky-500" />
              <span className="flex-1 font-medium">内部存储</span>
              <span className="shrink-0 text-muted-foreground/60">/sdcard</span>
            </button>
            {/* 其他系统目录 */}
            {store.entries
              .filter((e) => e.isDirectory && e.name !== 'sdcard')
              .map((entry) => (
                <FileEntryItem
                  key={entry.path}
                  entry={entry}
                  selected={false}
                  onSelect={handleSelect}
                  onNavigate={handleNavigate}
                  getThumbnail={store.getThumbnail}
                />
              ))}
          </div>
        ) : store.currentPath === '/sdcard' && !store.error ? (
          /* /sdcard 目录 - 分类快捷入口 */
          <div className="py-3 px-3 space-y-2">
            <p className="text-[11px] text-muted-foreground/60 font-medium px-1">
              常用目录
            </p>
            <QuickAccessCard
              icon={<Image className="h-5 w-5" />}
              label="图片"
              description="DCIM · Pictures · 截图"
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
              onClick={() => store.navigateTo('/sdcard/DCIM')}
            />
            <QuickAccessCard
              icon={<Film className="h-5 w-5" />}
              label="视频"
              description="Movies · 录屏"
              color="text-purple-500"
              bgColor="bg-purple-500/10"
              onClick={() => store.navigateTo('/sdcard/Movies')}
            />
            <QuickAccessCard
              icon={<FileText className="h-5 w-5" />}
              label="文档"
              description="Documents · PDF · 办公文件"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
              onClick={() => store.navigateTo('/sdcard/Documents')}
            />
            <QuickAccessCard
              icon={<ArrowDownToLine className="h-5 w-5" />}
              label="下载"
              description="Download · 已下载的文件"
              color="text-amber-500"
              bgColor="bg-amber-500/10"
              onClick={() => store.navigateTo('/sdcard/Download')}
            />
            <QuickAccessCard
              icon={<Music className="h-5 w-5" />}
              label="音乐"
              description="Music · 音频文件"
              color="text-rose-500"
              bgColor="bg-rose-500/10"
              onClick={() => store.navigateTo('/sdcard/Music')}
            />

            {/* 分隔线 */}
            <div className="pt-3">
              <p className="text-[11px] text-muted-foreground/60 font-medium px-1 pb-1">
                其他目录
              </p>
              {store.entries
                .filter((e) => e.isDirectory && ![
                  'DCIM', 'Pictures', 'Download', 'Documents',
                  'Movies', 'Music', 'Podcasts', 'Audiobooks',
                  'Recordings', 'Screenshots', 'ScreenRecorder',
                ].includes(e.name))
                .map((entry) => (
                  <FileEntryItem
                    key={entry.path}
                    entry={entry}
                    selected={false}
                    onSelect={handleSelect}
                    onNavigate={handleNavigate}
                    getThumbnail={store.getThumbnail}
                  />
                ))}
            </div>
          </div>
        ) : store.entries.length === 0 ? (
          /* 空目录 */
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <FolderOpen className="h-8 w-8" />
            <span className="text-xs">该目录为空</span>
          </div>
        ) : (
          /* 文件列表 */
          <div className="py-0.5">
            {/* 返回上级（根目录 / 不显示） */}
            {store.currentPath !== '/' && (
              <BackEntry onNavigate={() => store.navigateUp()} />
            )}

            {/* 目录项 */}
            {store.entries
              .filter((e) => e.isDirectory)
              .map((entry) => (
                <FileEntryItem
                  key={entry.path}
                  entry={entry}
                  selected={false}
                  onSelect={handleSelect}
                  onNavigate={handleNavigate}
                  getThumbnail={store.getThumbnail}
                />
              ))}

            {/* 分隔线（如果同时有目录和文件） */}
            {store.entries.some((e) => e.isDirectory) &&
              store.entries.some((e) => !e.isDirectory) && (
                <div className="mx-3 my-1 border-t border-border/40" />
              )}

            {/* 文件项 */}
            {store.entries
              .filter((e) => !e.isDirectory)
              .map((entry) => (
                <FileEntryItem
                  key={entry.path}
                  entry={entry}
                  selected={store.selectedFile?.path === entry.path}
                  onSelect={handleSelect}
                  onNavigate={handleNavigate}
                  getThumbnail={store.getThumbnail}
                />
              ))}
          </div>
        )}
      </ScrollArea>

      {/* 底部操作栏 */}
      <div className="shrink-0 border-t p-3 space-y-2">
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => store.uploadFile()}
            disabled={store.uploading}
          >
            {store.uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            上传文件
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => store.downloadFile()}
            disabled={!store.selectedFile || store.downloading}
          >
            {store.downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            下载选中
          </Button>
        </div>

        {/* 状态信息 */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
          <span className="truncate">
            {store.currentPath}
          </span>
          <span className="shrink-0 tabular-nums ml-2">
            {store.entries.length} 项
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// 快捷入口卡片组件
// =============================================================================

interface QuickAccessCardProps {
  icon: React.ReactNode
  label: string
  description: string
  color: string
  bgColor: string
  onClick: () => void
}

function QuickAccessCard({ icon, label, description, color, bgColor, onClick }: QuickAccessCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor} ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground/60 truncate">{description}</div>
      </div>
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </button>
  )
}
