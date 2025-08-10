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
  hydrate: () => void
}

const KEY = 'mt_activities'

export const useActivities = create<ActivitiesState>((set, get) => ({
  list: [],
  addActivities: (as) => {
    const next = [...get().list, ...as]
    if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next))
    set({ list: next })
  },
  clear: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(KEY)
    set({ list: [] })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(KEY)
    if (raw) {
      try { 
        const parsed = JSON.parse(raw)
        // Safety limit to prevent browser freezing
        if (Array.isArray(parsed) && parsed.length > 5000) {
          console.warn(`Too many activities (${parsed.length}), truncating to last 1000 for performance`)
          set({ list: parsed.slice(-1000) })
          // Update localStorage with truncated data
          localStorage.setItem(KEY, JSON.stringify(parsed.slice(-1000)))
        } else {
          set({ list: parsed })
        }
      } catch {}
    }
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

export function last7DaysMileageKm(list: SimpleActivity[]) {
  // Safety limit to prevent browser freezing
  if (list.length > 1000) {
    console.warn('Too many activities for 7-day calculation, truncating to last 1000')
    list = list.slice(-1000)
  }
  
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  return list
    .filter(a => {
      if (!a.date) return false // Only include activities with actual dates from TCX files
      const activityDate = new Date(a.date)
      return activityDate >= sevenDaysAgo && activityDate <= now
    })
    .reduce((total, a) => total + (a.distance / 1000), 0)
}

export function activitiesWithDatesCount(list: SimpleActivity[]) {
  return list.filter(a => a.date).length
}
