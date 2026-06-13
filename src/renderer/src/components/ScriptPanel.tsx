import { useState } from 'react'
import { useScriptStore, Script } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NewScriptDialog } from '@/components/NewScriptDialog'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  FileCode,
  FolderClosed,
  FolderOpen,
  FilePlus,
  Download,
  Upload,
  Settings,
  ChevronRight,
  ChevronDown,
  Trash2,
} from 'lucide-react'

function ScriptFolder({ folder, onDelete }: { folder: Script; onDelete: (script: Script) => void }) {
  const { expandedFolders, toggleFolder } = useScriptStore()
  const isExpanded = expandedFolders.has(folder.id)
  const { scripts } = useScriptStore()
  const childScripts = scripts.filter((s) => s.parentId === folder.id)

  return (
    <div>
      <button
        onClick={() => toggleFolder(folder.id)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <FolderClosed className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
          {childScripts.length}
        </Badge>
      </button>
      {isExpanded && (
        <div className="ml-2 space-y-0.5 mt-0.5">
          {childScripts.map((script) => (
            <ScriptItem key={script.id} script={script} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScriptItem({ script, onDelete }: { script: Script; onDelete: (script: Script) => void }) {
  const { currentScriptId, setCurrentScript } = useScriptStore()
  const isSelected = currentScriptId === script.id

  return (
    <Card
      className={cn(
        'cursor-pointer border transition-all duration-150 group',
        isSelected
          ? 'border-primary/50 bg-accent shadow-sm'
          : 'border-transparent bg-transparent hover:bg-accent/50'
      )}
      onClick={() => setCurrentScript(script.id)}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <FileCode className={cn(
          'h-4 w-4 shrink-0',
          isSelected ? 'text-primary' : 'text-muted-foreground'
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs truncate',
            isSelected ? 'font-medium text-accent-foreground' : 'text-muted-foreground'
          )}>
            {script.name}
          </p>
        </div>
        {/* Delete icon — shown only when selected */}
        {isSelected && (
          <button
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(script)
            }}
            title="删除脚本"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </Card>
  )
}

export function ScriptPanel() {
  const { scripts } = useScriptStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null)

  const folders = scripts.filter((s) => s.type === 'folder')
  const rootScripts = scripts.filter(
    (s) => s.type === 'script' && s.parentId === null
  )

  const handleDelete = () => {
    if (!deleteTarget) return
    // TODO: actually remove from store/persistence
    setDeleteTarget(null)
  }

  return (
    <aside className="flex w-[240px] min-w-[240px] flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-[40px] items-center px-4 border-b">
        <h1 className="text-lg font-bold tracking-tight text-foreground">AutoClick</h1>
      </div>

      {/* New Script Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <FilePlus className="h-3.5 w-3.5" />
          新建脚本
        </Button>
      </div>
      <NewScriptDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Script List */}
      <ScrollArea className="flex-1 px-2">
        <div className="py-1 space-y-1">
          {folders.map((folder) => (
            <ScriptFolder key={folder.id} folder={folder} onDelete={setDeleteTarget} />
          ))}
          {rootScripts.length > 0 && (
            <div className="space-y-0.5 pt-1">
              {rootScripts.map((script) => (
                <ScriptItem key={script.id} script={script} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
          {scripts.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              暂无脚本
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-0 space-y-1">
        <div className="flex gap-1 px-2 py-1">
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1">
            <Download className="h-3 w-3" />
            导入
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1">
            <Upload className="h-3 w-3" />
            导出
          </Button>
        </div>
        <div className="flex h-[40px] items-center justify-between px-2 py-1 border-t">
          <span className="text-[10px] text-muted-foreground">v1.0.0</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3 w-3" />
          </Button>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </div>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="删除脚本"
        description={`确定要删除 "${deleteTarget?.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </aside>
  )
}
