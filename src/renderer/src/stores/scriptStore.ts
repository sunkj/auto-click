import { create } from 'zustand'

export interface Step {
  id: string
  index: number
  type: 'click' | 'type' | 'swipe' | 'script'
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

interface ScriptStore {
  scripts: Script[]
  currentScriptId: string | null
  selectedStepId: string | null
  executingStepIndex: number | null
  expandedFolders: Set<string>
  setCurrentScript: (id: string) => void
  setSelectedStep: (id: string | null) => void
  setExecutingStep: (index: number | null) => void
  toggleFolder: (id: string) => void
  getStepsForScript: (scriptId: string) => Step[]
}

// Mock data - folders and their child scripts
const mockScripts: Script[] = [
  { id: 'folder-1', name: 'production_v1', type: 'folder', parentId: null },
  { id: 'script-1', name: 'login_test.js', type: 'script', parentId: 'folder-1', steps: [
    { id: 's1', index: 1, type: 'click', params: { x: '320', y: '580' }, description: '(320, 580) - "Login Button"' },
    { id: 's2', index: 2, type: 'type', params: { text: 'admin_user_01' }, description: '"admin_user_01"' },
    { id: 's3', index: 3, type: 'click', params: { x: '320', y: '580' }, description: '(320, 580) - "Password Field"' },
    { id: 's4', index: 4, type: 'type', params: { text: '********' }, description: '"********"' },
    { id: 's5', index: 5, type: 'swipe', params: { direction: 'Up', duration: '1.2' }, description: 'Up (1.2s)' },
  ]},
  { id: 'script-2', name: 'scroll_pages.js', type: 'script', parentId: 'folder-1', steps: [
    { id: 's6', index: 1, type: 'swipe', params: { direction: 'Left', duration: '0.8' }, description: 'Left (0.8s)' },
    { id: 's7', index: 2, type: 'swipe', params: { direction: 'Left', duration: '0.8' }, description: 'Left (0.8s)' },
  ]},
  { id: 'folder-2', name: 'daily_tasks', type: 'folder', parentId: null },
  { id: 'script-3', name: 'auto_like.js', type: 'script', parentId: 'folder-2', steps: [
    { id: 's8', index: 1, type: 'click', params: { x: '500', y: '300' }, description: '(500, 300) - "Like Button"' },
    { id: 's9', index: 2, type: 'swipe', params: { direction: 'Down', duration: '0.5' }, description: 'Down (0.5s)' },
  ]},
  { id: 'script-4', name: 'check_in.js', type: 'script', parentId: 'folder-2', steps: [
    { id: 's10', index: 1, type: 'click', params: { x: '200', y: '400' }, description: '(200, 400) - "Check-in"' },
    { id: 's11', index: 2, type: 'type', params: { text: 'Good morning' }, description: '"Good morning"' },
    { id: 's12', index: 3, type: 'click', params: { x: '500', y: '600' }, description: '(500, 600) - "Submit"' },
  ]},
  // Root-level scripts (no folder)
  { id: 'script-5', name: 'quick_test.js', type: 'script', parentId: null, steps: [
    { id: 's13', index: 1, type: 'click', params: { x: '400', y: '500' }, description: '(400, 500) - "Test"' },
  ]},
]

export const useScriptStore = create<ScriptStore>((set, get) => ({
  scripts: mockScripts,
  currentScriptId: null,
  selectedStepId: null,
  executingStepIndex: null,
  expandedFolders: new Set<string>(['folder-1']), // folder-1 expanded by default

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

  getStepsForScript: (scriptId) => {
    const script = get().scripts.find((s) => s.id === scriptId)
    return script?.steps || []
  },
}))
