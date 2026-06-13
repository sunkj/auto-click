import { useDeviceStore } from '@/stores/deviceStore'
import { Button } from '@/components/ui/button'
import { Smartphone, Monitor, Wifi, ArrowUpDown } from 'lucide-react'

export function MirrorPanel() {
  const { isConnected, deviceInfo, connect, disconnect } = useDeviceStore()

  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* Top info bar */}
      <div className="flex h-[40px] items-center gap-4 border-b px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5" />
          <span>投屏</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5" />
          <span>USB</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>1920x1080</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 items-center justify-center">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-6 max-w-sm text-center">
            {/* Phone Icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                <Smartphone className="h-10 w-10 text-muted-foreground/40" />
              </div>
            </div>

            {/* Connect Button */}
            <Button
              onClick={connect}
              size="lg"
              className="h-12 px-8 text-base gap-2"
            >
              <Smartphone className="h-5 w-5" />
              连接设备
            </Button>

            {/* Instructions */}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>请通过 USB 连接您的 Android 设备</p>
              <p>确保已开启开发者选项和 USB 调试</p>
            </div>
          </div>
        ) : (
          /* Connected State - Placeholder */
          <div className="flex flex-col items-center gap-4">
            <div className="w-[360px] h-[720px] rounded-lg bg-card border flex items-center justify-center">
              <Monitor className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <Button variant="outline" size="sm" onClick={disconnect}>
              断开连接
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Device Info Bar */}
      <div className="flex h-[40px] items-center justify-between border-t px-4">
        {isConnected && deviceInfo ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-500 font-medium">● CONNECTED</span>
              <span className="text-muted-foreground">{deviceInfo.model}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{deviceInfo.resolution}</span>
              <span>🔋 {deviceInfo.battery}%</span>
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">● DISCONNECTED</span>
        )}
      </div>
    </main>
  )
}
