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
  steps?: Step[]
}

interface ScriptStore {
  scripts: Script[]
  currentScriptId: string | null
  selectedStepId: string | null
  executingStepIndex: number | null
  setCurrentScript: (id: string) => void
  setSelectedStep: (id: string | null) => void
  setExecutingStep: (index: number | null) => void
}

// Mock data for Iteration 2 layout
const mockScripts: Script[] = [
  { id: 'folder-1', name: 'production_v1', type: 'folder' },
  { id: 'script-1', name: 'login_test.js', type: 'script', steps: [
    { id: 's1', index: 1, type: 'click', params: { x: '320', y: '580' }, description: '(320, 580) - "Login Button"' },
    { id: 's2', index: 2, type: 'type', params: { text: 'admin_user_01' }, description: '"admin_user_01"' },
    { id: 's3', index: 3, type: 'click', params: { x: '320', y: '580' }, description: '(320, 580) - "Password Field"' },
    { id: 's4', index: 4, type: 'type', params: { text: '********' }, description: '"********"' },
    { id: 's5', index: 5, type: 'swipe', params: { direction: 'Up', duration: '1.2' }, description: 'Up (1.2s)' },
  ]},
  { id: 'script-2', name: 'scroll_pages.js', type: 'script', steps: [
    { id: 's6', index: 1, type: 'swipe', params: { direction: 'Left', duration: '0.8' }, description: 'Left (0.8s)' },
    { id: 's7', index: 2, type: 'swipe', params: { direction: 'Left', duration: '0.8' }, description: 'Left (0.8s)' },
  ]},
]

export const useScriptStore = create<ScriptStore>((set) => ({
  scripts: mockScripts,
  currentScriptId: null,
  selectedStepId: null,
  executingStepIndex: null,
  setCurrentScript: (id) => set({ currentScriptId: id, selectedStepId: null }),
  setSelectedStep: (id) => set({ selectedStepId: id }),
  setExecutingStep: (index) => set({ executingStepIndex: index }),
}))
