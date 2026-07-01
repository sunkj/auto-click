import { useState } from 'react'
import { useScriptStore, Script } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NewScriptDialog } from '@/components/NewScriptDialog'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  FileCode,
  FolderClosed,
  FolderOpen,
  FilePlus,
  Download,
  Upload,
  ChevronRight,
  ChevronDown,
  Trash2,
  MousePointerClick,

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
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 active:scale-[0.98] transition-all duration-150 rounded-md"
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
    <div
      className={cn(
        'cursor-pointer transition-all duration-150 group',
        isSelected
          ? 'bg-accent shadow-sm rounded-md'
          : 'hover:bg-accent/30 rounded-md'
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
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.9] transition-all duration-150"
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
    </div>
  )
}

interface ScriptPanelProps {
  className?: string
}

export function ScriptPanel({ className }: ScriptPanelProps) {
  const { scripts, loading, currentScriptId } = useScriptStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null)

  const folders = scripts.filter((s) => s.type === 'folder')
  const rootScripts = scripts.filter(
    (s) => s.type === 'script' && s.parentId === null
  )

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'folder') {
      useScriptStore.getState().deleteFolder(deleteTarget.id)
    } else {
      useScriptStore.getState().deleteScript(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

  const handleImport = async () => {
    const api = window.electronAPI?.script
    if (!api) return
    try {
      const result = await api.importScript()
      if (result.success && result.data) {
        await useScriptStore.getState().loadScripts()
      }
    } catch (error) {
      console.error('[ScriptPanel] 导入失败:', error)
    }
  }

  const handleExport = async () => {
    const api = window.electronAPI?.script
    if (!api || !currentScriptId) return
    try {
      await api.exportScript(currentScriptId)
    } catch (error) {
      console.error('[ScriptPanel] 导出失败:', error)
    }
  }

  return (
    <div className={cn("flex flex-col bg-background", className)}>
      {/* New Script Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <FilePlus className="h-3.5 w-3.5" />
          新建脚本/目录
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
          {loading && scripts.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              加载中...
            </div>
          )}
          {!loading && scripts.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pt-[320px] text-center">
              <FileCode className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">暂无脚本/目录</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  请从新建脚本/目录
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-0 space-y-1">
        <div className="flex gap-1 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 hover:bg-muted/30"
            onClick={handleImport}
          >
            <Download className="h-3.5 w-3.5" />
            导入
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 hover:bg-muted/30"
            onClick={handleExport}
            disabled={!currentScriptId}
          >
            <Upload className="h-3.5 w-3.5" />
            导出
          </Button>
        </div>
        <div className="h-1" />
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
    </div>
  )
}
