import { useState, useEffect } from 'react'
import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { AiChatPanel } from '@/components/AiChatPanel'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ScheduleDialog } from '@/components/ScheduleDialog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FileCode, Sparkles, Sun, Moon, Clock, Settings } from 'lucide-react'

type Tab = 'script' | 'ai'

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('script')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

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
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsDark((v) => !v)} title={isDark ? '切换亮色主题' : '切换深色主题'}>
            {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScheduleOpen(true)} title="定时任务">
            <Clock className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3 w-3" />
          </Button>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
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
        <AiChatPanel />
      )}
    </aside>
  )
}
