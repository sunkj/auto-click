import { useState } from 'react'
import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { AiChatPanel } from '@/components/AiChatPanel'
import { FileTransferPanel } from '@/components/FileTransferPanel'
import { SidebarActions } from '@/components/SidebarActions'
import { cn } from '@/lib/utils'
import { FileCode, Sparkles, FolderOpen } from 'lucide-react'

type Tab = 'script' | 'ai' | 'files'

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('script')

  return (
    <aside className="flex w-[480px] min-w-[480px] flex-col border-r bg-background">
      {/* Tab Bar */}
      <div className="flex h-[40px] items-center justify-between border-b px-1 shrink-0">
        <div className="flex items-center gap-0 h-full">
          <button
            onClick={() => setActiveTab('script')}
            className={cn(
              'relative flex items-center gap-1.5 h-full px-3 pb-px text-xs font-medium transition-colors',
              'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2.5px] after:rounded-full after:transition-all after:duration-200',
              activeTab === 'script'
                ? 'text-foreground after:bg-primary'
                : 'text-muted-foreground/60 hover:text-muted-foreground after:bg-transparent'
            )}
          >
            <FileCode className={cn('h-3.5 w-3.5 transition-colors', activeTab === 'script' ? 'text-primary' : '')} />
            脚本
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              'relative flex items-center gap-1.5 h-full px-3 pb-px text-xs font-medium transition-colors',
              'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2.5px] after:rounded-full after:transition-all after:duration-200',
              activeTab === 'ai'
                ? 'text-foreground after:bg-primary'
                : 'text-muted-foreground/60 hover:text-muted-foreground after:bg-transparent'
            )}
          >
            <Sparkles className={cn('h-3.5 w-3.5 transition-colors', activeTab === 'ai' ? 'text-primary' : '')} />
            AI 助手
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              'relative flex items-center gap-1.5 h-full px-3 pb-px text-xs font-medium transition-colors',
              'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2.5px] after:rounded-full after:transition-all after:duration-200',
              activeTab === 'files'
                ? 'text-foreground after:bg-primary'
                : 'text-muted-foreground/60 hover:text-muted-foreground after:bg-transparent'
            )}
          >
            <FolderOpen className={cn('h-3.5 w-3.5 transition-colors', activeTab === 'files' ? 'text-primary' : '')} />
            文件
          </button>
        </div>
        <div className="flex items-center gap-0.5 pr-2">
          <SidebarActions />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'script' && (
        <div className="flex flex-1 overflow-hidden">
          <ScriptPanel className="w-[180px] min-w-[180px] border-r" />
          <StepPanel className="flex-1" />
        </div>
      )}
      {activeTab === 'ai' && (
        <div className="flex flex-1 overflow-hidden">
          <AiChatPanel />
        </div>
      )}
      {activeTab === 'files' && (
        <div className="flex flex-1 overflow-hidden">
          <FileTransferPanel />
        </div>
      )}
    </aside>
  )
}
