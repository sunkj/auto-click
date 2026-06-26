import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  List,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  CircleX,
} from 'lucide-react'

// =============================================================================
// Mock 数据类型
// =============================================================================

interface RecordedClickItem {
  id: number
  name: string
  x: number
  y: number
  type: string
  createdAt: string
}

// =============================================================================
// Mock 数据
// =============================================================================

const MOCK_ITEMS: RecordedClickItem[] = Array.from({ length: 35 }, (_, i) => ({
  id: i + 1,
  name: [
    '点击微信', '点击支付宝', '点击抖音', '点击设置', '点击浏览器',
    '点击相机', '点击相册', '点击音乐', '点击地图', '点击时钟',
    '点击计算器', '点击日历', '点击邮件', '点击短信', '点击电话',
    '点击微信支付', '点击扫一扫', '点击朋友圈', '点击公众号', '点击小程序',
    '点击美团', '点击淘宝', '点击京东', '点击拼多多', '点击B站',
    '点击微博', '点击知乎', '点击小红书', '点击网易云', '点击QQ',
    '点击钉钉', '点击飞书', '点击企业微信', '点击WPS', '点击百度网盘',
  ][i],
  x: 150 + Math.floor(Math.random() * 700),
  y: 300 + Math.floor(Math.random() * 1800),
  type: 'click',
  createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
}))

const PAGE_SIZE = 10

/**
 * 录制模板列表弹窗
 *
 * 分页展示所有已录制的点击事件，支持行内编辑名称和删除。
 *
 * 当前使用 mock 数据，后续接入 IPC。
 */
export function RecordedClickListDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [items, setItems] = useState<RecordedClickItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 编辑状态
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  // 删除确认
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ===========================================================================
  // 加载数据（Mock）
  // ===========================================================================

  const loadData = useCallback(async (p: number) => {
    setLoading(true)
    setError('')

    try {
      // Mock: 模拟 IPC 分页查询
      await new Promise((r) => setTimeout(r, 500))
      const start = (p - 1) * PAGE_SIZE
      const paged = MOCK_ITEMS.slice(start, start + PAGE_SIZE)
      setItems(paged)
      setTotal(MOCK_ITEMS.length)
    } catch {
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setPage(1)
      setEditingId(null)
      loadData(1)
    }
  }, [open, loadData])

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    setEditingId(null)
    loadData(p)
  }

  // ===========================================================================
  // 编辑操作（Mock）
  // ===========================================================================

  const startEdit = (item: RecordedClickItem) => {
    setEditingId(item.id)
    setEditName(item.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async () => {
    const trimmed = editName.trim()
    if (!trimmed || editingId === null) return

    // Mock: 模拟 IPC 更新
    console.log('[Mock] 更新录制点击:', { id: editingId, name: trimmed })
    await new Promise((r) => setTimeout(r, 200))

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId ? { ...item, name: trimmed } : item
      )
    )
    setEditingId(null)
  }

  // ===========================================================================
  // 删除操作（Mock）
  // ===========================================================================

  const handleDelete = async () => {
    if (deleteId === null) return

    // Mock: 模拟 IPC 删除
    console.log('[Mock] 删除录制点击:', { id: deleteId })
    await new Promise((r) => setTimeout(r, 200))

    // 从 mock 数组中移除（实际项目中通过 IPC 删除）
    const idx = MOCK_ITEMS.findIndex((item) => item.id === deleteId)
    if (idx !== -1) MOCK_ITEMS.splice(idx, 1)

    setDeleteId(null)
    loadData(page)
  }

  // ===========================================================================
  // 格式化时间
  // ===========================================================================

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <List className="h-4 w-4" />
              录制的点击事件
              {total > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  （共 {total} 条）
                </span>
              )}
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="关闭"
            >
              <CircleX className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-[200px]">
          {/* 加载中 */}
          {loading && (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 加载失败 */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-[200px] gap-3">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => loadData(page)}>
                重试
              </Button>
            </div>
          )}

          {/* 空状态 */}
          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-muted-foreground">
              <MousePointerClick className="h-10 w-10 opacity-30" />
              <p className="text-sm">暂无录制的点击事件</p>
              <p className="text-xs opacity-60">点击投屏区域右上角的录制按钮开始录制</p>
            </div>
          )}

          {/* 数据列表 */}
          {!loading && !error && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                    'hover:bg-muted/50 group'
                  )}
                >
                  {/* 左侧信息 */}
                  <div className="flex-1 min-w-0">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="flex h-6 w-6 items-center justify-center rounded text-green-500 hover:bg-green-500/10"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground/80">
                          ({item.x}, {item.y})
                        </span>
                        <Badge className="h-4 text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                          {item.type}
                        </Badge>
                      </div>
                    )}
                    {editingId !== item.id && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        {formatDate(item.createdAt)}
                      </p>
                    )}
                  </div>

                  {/* 右侧操作 */}
                  {editingId !== item.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(item)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="编辑名称"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 底部分页 */}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between pt-3 mt-2 border-t">
              <span className="text-[11px] text-muted-foreground/60">
                共 {total} 条，第 {page}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // 显示第一页、最后一页、当前页及前后各一页
                    if (p === 1 || p === totalPages) return true
                    if (Math.abs(p - page) <= 1) return true
                    return false
                  })
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-1 text-[11px] text-muted-foreground/40">···</span>
                        )}
                        <button
                          onClick={() => goToPage(p)}
                          className={cn(
                            'flex h-7 min-w-[28px] items-center justify-center rounded text-xs transition-colors',
                            p === page
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          {p}
                        </button>
                      </span>
                    )
                  })}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="确认删除"
        description="删除后无法恢复，确定要删除这条录制记录吗？"
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
