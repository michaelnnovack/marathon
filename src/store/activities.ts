import { create } from 'zustand'
import type { ActivitiesState, SimpleActivity, AddActivitiesResult } from '@/types'

const KEY = 'mt_activities'

// Helper function to create a unique identifier for duplicate detection
function getActivityFingerprint(activity: SimpleActivity): string {
  // Use date, distance, and duration as primary identifiers
  const date = activity.date ? new Date(activity.date).getTime() : 0
  const distance = Math.round((activity.distance || 0) / 10) * 10 // Round to nearest 10m
  const duration = Math.round((activity.duration || 0) / 10) * 10 // Round to nearest 10s
  
  return `${date}-${distance}-${duration}`
}

// Helper function to detect and filter out duplicates
function filterDuplicates(existing: SimpleActivity[], newActivities: SimpleActivity[]): {
  uniqueActivities: SimpleActivity[]
  duplicateCount: number
} {
  const existingFingerprints = new Set(existing.map(getActivityFingerprint))
  const uniqueActivities: SimpleActivity[] = []
  const seenFingerprints = new Set<string>()
  
  let duplicateCount = 0
  
  for (const activity of newActivities) {
    const fingerprint = getActivityFingerprint(activity)
    
    // Skip if already exists in current list or already seen in this batch
    if (existingFingerprints.has(fingerprint) || seenFingerprints.has(fingerprint)) {
      duplicateCount++
      continue
    }
    
    uniqueActivities.push(activity)
    seenFingerprints.add(fingerprint)
  }
  
  return { uniqueActivities, duplicateCount }
}

export const useActivities = create<ActivitiesState>()((set, get) => ({
    list: [],
    isLoading: false,
    error: undefined,
    lastUpdated: undefined,
    
    addActivities: (activities) => {
      const current = get().list
      const { uniqueActivities, duplicateCount } = filterDuplicates(current, activities)
      
      if (duplicateCount > 0) {
        console.log(`Filtered out ${duplicateCount} duplicate activities`)
      }
      
      const result: AddActivitiesResult = {
        total: activities.length,
        duplicates: duplicateCount,
        added: uniqueActivities.length
      }
      
      if (uniqueActivities.length === 0) {
        console.log('No new activities to add after duplicate filtering')
        return result
      }
      
      const next = [...current, ...uniqueActivities]
      
      // Save to localStorage asynchronously to prevent blocking
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            localStorage.setItem(KEY, JSON.stringify(next))
          } catch (error) {
            console.error('Failed to save activities:', error)
          }
        }, 0)
      }
      
      set({ list: next, lastUpdated: new Date().toISOString() })
      return result
    },

    addActivity: (activity) => {
      const current = get().list
      const { uniqueActivities, duplicateCount } = filterDuplicates(current, [activity])
      
      const result: AddActivitiesResult = {
        total: 1,
        duplicates: duplicateCount,
        added: uniqueActivities.length
      }
      
      if (duplicateCount > 0) {
        console.log('Activity already exists, skipping duplicate')
        return result
      }
      
      const id = activity.id || crypto.randomUUID()
      const activityWithId = { ...uniqueActivities[0], id }
      const next = [...current, activityWithId]
      
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            localStorage.setItem(KEY, JSON.stringify(next))
          } catch (error) {
            console.error('Failed to save activity:', error)
          }
        }, 0)
      }
      
      set({ list: next, lastUpdated: new Date().toISOString() })
      return result
    },

    updateActivity: (id, updates) => {
      const current = get().list
      const index = current.findIndex(a => a.id === id)
      if (index === -1) return
      
      const next = [...current]
      next[index] = { ...next[index], ...updates }
      
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            localStorage.setItem(KEY, JSON.stringify(next))
          } catch (error) {
            console.error('Failed to update activity:', error)
          }
        }, 0)
      }
      
      set({ list: next })
    },

    removeActivity: (id) => {
      const current = get().list
      const next = current.filter(a => a.id !== id)
      
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            localStorage.setItem(KEY, JSON.stringify(next))
          } catch (error) {
            console.error('Failed to remove activity:', error)
          }
        }, 0)
      }
      
      set({ list: next })
    },

    getById: (id) => {
      return get().list.find(a => a.id === id)
    },

    getByDateRange: (start, end) => {
      const startDate = new Date(start)
      const endDate = new Date(end)
      
      return get().list.filter(activity => {
        if (!activity.date) return false
        const activityDate = new Date(activity.date)
        return activityDate >= startDate && activityDate <= endDate
      })
    },

    clear: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(KEY)
      }
      set({ 
        list: [], 
        error: undefined, 
        lastUpdated: new Date().toISOString() 
      })
    },
    hydrate: async () => {
      if (typeof window === 'undefined') return Promise.resolve()
      
      set({ isLoading: true, error: undefined })
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            const raw = localStorage.getItem(KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              
              if (Array.isArray(parsed) && parsed.length > 5000) {
                console.warn(`Too many activities (${parsed.length}), truncating to last 1000 for performance`)
                const truncated = parsed.slice(-1000)
                set({ 
                  list: truncated, 
                  isLoading: false,
                  lastUpdated: new Date().toISOString(),
                  error: undefined
                })
                // Update localStorage with truncated data asynchronously
                setTimeout(() => {
                  try {
                    localStorage.setItem(KEY, JSON.stringify(truncated))
                  } catch (error) {
                    console.error('Failed to update localStorage:', error)
                  }
                }, 100)
              } else {
                set({ 
                  list: parsed, 
                  isLoading: false,
                  lastUpdated: new Date().toISOString(),
                  error: undefined
                })
              }
            } else {
              set({ 
                list: [], 
                isLoading: false,
                lastUpdated: new Date().toISOString(),
                error: undefined
              })
            }
          } catch (error) {
            console.error('Failed to hydrate activities:', error)
            set({ 
              list: [], 
              isLoading: false, 
              error: 'Failed to load activities' 
            })
          }
          resolve()
        }, 0)
      })
    }
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

// Optimized selectors for better performance
export const activitiesSelectors = {
  // Get recent activities (last N)
  getRecent: (limit = 20) => (state: { list: SimpleActivity[] }) => 
    state.list.slice(-limit),
  
  // Get activities with GPS data
  getWithGPS: () => (state: { list: SimpleActivity[] }) =>
    state.list.filter(a => a.trackPoints && a.trackPoints.length > 0),
  
  // Get activities by date range  
  getByDateRange: (start: string, end: string) => (state: { list: SimpleActivity[] }) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return state.list.filter(activity => {
      if (!activity.date) return false
      const activityDate = new Date(activity.date)
      return activityDate >= startDate && activityDate <= endDate
    })
  },
  
  // Get total stats
  getTotalStats: () => (state: { list: SimpleActivity[] }) => {
    const activities = state.list
    return {
      totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000, // km
      totalDuration: activities.reduce((sum, a) => sum + (a.duration || 0), 0), // seconds
      totalActivities: activities.length,
      activitiesWithDates: activities.filter(a => a.date).length,
      activitiesWithGPS: activities.filter(a => a.trackPoints && a.trackPoints.length > 0).length
    }
  },
  
  // Get performance optimized dashboard data
  getDashboardData: () => (state: { list: SimpleActivity[] }) => {
    const activities = state.list.slice(-100) // Only process last 100 for performance
    return {
      weekly: weeklyMileageKm(activities),
      thisWeekKm: last7DaysMileageKm(activities),
      totalActivities: state.list.length,
      activitiesWithDates: activitiesWithDatesCount(state.list)
    }
  }
}
