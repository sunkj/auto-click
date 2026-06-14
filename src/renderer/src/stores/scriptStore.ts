import { create } from 'zustand'
import { useDeviceStore } from '@/stores/deviceStore'

// =============================================================================
// 类型定义（兼容原有组件接口）
// =============================================================================

export interface Step {
  id: string
  index: number
  type: 'click' | 'type' | 'swipe' | 'script' | 'longpress'
  params: Record<string, string>
  description: string
}

export interface Script {
  id: string
  name: string
  type: 'folder' | 'script'
  parentId: string | null
  steps?: Step[]
}

// =============================================================================
// IPC 辅助
// =============================================================================

/** 获取 electronAPI.script 的安全引用 */
function getAPI() {
  return window.electronAPI?.script
}

// =============================================================================
// Store 定义
// =============================================================================

interface ScriptStore {
  // 状态
  scripts: Script[]
  currentScriptId: string | null
  selectedStepId: string | null
  executingStepIndex: number | null
  expandedFolders: Set<string>
  loading: boolean

  // UI 状态操作（同步）
  setCurrentScript: (id: string) => void
  setSelectedStep: (id: string | null) => void
  setExecutingStep: (index: number | null) => void
  toggleFolder: (id: string) => void

  // 数据加载
  loadScripts: () => Promise<void>

  // 脚本 CRUD（异步）
  createScript: (name: string, parentId?: string | null, description?: string) => Promise<void>
  updateScript: (id: string, updates: { name?: string; description?: string; parentId?: string | null }) => Promise<void>
  deleteScript: (id: string) => Promise<void>
  updateScriptsOrder: (scriptIds: string[]) => Promise<void>

  // 文件夹 CRUD
  createFolder: (name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>

  // 步骤操作
  getStepsForScript: (scriptId: string) => Step[]
  addStep: (scriptId: string, type: string, params: Record<string, string>, insertIndex?: number) => Promise<void>
  updateStep: (stepId: number, type: string, params: Record<string, string>) => Promise<void>
  deleteStep: (stepId: number) => Promise<void>
  refreshSteps: (scriptId: string) => Promise<void>
}

export const useScriptStore = create<ScriptStore>((set, get) => ({
  // ---- 初始状态 ----
  scripts: [],
  currentScriptId: null,
  selectedStepId: null,
  executingStepIndex: null,
  expandedFolders: new Set<string>(),
  loading: false,

  // ---- UI 状态操作 ----
  setCurrentScript: (id) => set({ currentScriptId: id, selectedStepId: null }),
  setSelectedStep: (id) => set({ selectedStepId: id }),
  setExecutingStep: (index) => set({ executingStepIndex: index }),

  toggleFolder: (id) => {
    const expanded = new Set(get().expandedFolders)
    if (expanded.has(id)) {
      expanded.delete(id)
    } else {
      expanded.add(id)
    }
    set({ expandedFolders: expanded })
  },

  // ---- 数据加载 ----

  /**
   * 从数据库加载所有脚本和文件夹
   */
  loadScripts: async () => {
    const api = getAPI()
    if (!api) return

    set({ loading: true })
    try {
      const result = await api.getAllScripts()
      if (result.success && result.data) {
        set({ scripts: result.data })
      }
    } catch (error) {
      console.error('[ScriptStore] 加载脚本失败:', error)
    } finally {
      set({ loading: false })
    }
  },

  // ---- 脚本 CRUD ----

  /**
   * 创建新脚本
   */
  createScript: async (name, parentId, description) => {
    const api = getAPI()
    if (!api) return

    // 生成文件名：中文/特殊字符安全处理
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    const filePath = `scripts/${safeName}.js`

    try {
      const result = await api.createScript({
        name,
        filePath,
        description,
        parentId: parentId ?? null,
      })
      if (result.success && result.data) {
        // 追加到本地列表
        set((state) => ({ scripts: [...state.scripts, result.data!] }))
      } else {
        console.error('[ScriptStore] 创建脚本失败:', result.error)
      }
    } catch (error) {
      console.error('[ScriptStore] 创建脚本异常:', error)
    }
  },

  /**
   * 更新脚本
   */
  updateScript: async (id, updates) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.updateScript(id, updates)
      if (result.success && result.data) {
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === id ? { ...s, ...result.data } : s
          ),
        }))
      } else {
        console.error('[ScriptStore] 更新脚本失败:', result.error)
      }
    } catch (error) {
      console.error('[ScriptStore] 更新脚本异常:', error)
    }
  },

  /**
   * 删除脚本
   */
  deleteScript: async (id) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.deleteScript(id)
      if (result.success) {
        set((state) => ({
          scripts: state.scripts.filter((s) => s.id !== id),
          currentScriptId:
            state.currentScriptId === id ? null : state.currentScriptId,
          selectedStepId:
            state.currentScriptId === id ? null : state.selectedStepId,
        }))
      }
    } catch (error) {
      console.error('[ScriptStore] 删除脚本失败:', error)
    }
  },

  /**
   * 批量调整脚本顺序
   */
  updateScriptsOrder: async (scriptIds) => {
    const api = getAPI()
    if (!api) return

    try {
      await api.updateScriptsOrder(scriptIds)
    } catch (error) {
      console.error('[ScriptStore] 更新排序失败:', error)
    }
  },

  // ---- 文件夹 ----

  /**
   * 创建文件夹
   */
  createFolder: async (name) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.createFolder(name)
      if (result.success && result.data) {
        set((state) => ({
          scripts: [...state.scripts, result.data!],
          expandedFolders: new Set(state.expandedFolders).add(result.data!.id),
        }))
      }
    } catch (error) {
      console.error('[ScriptStore] 创建文件夹失败:', error)
    }
  },

  /**
   * 删除文件夹
   */
  deleteFolder: async (id) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.deleteFolder(id)
      if (result.success) {
        // 同时移除文件夹及其内部的脚本
        set((state) => ({
          scripts: state.scripts.filter((s) => s.id !== id && s.parentId !== id),
          currentScriptId:
            state.currentScriptId === id ? null : state.currentScriptId,
        }))
        // 从展开集合中移除
        const expanded = new Set(get().expandedFolders)
        expanded.delete(id)
        set({ expandedFolders: expanded })
      }
    } catch (error) {
      console.error('[ScriptStore] 删除文件夹失败:', error)
    }
  },

  // ---- 步骤操作 ----

  /**
   * 获取指定脚本的步骤列表
   */
  getStepsForScript: (scriptId) => {
    const script = get().scripts.find((s) => s.id === scriptId)
    return script?.steps || []
  },

  /**
   * 添加步骤
   */
  addStep: async (scriptId, type, params, insertIndex) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.addStep({ scriptId, type, params, insertIndex })
      if (result.success) {
        // 刷新该脚本的步骤列表
        await get().refreshSteps(scriptId)
      }
    } catch (error) {
      console.error('[ScriptStore] 添加步骤失败:', error)
    }
  },

  /**
   * 更新步骤
   */
  updateStep: async (stepId, type, params) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.updateStep(stepId, type, params)
      if (result.success) {
        // 刷新当前脚本的步骤
        const scriptId = get().currentScriptId
        if (scriptId) {
          await get().refreshSteps(scriptId)
        }
      } else {
        console.error('[ScriptStore] 更新步骤失败:', result.error)
      }
    } catch (error) {
      console.error('[ScriptStore] 更新步骤异常:', error)
    }
  },

  /**
   * 删除步骤
   */
  deleteStep: async (stepId) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.deleteStep(stepId)
      if (result.success) {
        // 刷新当前脚本的步骤
        const scriptId = get().currentScriptId
        if (scriptId) {
          await get().refreshSteps(scriptId)
        }
      }
    } catch (error) {
      console.error('[ScriptStore] 删除步骤失败:', error)
    }
  },

  /**
   * 刷新指定脚本的步骤数据
   */
  refreshSteps: async (scriptId) => {
    const api = getAPI()
    if (!api) return

    try {
      const result = await api.getStepsByScriptId(scriptId)
      if (result.success && result.data) {
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === scriptId ? { ...s, steps: result.data! } : s
          ),
        }))
      }
    } catch (error) {
      console.error('[ScriptStore] 刷新步骤失败:', error)
    }
  },

  // ---- 脚本执行 ----

  /**
   * 全量执行当前脚本
   */
  stopExecution: () => {
    window.electronAPI?.engine?.stopExecution()
    set({ executingStepIndex: null })
  },

  runScript: async (scriptId: string) => {
    const eng = window.electronAPI?.engine
    if (!eng) return
    const serial = useDeviceStore.getState().deviceInfo?.serial
    if (!serial) { console.error('[ScriptStore] 设备未连接'); return }
    set({ executingStepIndex: 0 })
    try {
      await eng.runScript(scriptId, serial)
    } catch (err) {
      console.error('[ScriptStore] 执行失败:', err)
    } finally {
      set({ executingStepIndex: null })
    }
  },

  /**
   * 单步执行
   */
  runStep: async (scriptId: string, stepIndex: number) => {
    const eng = window.electronAPI?.engine
    if (!eng) { console.error('[ScriptStore] engine API 不可用'); return }
    const serial = useDeviceStore.getState().deviceInfo?.serial
    console.log('[ScriptStore] runStep:', { scriptId, stepIndex, serial, deviceInfo: useDeviceStore.getState().deviceInfo })
    if (!serial) { console.error('[ScriptStore] 设备未连接'); return }
    set({ executingStepIndex: stepIndex })
    try {
      const result = await eng.runStep(scriptId, stepIndex, serial)
      console.log('[ScriptStore] 执行结果:', result)
      if (result && !result.success) {
        console.error('[ScriptStore] 执行失败:', result.error)
      }
    } catch (err) {
      console.error('[ScriptStore] 单步执行异常:', err)
    } finally {
      set({ executingStepIndex: null })
    }
  },
}))
