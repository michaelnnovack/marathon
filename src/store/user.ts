import { create } from 'zustand'
import type { User } from '@/types'

type UserId = 'michael' | 'sara'

export interface UserProfile extends User {
  id: UserId
}

interface UserState {
  user: UserProfile | null
  setUser: (u: UserProfile | null) => void
  setRaceDate: (iso: string) => void
  setGoalTime: (hhmmss: string) => void
  hydrate: () => void
}

const defaultUsers: Record<UserId, UserProfile> = {
  michael: { id: 'michael', name: 'Michael' },
  sara: { id: 'sara', name: 'Sara' },
}

const persist = (u: UserProfile | null) => {
  if (typeof window === 'undefined') return
  if (u) localStorage.setItem('mt_user', JSON.stringify(u))
  else localStorage.removeItem('mt_user')
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  setUser: (u) => {
    persist(u)
    set({ user: u })
  },
  setRaceDate: (iso) => {
    const u = get().user
    if (!u) return
    const next = { ...u, raceDate: iso }
    persist(next)
    set({ user: next })
  },
  setGoalTime: (hhmmss) => {
    const u = get().user
    if (!u) return
    const next = { ...u, goalTime: hhmmss }
    persist(next)
    set({ user: next })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('mt_user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UserProfile
        set({ user: parsed })
        return
      } catch {}
    }
    const michael = defaultUsers.michael
    localStorage.setItem('mt_user', JSON.stringify(michael))
    set({ user: michael })
  },
}))

export const users = Object.values(defaultUsers)
