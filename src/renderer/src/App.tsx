import { Button } from '@/components/ui/button'

function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* 内容区 */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">AutoClick</h1>
          <p className="text-muted-foreground text-sm">
            手机投屏与控制软件
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" size="sm" disabled>
              导入脚本
            </Button>
            <Button variant="default" size="sm" disabled>
              连接设备
            </Button>
          </div>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="flex h-7 items-center border-t px-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
          DISCONNECTED
        </span>
        <span className="ml-auto">v1.0.0</span>
      </footer>
    </div>
  )
}

export default App
