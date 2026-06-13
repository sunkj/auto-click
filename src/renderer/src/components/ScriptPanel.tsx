import { useScriptStore, Script } from '@/stores/scriptStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileCode, FolderClosed, FilePlus, Download, Upload, Settings } from 'lucide-react'

export function ScriptPanel() {
  const { scripts, currentScriptId, setCurrentScript } = useScriptStore()

  return (
    <aside className="flex w-[240px] min-w-[240px] flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-[56px] items-center px-4 border-b">
        <h1 className="text-lg font-bold tracking-tight text-foreground">AutoClick</h1>
      </div>

      {/* New Script Button */}
      <div className="px-3 pt-3 pb-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
          <FilePlus className="h-3.5 w-3.5" />
          新建脚本
        </Button>
      </div>

      {/* Script List */}
      <ScrollArea className="flex-1 px-2">
        <div className="py-1 space-y-0.5">
          {scripts.map((script: Script) => (
            <div key={script.id}>
              {script.type === 'folder' ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <FolderClosed className="h-3.5 w-3.5" />
                  <span>{script.name}</span>
                </div>
              ) : (
                <button
                  onClick={() => setCurrentScript(script.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors',
                    currentScriptId === script.id
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  )}
                >
                  <FileCode className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{script.name}</span>
                  <span className="text-[10px] opacity-50">▶</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2 space-y-1">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1">
            <Download className="h-3 w-3" />
            导入
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1">
            <Upload className="h-3 w-3" />
            导出
          </Button>
        </div>
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] text-muted-foreground">v1.0.0</span>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
