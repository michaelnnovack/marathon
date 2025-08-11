import { useMemo } from 'react'
import { useActivities } from '@/store/activities'

// Performance optimized hook that provides chunked data access
export function usePerformantActivities(maxItems = 50) {
  const activities = useActivities()
  
  const optimizedData = useMemo(() => {
    const list = activities.list
    
    // For very large datasets, provide different data slices
    if (list.length > 1000) {
      return {
        recent: list.slice(-maxItems), // Most recent items
        withGPS: list.filter(a => a.trackPoints?.length).slice(-20), // Recent GPS activities
        summary: {
          total: list.length,
          totalDistance: list.reduce((sum, a) => sum + (a.distance || 0), 0),
          isLargeDataset: true
        }
      }
    }
    
    // For normal datasets, provide full access
    return {
      recent: list.slice(-maxItems),
      withGPS: list.filter(a => a.trackPoints?.length),
      all: list,
      summary: {
        total: list.length,
        totalDistance: list.reduce((sum, a) => sum + (a.distance || 0), 0),
        isLargeDataset: false
      }
    }
  }, [activities.list, maxItems])
  
  return {
    ...activities,
    ...optimizedData,
    isLoading: activities.isLoading
  }
}