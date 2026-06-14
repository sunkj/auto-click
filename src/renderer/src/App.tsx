import { useEffect, useState } from 'react'
import { ScriptPanel } from '@/components/ScriptPanel'
import { StepPanel } from '@/components/StepPanel'
import { MirrorPanel } from '@/components/MirrorPanel'
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
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板（可折叠） */}
        {panelsVisible && (
          <>
            <ScriptPanel />
            <StepPanel />
          </>
        )}
        {/* 投屏区域（始终显示） */}
        <MirrorPanel onTogglePanels={togglePanels} />
      </div>
    </div>
  )
}

export default App
