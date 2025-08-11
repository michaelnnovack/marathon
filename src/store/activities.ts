import { create } from 'zustand'

export interface TrackPoint {
  lat: number
  lng: number
  elevation?: number
  time?: string
}

export interface SimpleActivity {
  date?: string
  distance: number // meters
  duration: number // seconds
  avgHr?: number
  elevationGain?: number
  trackPoints?: TrackPoint[]
}

interface ActivitiesState {
  list: SimpleActivity[]
  addActivities: (as: SimpleActivity[]) => void
  clear: () => void
  hydrate: () => Promise<void>
  isLoading: boolean
}

const KEY = 'mt_activities'

export const useActivities = create<ActivitiesState>((set, get) => ({
  list: [],
  isLoading: false,
  addActivities: (as) => {
    const next = [...get().list, ...as]
    if (typeof window !== 'undefined') {
      // Use RAF to prevent blocking the main thread during large saves
      requestAnimationFrame(() => {
        localStorage.setItem(KEY, JSON.stringify(next))
      })
    }
    set({ list: next })
  },
  clear: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(KEY)
    set({ list: [] })
  },
  hydrate: async () => {
    if (typeof window === 'undefined') return Promise.resolve()
    
    set({ isLoading: true })
    
    // Use RAF to prevent blocking the main thread
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const raw = localStorage.getItem(KEY)
        if (raw) {
          try { 
            const parsed = JSON.parse(raw)
            // Safety limit to prevent browser freezing
            if (Array.isArray(parsed) && parsed.length > 5000) {
              console.warn(`Too many activities (${parsed.length}), truncating to last 1000 for performance`)
              const truncated = parsed.slice(-1000)
              set({ list: truncated, isLoading: false })
              // Update localStorage with truncated data (async)
              setTimeout(() => localStorage.setItem(KEY, JSON.stringify(truncated)), 100)
            } else {
              set({ list: parsed, isLoading: false })
            }
          } catch {
            set({ isLoading: false })
          }
        } else {
          set({ isLoading: false })
        }
        resolve()
      })
    })
  },
}))

export function weeklyMileageKm(list: SimpleActivity[]) {
  // Safety limit to prevent browser freezing
  if (list.length > 1000) {
    console.warn('Too many activities for weekly mileage calculation, truncating to last 1000')
    list = list.slice(-1000)
  }
  
  const byWeek = new Map<string, number>()
  for (const a of list) {
    if (!a.date) continue // Only include activities with actual dates from TCX files
    const d = new Date(a.date)
    const monday = new Date(d)
    const day = monday.getDay() || 7
    if (day !== 1) monday.setHours(-24 * (day - 1))
    monday.setHours(0,0,0,0)
    const key = monday.toISOString().slice(0,10)
    byWeek.set(key, (byWeek.get(key) || 0) + (a.distance/1000))
  }
  return Array.from(byWeek.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([week, km])=>({week, km}))
}

// Memoized version for better performance
let last7DaysCache: { data: number, checksum: string, timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function last7DaysMileageKm(list: SimpleActivity[]) {
  // Safety limit to prevent browser freezing  
  if (list.length > 1000) {
    console.warn('Too many activities for 7-day calculation, truncating to last 1000')
    list = list.slice(-1000)
  }
  
  // Create checksum for caching
  const now = Date.now()
  const checksum = `${list.length}-${now >> 20}` // Cache for ~17 minutes
  if (last7DaysCache && 
      last7DaysCache.checksum === checksum && 
      (now - last7DaysCache.timestamp) < CACHE_DURATION) {
    return last7DaysCache.data
  }
  
  const currentDate = new Date()
  const sevenDaysAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const result = list
    .filter(a => {
      if (!a.date) return false // Only include activities with actual dates from TCX files
      const activityDate = new Date(a.date)
      return activityDate >= sevenDaysAgo && activityDate <= currentDate
    })
    .reduce((total, a) => total + (a.distance / 1000), 0)
  
  // Cache the result
  last7DaysCache = { data: result, checksum, timestamp: now }
  
  return result
}

export function activitiesWithDatesCount(list: SimpleActivity[]) {
  return list.filter(a => a.date).length
}
