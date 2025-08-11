import { create } from 'zustand'
import type { User, UserPreferences, UserStats, Achievement, PersonalRecord } from '@/types'

type UserId = 'michael' | 'sara'

export interface UserProfile extends User {
  id: UserId
}

// Default preferences
const defaultPreferences: UserPreferences = {
  units: 'metric',
  theme: 'auto',
  notifications: {
    workoutReminders: true,
    achievementAlerts: true,
    weeklyReports: true
  },
  privacy: {
    shareProgress: false,
    publicProfile: false
  }
}

// Default stats
const defaultStats: UserStats = {
  totalDistance: 0,
  totalWorkouts: 0,
  totalDuration: 0,
  averagePace: 0,
  currentStreak: 0,
  longestStreak: 0
}

interface UserState {
  user: UserProfile | null
  achievements: Achievement[]
  personalRecords: PersonalRecord[]
  isLoading: boolean
  error: string | null
  setUser: (u: UserProfile | null) => void
  updateUser: (updates: Partial<UserProfile>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  updateStats: (stats: Partial<UserStats>) => void
  setRaceDate: (iso: string) => void
  setGoalTime: (hhmmss: string) => void
  addAchievement: (achievement: Achievement) => void
  updatePersonalRecord: (record: PersonalRecord) => void
  hydrate: () => void
  clearError: () => void
}

const createDefaultUser = (id: UserId, name: string): UserProfile => {
  const now = new Date().toISOString()
  return {
    id,
    name,
    level: 'beginner',
    trainingFocus: ['endurance'],
    preferences: { ...defaultPreferences },
    stats: { ...defaultStats },
    createdAt: now,
    updatedAt: now
  }
}

const defaultUsers: Record<UserId, UserProfile> = {
  michael: createDefaultUser('michael', 'Michael'),
  sara: createDefaultUser('sara', 'Sara')
}

const persist = (u: UserProfile | null) => {
  if (typeof window === 'undefined') return
  if (u) {
    u.updatedAt = new Date().toISOString()
    localStorage.setItem('mt_user', JSON.stringify(u))
  } else {
    localStorage.removeItem('mt_user')
  }
}

const persistAchievements = (achievements: Achievement[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('mt_achievements', JSON.stringify(achievements))
}

const persistPersonalRecords = (records: PersonalRecord[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('mt_personal_records', JSON.stringify(records))
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  achievements: [],
  personalRecords: [],
  isLoading: false,
  error: null,
  
  setUser: (u) => {
    persist(u)
    set({ user: u, error: null })
  },
  
  updateUser: (updates) => {
    const currentUser = get().user
    if (!currentUser) return
    
    const updatedUser = { ...currentUser, ...updates }
    persist(updatedUser)
    set({ user: updatedUser, error: null })
  },
  
  updatePreferences: (preferences) => {
    const currentUser = get().user
    if (!currentUser) return
    
    const updatedUser = {
      ...currentUser,
      preferences: { ...currentUser.preferences, ...preferences }
    }
    persist(updatedUser)
    set({ user: updatedUser, error: null })
  },
  
  updateStats: (stats) => {
    const currentUser = get().user
    if (!currentUser) return
    
    const updatedUser = {
      ...currentUser,
      stats: { ...currentUser.stats, ...stats }
    }
    persist(updatedUser)
    set({ user: updatedUser, error: null })
  },
  
  setRaceDate: (iso) => {
    const u = get().user
    if (!u) return
    const next = { ...u, raceDate: iso }
    persist(next)
    set({ user: next, error: null })
  },
  
  setGoalTime: (hhmmss) => {
    const u = get().user
    if (!u) return
    const next = { ...u, goalTime: hhmmss }
    persist(next)
    set({ user: next, error: null })
  },
  
  addAchievement: (achievement) => {
    const achievements = [...get().achievements, achievement]
    persistAchievements(achievements)
    set({ achievements, error: null })
  },
  
  updatePersonalRecord: (record) => {
    const records = get().personalRecords
    const existingIndex = records.findIndex(r => r.type === record.type)
    
    let updatedRecords: PersonalRecord[]
    if (existingIndex >= 0) {
      updatedRecords = [...records]
      updatedRecords[existingIndex] = record
    } else {
      updatedRecords = [...records, record]
    }
    
    persistPersonalRecords(updatedRecords)
    set({ personalRecords: updatedRecords, error: null })
  },
  
  clearError: () => set({ error: null }),
  
  hydrate: () => {
    if (typeof window === 'undefined') return
    
    set({ isLoading: true })
    
    try {
      // Load user
      const userRaw = localStorage.getItem('mt_user')
      let user: UserProfile
      
      if (userRaw) {
        const parsed = JSON.parse(userRaw) as UserProfile
        // Migrate old user data
        user = {
          ...createDefaultUser(parsed.id, parsed.name),
          ...parsed
        }
      } else {
        user = defaultUsers.michael
        localStorage.setItem('mt_user', JSON.stringify(user))
      }
      
      // Load achievements
      const achievementsRaw = localStorage.getItem('mt_achievements')
      const achievements: Achievement[] = achievementsRaw ? JSON.parse(achievementsRaw) : []
      
      // Load personal records
      const recordsRaw = localStorage.getItem('mt_personal_records')
      const personalRecords: PersonalRecord[] = recordsRaw ? JSON.parse(recordsRaw) : []
      
      set({ 
        user, 
        achievements, 
        personalRecords, 
        isLoading: false, 
        error: null 
      })
    } catch (error) {
      console.error('Failed to hydrate user store:', error)
      const michael = defaultUsers.michael
      localStorage.setItem('mt_user', JSON.stringify(michael))
      set({ 
        user: michael, 
        achievements: [], 
        personalRecords: [], 
        isLoading: false, 
        error: 'Failed to load user data' 
      })
    }
  }
}))

export const users = Object.values(defaultUsers)
export type { UserId }
