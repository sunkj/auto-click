import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { MirrorPanel } from '@/components/MirrorPanel'
import { StatusBar } from '@/components/StatusBar'

function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        <ScriptPanel />
        <StepPanel />
        <MirrorPanel />
      </div>
      <StatusBar />
    </div>
  )
}

export default App
