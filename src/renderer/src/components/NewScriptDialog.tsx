import { useState } from 'react'
import { useScriptStore } from '@/stores/scriptStore'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { FolderClosed } from 'lucide-react'

interface NewScriptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewScriptDialog({ open, onOpenChange }: NewScriptDialogProps) {
  const { scripts } = useScriptStore()
  const [scriptName, setScriptName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('')

  const folders = scripts.filter((s) => s.type === 'folder')

  const handleCreate = () => {
    if (!scriptName.trim()) return
    // TODO: create script in store
    onOpenChange(false)
    setScriptName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>新建脚本</DialogTitle>
        <DialogDescription>创建一个新的自动化脚本</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Script Name */}
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

        {/* Folder selector */}
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
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={!scriptName.trim()}>
          创建
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
