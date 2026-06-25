/**
 * 屏幕上下文识别服务
 *
 * 判断当前手机屏幕处于什么状态：桌面、某个 App 内、或锁屏。
 * 通过 `adb shell dumpsys window` 获取当前焦点窗口的包名来判断。
 */
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/** 当前屏幕上下文 */
export type ScreenContext = 'lock_screen' | 'home_screen' | 'in_app' | 'unknown'

/** 常见桌面 Launcher 包名列表 */
const LAUNCHER_PACKAGES = [
  'com.oplus.launcher',           // OPPO/OnePlus ColorOS
  'com.google.android.apps.nexuslauncher', // Pixel
  'com.google.android.apps.leanback',      // Android TV
  'com.android.launcher3',        // AOSP
  'com.miui.home',                // Xiaomi MIUI
  'com.sec.android.app.launcher', // Samsung OneUI
  'com.sec.android.app.launcher3',
  'com.huawei.android.launcher',  // Huawei EMUI
  'com.huawei.android.launcher3',
  'com.vivo.launcher',            // Vivo
  'com.android.launcher',         // Generic
  'com.android.launcher2',
  'com.bbk.launcher2',
]

/** 锁屏/系统 UI 包名列表 */
const LOCKSCREEN_PACKAGES = [
  'com.android.systemui',
  'com.oplus.keyguard',           // OPPO/OnePlus 锁屏
  'com.android.keyguard',
]

export interface ScreenContextResult {
  context: ScreenContext
  packageName: string | null
}

/**
 * 获取当前屏幕上下文
 *
 * 通过 `adb shell dumpsys window` 解析 mCurrentFocus 字段。
 * 也可复用 uiautomator dump 结果中的 package 属性。
 */
export async function detectScreenContext(serial: string): Promise<ScreenContextResult> {
  try {
    const { stdout } = await execAsync(
      `adb -s ${serial} shell dumpsys window 2>/dev/null | grep mCurrentFocus`,
      { timeout: 5000 },
    )

    // mCurrentFocus=Window{... com.oplus.launcher/com.oplus.launcher.Launcher}
    const match = stdout.match(/mCurrentFocus=.*\s([^\s\}]+)\//)
    if (!match) {
      return { context: 'unknown', packageName: null }
    }

    const packageName = match[1]

    if (LOCKSCREEN_PACKAGES.includes(packageName)) {
      return { context: 'lock_screen', packageName }
    }

    if (LAUNCHER_PACKAGES.includes(packageName)) {
      return { context: 'home_screen', packageName }
    }

    return { context: 'in_app', packageName }
  } catch {
    return { context: 'unknown', packageName: null }
  }
}

/**
 * 检查当前是否在指定 App 中
 */
export async function isInApp(serial: string, targetPackage: string): Promise<boolean> {
  const result = await detectScreenContext(serial)
  return result.packageName === targetPackage
}
