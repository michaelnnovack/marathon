import { create } from 'zustand'
import type { ActivitiesState, SimpleActivity } from '@/types'

const KEY = 'mt_activities'

// Database integration - dynamically imported to avoid SSR issues
let databaseModule: any = null
let useDatabaseFirst = false

// Lazy load database functions
const loadDatabaseModule = async () => {
  if (typeof window === 'undefined') return null
  
  if (!databaseModule) {
    try {
      const [dbModule, queriesModule, migrationModule] = await Promise.all([
        import('@/lib/database'),
        import('@/lib/database/queries'), 
        import('@/lib/database/migration')
      ])
      databaseModule = {
        ...dbModule,
        ...queriesModule,
        ...migrationModule
      }
    } catch (error) {
      console.warn('Failed to load database modules:', error)
      return null
    }
  }
  return databaseModule
}

export const useActivities = create<ActivitiesState>()((set, get) => ({
    list: [],
    isLoading: false,
    error: undefined,
    lastUpdated: undefined,
    
    addActivities: () => {
      console.warn('Manual data input is disabled. Activities are synced from intervals.icu only.')
      return { total: 0, duplicates: 0, added: 0 }
    },

    addActivity: () => {
      console.warn('Manual data input is disabled. Activities are synced from intervals.icu only.')
      return { total: 0, duplicates: 0, added: 0 }
    },

    updateActivity: () => {
      console.warn('Manual data modification is disabled. Data is managed by intervals.icu.')
    },

    removeActivity: () => {
      console.warn('Manual data removal is disabled. Data is managed by intervals.icu.')
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
        // Clear intervals.icu cache
        localStorage.removeItem(KEY)
        // Clear any potential legacy data
        localStorage.removeItem('mt_activities_old')
        localStorage.removeItem('mt_uploaded_activities') 
        localStorage.removeItem('mt_manual_activities')
        console.log('Cleared all activity data - intervals.icu data will be resynced on next hydrate')
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
      
      try {
        // Try to load database module
        const db = await loadDatabaseModule()
        
        if (db) {
          try {
            // Check if migration is needed and perform it
            if (!useDatabaseFirst && await db.isMigrationNeeded()) {
              console.log('Performing database migration...')
              const migrationResult = await db.migrateFromLocalStorage()
              
              if (migrationResult.success) {
                console.log('Migration completed successfully')
                useDatabaseFirst = true
              } else {
                console.warn('Migration completed with warnings:', migrationResult.warnings)
                console.error('Migration errors:', migrationResult.errors)
              }
            }

            // Try database-first approach if available
            if (useDatabaseFirst) {
              try {
                console.log('Loading activities from SQLite database...')
                const dbActivities = await db.getRecentActivities(200)
                
                if (dbActivities.length > 0) {
                  console.log(`Loaded ${dbActivities.length} activities from database`)
                  
                  set({ 
                    list: dbActivities, 
                    isLoading: false,
                    lastUpdated: new Date().toISOString(),
                    error: undefined
                  })
                  
                  // Also refresh from intervals.icu in background
                  get().refreshFromIntervalsIcu(200).catch(console.warn)
                  return
                }
              } catch (dbError) {
                console.warn('Failed to load from database, falling back to API:', dbError)
              }
            }
          } catch (dbInitError) {
            console.warn('Database initialization failed, using localStorage mode:', dbInitError)
          }
        }

        // Fallback to original localStorage + API approach
        await get().loadFromIntervalsIcu()

      } catch (error) {
        console.error('Hydration failed:', error)
        set({ 
          list: [], 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to load activities'
        })
      }
    },

    // Helper method to load from intervals.icu (extracted for reuse)
    loadFromIntervalsIcu: async () => {
      // Clear any old non-intervals.icu data first
      console.log('Clearing any existing non-intervals.icu data...')
      localStorage.removeItem('mt_activities_old')
      localStorage.removeItem('mt_uploaded_activities') 
      localStorage.removeItem('mt_manual_activities')
      
      try {
        console.log('Fetching activities from intervals.icu...')
        
        // Fetch activities from our intervals.icu API endpoint
        const response = await fetch('/api/intervals/activities?limit=200&runningOnly=true')
        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch activities from intervals.icu')
        }
        
        const activities = data.activities || []
        console.log(`Successfully loaded ${activities.length} activities from intervals.icu`)
        
        // Store in both localStorage and database
        try {
          // Cache the data in localStorage for offline access
          localStorage.setItem(KEY, JSON.stringify(activities))
          
          // Store in database if available
          if (useDatabaseFirst && databaseModule) {
            const dbActivities = activities.map(activity => ({
              ...activity,
              source: 'intervals_icu',
              synced_at: new Date().toISOString()
            }))
            await databaseModule.upsertActivities(dbActivities)
            console.log('Activities synced to database')
          }
        } catch (storageError) {
          console.warn('Failed to cache/store activities:', storageError)
        }
        
        // Clear distance calculation cache when new data is loaded
        clearDistanceCache()
        
        set({ 
          list: activities, 
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          error: undefined
        })
        
      } catch (error) {
        console.error('Failed to fetch activities from intervals.icu:', error)
        
        // Try to load from cache as fallback
        await get().loadFromCache()
      }
    },

    // Helper method to load from cache (localStorage or database)
    loadFromCache: async () => {
      try {
        // Try database first if available
        if (useDatabaseFirst && databaseModule) {
          const dbActivities = await databaseModule.getRecentActivities(200)
          if (dbActivities.length > 0) {
            console.log(`Loaded ${dbActivities.length} activities from database cache`)
            set({ 
              list: dbActivities, 
              isLoading: false,
              error: 'Using database cache - intervals.icu API unavailable',
              lastUpdated: new Date().toISOString(),
            })
            return
          }
        }

        // Fallback to localStorage cache
        const cached = localStorage.getItem(KEY)
        if (cached) {
          const cachedActivities = JSON.parse(cached)
          if (Array.isArray(cachedActivities)) {
            console.log(`Loaded ${cachedActivities.length} activities from localStorage cache as fallback`)
            
            set({ 
              list: cachedActivities, 
              isLoading: false,
              error: 'Using localStorage cache - intervals.icu API unavailable',
              lastUpdated: new Date().toISOString(),
            })
            return
          }
        }

        throw new Error('No cached data available')
      } catch (cacheError) {
        console.error('Failed to load any cached activities:', cacheError)
        set({ 
          list: [], 
          isLoading: false, 
          error: 'No activities available - check intervals.icu connection'
        })
      }
    },

    // Add method to refresh activities from intervals.icu
    refreshFromIntervalsIcu: async (limit = 200) => {
      const current = get()
      set({ isLoading: true, error: undefined })
      
      try {
        console.log('Refreshing activities from intervals.icu...')
        
        const response = await fetch(`/api/intervals/activities?limit=${limit}&runningOnly=true`)
        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to refresh activities from intervals.icu')
        }
        
        const activities = data.activities || []
        console.log(`Refreshed ${activities.length} activities from intervals.icu`)
        
        // Store in both localStorage and database
        try {
          // Cache the updated data in localStorage
          localStorage.setItem(KEY, JSON.stringify(activities))
          
          // Store in database if available
          if (useDatabaseFirst && databaseModule) {
            const dbActivities = activities.map(activity => ({
              ...activity,
              source: 'intervals_icu',
              synced_at: new Date().toISOString()
            }))
            await databaseModule.upsertActivities(dbActivities)
            console.log('Refreshed activities synced to database')
          }
        } catch (storageError) {
          console.warn('Failed to cache/store refreshed activities:', storageError)
        }
        
        // Clear distance calculation cache when data is refreshed
        clearDistanceCache()
        
        set({ 
          list: activities, 
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          error: undefined
        })
        
      } catch (error) {
        console.error('Failed to refresh activities from intervals.icu:', error)
        set({ 
          ...current,
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to refresh activities'
        })
      }
    }
  }))

export function weeklyMileageKm(list: SimpleActivity[]) {
  // Safety checks
  if (!Array.isArray(list) || list.length === 0) {
    console.log('Weekly mileage: No activities found')
    return []
  }
  
  // Safety limit to prevent browser freezing
  if (list.length > 1000) {
    console.warn('Too many activities for weekly mileage calculation, truncating to last 1000')
    list = list.slice(-1000)
  }
  
  const byWeek = new Map<string, number>()
  for (const a of list) {
    if (!a || !a.date || typeof a.distance !== 'number' || isNaN(a.distance)) continue
    
    try {
      const d = new Date(a.date)
      if (isNaN(d.getTime())) continue // Invalid date
      
      const monday = new Date(d)
      const day = monday.getDay() || 7
      if (day !== 1) monday.setHours(-24 * (day - 1))
      monday.setHours(0,0,0,0)
      const key = monday.toISOString().slice(0,10)
      byWeek.set(key, (byWeek.get(key) || 0) + Math.max(0, a.distance/1000))
    } catch (error) {
      console.warn('Error processing activity date:', a.date, error)
      continue
    }
  }
  
  const result = Array.from(byWeek.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([week, km])=>({week, km}))
  if (process.env.NODE_ENV === 'development') {
    console.log(`Weekly mileage calculation: ${result.length} weeks, last 4 weeks:`, result.slice(-4))
  }
  return result
}

// Memoized version for better performance
let last7DaysCache: { data: number, checksum: string, timestamp: number } | null = null
const CACHE_DURATION = 30 * 1000 // 30 seconds for more frequent updates

// Function to clear the distance calculation cache
export function clearDistanceCache() {
  last7DaysCache = null
  if (process.env.NODE_ENV === 'development') {
    console.log('Distance calculation cache cleared')
  }
}

export function last7DaysMileageKm(list: SimpleActivity[]) {
  // Safety checks
  if (!Array.isArray(list) || list.length === 0) {
    return 0
  }
  
  // Safety limit to prevent browser freezing  
  if (list.length > 1000) {
    console.warn('Too many activities for 7-day calculation, truncating to last 1000')
    list = list.slice(-1000)
  }
  
  // Create better checksum for caching that includes recent activity data
  const now = Date.now()
  const recentActivities = list.slice(-10) // Use last 10 activities for checksum
  const activitiesChecksum = recentActivities
    .map(a => `${a.id}-${a.date}-${a.distance}`)
    .join('|')
  const checksum = `${list.length}-${activitiesChecksum.slice(0, 50)}-${Math.floor(now / (60 * 1000))}` // Cache for 1 minute
  
  if (last7DaysCache && 
      last7DaysCache.checksum === checksum && 
      (now - last7DaysCache.timestamp) < CACHE_DURATION) {
    return last7DaysCache.data
  }
  
  const currentDate = new Date()
  const sevenDaysAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const filteredActivities = list.filter(a => {
    if (!a || !a.date || typeof a.distance !== 'number' || isNaN(a.distance)) return false
    try {
      const activityDate = new Date(a.date)
      const isValidDate = !isNaN(activityDate.getTime())
      const isInRange = activityDate >= sevenDaysAgo && activityDate <= currentDate
      return isValidDate && isInRange
    } catch {
      console.warn('Invalid date in activity:', a.id, a.date)
      return false
    }
  })
  
  const result = filteredActivities.reduce((total, a) => total + Math.max(0, a.distance / 1000), 0)
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`7-day calculation: ${filteredActivities.length} activities found, ${result.toFixed(1)} km total`)
  }
  
  // Cache the result
  last7DaysCache = { data: result, checksum, timestamp: now }
  
  return result
}

export function activitiesWithDatesCount(list: SimpleActivity[]) {
  if (!Array.isArray(list)) return 0
  return list.filter(a => a && a.date).length
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
