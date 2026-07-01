import { useState, useEffect } from 'react'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ScheduleDialog } from '@/components/ScheduleDialog'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Clock, Settings } from 'lucide-react'

export function SidebarActions() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <>
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
    </>
  )
}
