import { useDeviceStore } from '@/stores/deviceStore'
import { useScriptStore } from '@/stores/scriptStore'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { isConnected, deviceInfo } = useDeviceStore()
  const { currentScriptId, scripts } = useScriptStore()
  const currentScript = scripts.find((s) => s.id === currentScriptId)

  return (
    <footer className="flex h-[28px] min-h-[28px] items-center border-t bg-card px-3 text-[11px] text-muted-foreground">
      {/* Left: Connection status */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-block h-2 w-2 rounded-full',
          isConnected ? 'bg-green-500' : 'bg-muted-foreground'
        )} />
        <span>{isConnected ? `CONNECTED • ${deviceInfo?.model}` : 'DISCONNECTED'}</span>
      </div>

      {/* Center: Script info */}
      {currentScript && (
        <span className="ml-4 truncate max-w-[200px]">
          当前脚本: {currentScript.name}
        </span>
      )}

      {/* Right: Version */}
      <span className="ml-auto">v1.0.0</span>
    </footer>
  )
}
