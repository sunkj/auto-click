import { useEffect, useState } from 'react'
import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { MirrorPanel } from '@/components/MirrorPanel'
import { LandingPage } from '@/components/LandingPage'
import { useScriptStore } from '@/stores/scriptStore'

function App() {
  const [panelsVisible, setPanelsVisible] = useState(false)
  const loadScripts = useScriptStore((s) => s.loadScripts)

  // 应用启动时加载脚本数据
  useEffect(() => {
    loadScripts()
  }, [loadScripts])

  const togglePanels = () => setPanelsVisible((v) => !v)

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {panelsVisible ? (
        /* Three-column layout */
        <div className="flex flex-1 overflow-hidden">
          <ScriptPanel />
          <StepPanel />
          <MirrorPanel onTogglePanels={togglePanels} />
        </div>
      ) : (
        /* Landing page (full-width mirroring) */
        <div className="flex flex-1 overflow-hidden">
          <LandingPage onTogglePanels={togglePanels} panelsVisible={false} />
        </div>
      )}
    </div>
  )
}

export default App
