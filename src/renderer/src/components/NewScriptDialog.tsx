import { useState } from 'react'
import { useScriptStore } from '@/stores/scriptStore'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FolderClosed, FileCode, FolderPlus } from 'lucide-react'

type Tab = 'script' | 'folder'

interface NewScriptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewScriptDialog({ open, onOpenChange }: NewScriptDialogProps) {
  const { scripts } = useScriptStore()
  const [tab, setTab] = useState<Tab>('script')
  const [scriptName, setScriptName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [folderName, setFolderName] = useState('')

  const folders = scripts.filter((s) => s.type === 'folder')

  // 重置表单
  const resetForm = () => {
    setTab('script')
    setScriptName('')
    setSelectedFolder('')
    setFolderName('')
  }

  // 创建脚本
  const handleCreateScript = async () => {
    if (!scriptName.trim()) return
    try {
      await useScriptStore.getState().createScript(
        scriptName.trim(),
        selectedFolder || null
      )
    } catch (error) {
      console.error('[NewScriptDialog] 创建脚本失败:', error)
    }
    onOpenChange(false)
    resetForm()
  }

  // 创建目录
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    try {
      await useScriptStore.getState().createFolder(folderName.trim())
    } catch (error) {
      console.error('[NewScriptDialog] 创建目录失败:', error)
    }
    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogHeader>
        <DialogTitle>新建</DialogTitle>
        <DialogDescription>创建新的脚本或目录</DialogDescription>
      </DialogHeader>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
        <button
          onClick={() => setTab('script')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'script'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileCode className="h-3.5 w-3.5" />
          脚本
        </button>
        <button
          onClick={() => setTab('folder')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'folder'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          目录
        </button>
      </div>

      {/* 脚本 Tab */}
      {tab === 'script' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">脚本名称</label>
            <Input
              placeholder="输入脚本名称..."
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          {/* 目录选择器 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">保存位置</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedFolder('')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
                  selectedFolder === ''
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                <FolderClosed className="h-3 w-3" />
                根目录
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolder(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
                    selectedFolder === f.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  <FolderClosed className="h-3 w-3" />
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); resetForm() }}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreateScript} disabled={!scriptName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </div>
      )}

      {/* 目录 Tab */}
      {tab === 'folder' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">目录名称</label>
            <Input
              placeholder="输入目录名称..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); resetForm() }}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreateFolder} disabled={!folderName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
