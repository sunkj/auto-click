import { useState } from 'react'
import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { MirrorPanel } from '@/components/MirrorPanel'
import { LandingPage } from '@/components/LandingPage'

function App() {
  const [panelsVisible, setPanelsVisible] = useState(false)

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
