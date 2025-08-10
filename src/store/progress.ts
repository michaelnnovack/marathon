import { create } from 'zustand'

export interface Completion {
  completedAt: string
  rpe?: number
  notes?: string
}

interface ProgressState {
  map: Record<string, Completion>
  mark: (workoutId: string, data: Completion) => void
  hydrate: () => void
}

export const useProgress = create<ProgressState>((set, get) => ({
  map: {},
  mark: (id, data) => {
    const next = { ...get().map, [id]: data }
    if (typeof window !== 'undefined') localStorage.setItem('mt_progress', JSON.stringify(next))
    set({ map: next })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('mt_progress')
    if (raw) {
      try { set({ map: JSON.parse(raw) }) } catch {}
    }
  },
}))
