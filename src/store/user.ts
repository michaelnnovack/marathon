import { create } from 'zustand'
import type { User, UserPreferences, UserStats, Achievement, PersonalRecord, PRData, PRHistory, PRAnalysis } from '@/types'
import { buildPRHistories, analyzePRProgress } from '@/utils/prTracking'

export interface UserProfile extends User {
  id: 'michael'
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
  prHistories: PRHistory[]
  prData: PRData[]
  prAnalysis?: PRAnalysis
  isLoading: boolean
  error: string | null
  updateUser: (updates: Partial<UserProfile>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  updateStats: (stats: Partial<UserStats>) => void
  setRaceDate: (iso: string) => void
  setGoalTime: (hhmmss: string) => void
  addAchievement: (achievement: Achievement) => void
  updatePersonalRecord: (record: PersonalRecord) => void
  updatePRData: (prData: PRData) => void
  addPRData: (prDataList: PRData[]) => void
  analyzePRs: () => void
  hydrate: () => void
  clearError: () => void
}

const createMichaelUser = (): UserProfile => {
  const now = new Date().toISOString()
  return {
    id: 'michael',
    name: 'Michael',
    level: 'beginner',
    trainingFocus: ['endurance'],
    preferences: { ...defaultPreferences },
    stats: { ...defaultStats },
    createdAt: now,
    updatedAt: now
  }
}

const defaultUser: UserProfile = createMichaelUser()

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

const persistPRData = (prData: PRData[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('mt_pr_data', JSON.stringify(prData))
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  achievements: [],
  personalRecords: [],
  prHistories: [],
  prData: [],
  prAnalysis: undefined,
  isLoading: false,
  error: null,
  
  updateUser: (updates) => {
    const currentUser = get().user
    if (!currentUser) return
    
    const updatedUser = { ...currentUser, ...updates }
    persist(updatedUser)
    set({ user: updatedUser, error: null })
  },
  
  updatePreferences: async (preferences) => {
    const currentUser = get().user
    if (!currentUser) return
    
    const updatedPreferences = { ...currentUser.preferences, ...preferences }
    const updatedUser = {
      ...currentUser,
      preferences: updatedPreferences
    }
    
    try {
      // Try to store in database if available
      if (typeof window !== 'undefined') {
        const dbModule = await import('@/lib/database/queries').catch(() => null)
        if (dbModule) {
          await dbModule.storeUserPreferences(updatedPreferences)
        }
      }
      
      // Also persist to localStorage as backup
      persist(updatedUser)
      set({ user: updatedUser, error: null })
    } catch (error) {
      console.error('Failed to update preferences in database:', error)
      // Still update in memory and localStorage
      persist(updatedUser)
      set({ user: updatedUser, error: 'Preferences updated locally only' })
    }
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
  
  updatePRData: (newPR) => {
    const prData = get().prData
    const updatedPRData = [...prData, newPR]
    
    persistPRData(updatedPRData)
    
    // Rebuild histories and analyze
    const prHistories = buildPRHistories(updatedPRData)
    const prAnalysis = analyzePRProgress(prHistories)
    
    set({ 
      prData: updatedPRData,
      prHistories,
      prAnalysis,
      error: null 
    })
  },
  
  addPRData: (newPRs) => {
    const prData = get().prData
    const updatedPRData = [...prData, ...newPRs]
    
    persistPRData(updatedPRData)
    
    // Rebuild histories and analyze
    const prHistories = buildPRHistories(updatedPRData)
    const prAnalysis = analyzePRProgress(prHistories)
    
    set({ 
      prData: updatedPRData,
      prHistories,
      prAnalysis,
      error: null 
    })
  },
  
  analyzePRs: () => {
    const { prData } = get()
    const prHistories = buildPRHistories(prData)
    const prAnalysis = analyzePRProgress(prHistories)
    
    set({ prHistories, prAnalysis, error: null })
  },
  
  clearError: () => set({ error: null }),
  
  hydrate: () => {
    if (typeof window === 'undefined') return
    
    set({ isLoading: true })
    
    try {
      // Load user - always use Michael
      const userRaw = localStorage.getItem('mt_user')
      let user: UserProfile
      
      if (userRaw) {
        const parsed = JSON.parse(userRaw) as UserProfile
        // Migrate old user data but force to Michael
        user = {
          ...defaultUser,
          ...parsed,
          id: 'michael',
          name: 'Michael'
        }
      } else {
        user = defaultUser
        localStorage.setItem('mt_user', JSON.stringify(user))
      }
      
      // Load achievements
      const achievementsRaw = localStorage.getItem('mt_achievements')
      const achievements: Achievement[] = achievementsRaw ? JSON.parse(achievementsRaw) : []
      
      // Load personal records
      const recordsRaw = localStorage.getItem('mt_personal_records')
      const personalRecords: PersonalRecord[] = recordsRaw ? JSON.parse(recordsRaw) : []
      
      // Load PR data
      const prDataRaw = localStorage.getItem('mt_pr_data')
      const prData: PRData[] = prDataRaw ? JSON.parse(prDataRaw) : []
      
      // Build PR histories and analysis
      const prHistories = buildPRHistories(prData)
      const prAnalysis = prData.length > 0 ? analyzePRProgress(prHistories) : undefined
      
      set({ 
        user, 
        achievements, 
        personalRecords,
        prData,
        prHistories,
        prAnalysis,
        isLoading: false, 
        error: null 
      })
    } catch (error) {
      console.error('Failed to hydrate user store:', error)
      const michael = defaultUser
      localStorage.setItem('mt_user', JSON.stringify(michael))
      set({ 
        user: michael, 
        achievements: [], 
        personalRecords: [],
        prData: [],
        prHistories: [],
        prAnalysis: undefined,
        isLoading: false, 
        error: 'Failed to load user data' 
      })
    }
  }
}))

// Remove users export since we only have Michael now
// export type { UserId } - no longer needed
