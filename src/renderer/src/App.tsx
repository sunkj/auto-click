import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { MirrorPanel } from '@/components/MirrorPanel'
import { AiFloatingAssistant } from '@/components/AiFloatingAssistant'
import { ToastContainer } from '@/components/ui/toast'
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
    <div className="relative flex h-screen w-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板（可折叠） */}
        {panelsVisible && <Sidebar />}
        {/* 投屏区域 */}
        <MirrorPanel onTogglePanels={togglePanels} panelsVisible={panelsVisible} />
      </div>
      {/* AI 智能助手 - 侧栏未展开时显示浮动按钮 */}
      {!panelsVisible && <AiFloatingAssistant />}
      {/* Toast 通知 - 右上角 */}
      <ToastContainer />
    </div>
  )
}

export default App
