/**
 * Performance-optimized database queries for real-time coach calculations
 * 
 * Features:
 * - Prepared statements for repeated queries
 * - Efficient aggregation queries
 * - Materialized view-like caching
 * - Batch operations for bulk updates
 * - Query result caching with TTL
 */

import { Database } from 'sql.js'
import { getDatabase } from './index'
import type { SimpleActivity } from '@/types'

// ===== QUERY RESULT CACHING =====

interface QueryCache<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

const queryCache = new Map<string, QueryCache<any>>()

function getCachedResult<T>(key: string): T | null {
  const cached = queryCache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    queryCache.delete(key)
    return null
  }
  
  return cached.data as T
}

function setCachedResult<T>(key: string, data: T, ttlMs = 300000): void { // Default 5 min TTL
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  })
}

// ===== PREPARED STATEMENT MANAGEMENT =====

class PreparedStatementManager {
  private db: Database | null = null
  private statements = new Map<string, any>()

  async initialize() {
    if (!this.db) {
      this.db = await getDatabase()
    }
  }

  getOrPrepare(key: string, sql: string) {
    if (!this.db) throw new Error('Database not initialized')
    
    if (!this.statements.has(key)) {
      const stmt = this.db.prepare(sql)
      this.statements.set(key, stmt)
    }
    
    return this.statements.get(key)
  }

  cleanup() {
    for (const [key, stmt] of this.statements) {
      try {
        stmt.free()
      } catch (error) {
        console.warn(`Failed to free statement ${key}:`, error)
      }
    }
    this.statements.clear()
  }
}

const stmtManager = new PreparedStatementManager()

// ===== OPTIMIZED ACTIVITY QUERIES =====

/**
 * Get activities with smart pagination and caching
 * Uses prepared statements for optimal performance
 */
export async function getActivitiesOptimized(params: {
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
  useCache?: boolean
}): Promise<SimpleActivity[]> {
  const cacheKey = `activities_${JSON.stringify(params)}`
  
  if (params.useCache !== false) {
    const cached = getCachedResult<SimpleActivity[]>(cacheKey)
    if (cached) return cached
  }

  await stmtManager.initialize()
  
  const bindings: any[] = ['michael'] // user_id
  let sql = `
    SELECT 
      id, date, distance, duration, avg_hr, max_hr, elevation_gain, 
      calories, avg_pace, type, track_points
    FROM activities 
    WHERE user_id = ?
  `

  if (params.startDate) {
    sql += ' AND date >= ?'
    bindings.push(params.startDate)
  }

  if (params.endDate) {
    sql += ' AND date <= ?'
    bindings.push(params.endDate)
  }

  sql += ' ORDER BY date DESC'

  if (params.limit) {
    sql += ' LIMIT ?'
    bindings.push(params.limit)

    if (params.offset) {
      sql += ' OFFSET ?'
      bindings.push(params.offset)
    }
  }

  const stmt = stmtManager.getOrPrepare('get_activities', sql)
  const result = stmt.get(bindings)
  
  const activities = formatResultToActivities(result)
  setCachedResult(cacheKey, activities, 180000) // 3 min cache
  
  return activities
}

/**
 * Get weekly mileage aggregation using optimized SQL
 * Much faster than JavaScript calculation for large datasets
 */
export async function getWeeklyMileageOptimized(weeks = 12): Promise<{
  week: string
  km: number
  activities: number
  avgPace?: number
}[]> {
  const cacheKey = `weekly_mileage_${weeks}`
  const cached = getCachedResult<any[]>(cacheKey)
  if (cached) return cached

  const db = await getDatabase()
  
  const sql = `
    SELECT 
      DATE(date, 'weekday 1', '-7 days') as week_start,
      ROUND(SUM(distance) / 1000.0, 2) as total_km,
      COUNT(*) as activity_count,
      ROUND(AVG(CASE WHEN avg_pace > 0 THEN avg_pace ELSE NULL END), 2) as avg_pace
    FROM activities 
    WHERE user_id = 'michael' 
      AND date >= DATE('now', '-${weeks * 7} days')
    GROUP BY DATE(date, 'weekday 1', '-7 days')
    ORDER BY week_start DESC
    LIMIT ${weeks}
  `

  const result = db.exec(sql)
  
  if (result.length === 0) return []

  const columns = result[0].columns as string[]
  const values = result[0].values as any[][]

  const weeklyData = values.map(row => {
    const obj: any = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return {
      week: obj.week_start,
      km: obj.total_km || 0,
      activities: obj.activity_count || 0,
      avgPace: obj.avg_pace
    }
  })

  setCachedResult(cacheKey, weeklyData, 600000) // 10 min cache
  return weeklyData
}

/**
 * Get last N days distance optimized with single query
 */
export async function getLastNDaysDistanceOptimized(days = 7): Promise<number> {
  const cacheKey = `last_${days}_days_distance`
  const cached = getCachedResult<number>(cacheKey)
  if (cached !== null) return cached

  const db = await getDatabase()
  
  const sql = `
    SELECT COALESCE(SUM(distance), 0) / 1000.0 as total_km
    FROM activities 
    WHERE user_id = 'michael' 
      AND date >= DATE('now', '-${days} days')
  `

  const result = db.exec(sql)
  
  const totalKm = result.length > 0 && result[0].values.length > 0 
    ? result[0].values[0][0] as number 
    : 0

  setCachedResult(cacheKey, totalKm, 60000) // 1 min cache
  return totalKm
}

/**
 * Get activity type distribution for coaching insights
 */
export async function getActivityTypeDistributionOptimized(days = 90): Promise<{
  type: string
  count: number
  totalDistance: number
  avgDuration: number
  percentage: number
}[]> {
  const cacheKey = `activity_types_${days}`
  const cached = getCachedResult<any[]>(cacheKey)
  if (cached) return cached

  const db = await getDatabase()
  
  const sql = `
    WITH type_stats AS (
      SELECT 
        type,
        COUNT(*) as count,
        SUM(distance) / 1000.0 as total_distance,
        AVG(duration) as avg_duration
      FROM activities
      WHERE user_id = 'michael' 
        AND date >= DATE('now', '-${days} days')
      GROUP BY type
    ),
    total_count AS (
      SELECT SUM(count) as total FROM type_stats
    )
    SELECT 
      t.type,
      t.count,
      ROUND(t.total_distance, 2) as total_distance,
      ROUND(t.avg_duration, 0) as avg_duration,
      ROUND(t.count * 100.0 / tc.total, 1) as percentage
    FROM type_stats t
    CROSS JOIN total_count tc
    ORDER BY t.count DESC
  `

  const result = db.exec(sql)
  
  if (result.length === 0) return []

  const columns = result[0].columns as string[]
  const values = result[0].values as any[][]

  const distribution = values.map(row => {
    const obj: any = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })

  setCachedResult(cacheKey, distribution, 1800000) // 30 min cache
  return distribution
}

// ===== OPTIMIZED FITNESS METRICS QUERIES =====

/**
 * Get fitness trend data optimized for charts
 */
export async function getFitnessTrendOptimized(days = 90): Promise<{
  date: string
  ctl: number
  atl: number
  tsb: number
  dailyTSS: number
}[]> {
  const cacheKey = `fitness_trend_${days}`
  const cached = getCachedResult<any[]>(cacheKey)
  if (cached) return cached

  const db = await getDatabase()
  
  const sql = `
    SELECT 
      date,
      chronic_training_load as ctl,
      acute_training_load as atl,
      training_stress_balance as tsb,
      daily_training_stress as dailyTSS
    FROM fitness_metrics 
    WHERE user_id = 'michael' 
      AND date >= DATE('now', '-${days} days')
    ORDER BY date ASC
  `

  const result = db.exec(sql)
  
  if (result.length === 0) return []

  const columns = result[0].columns as string[]
  const values = result[0].values as any[][]

  const trendData = values.map(row => {
    const obj: any = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })

  setCachedResult(cacheKey, trendData, 900000) // 15 min cache
  return trendData
}

/**
 * Get coaching readiness score optimized
 */
export async function getCoachingReadinessOptimized(): Promise<{
  fitnessLevel: number
  fatigueLevel: number
  formLevel: number
  readinessScore: number
  daysSinceLastRest: number
  recommendation: string
}> {
  const cacheKey = 'coaching_readiness'
  const cached = getCachedResult<any>(cacheKey)
  if (cached) return cached

  const db = await getDatabase()
  
  // Get current fitness state
  const fitnessSQL = `
    SELECT 
      fitness_level,
      fatigue_level, 
      form_level,
      training_stress_balance as tsb
    FROM fitness_metrics 
    WHERE user_id = 'michael'
    ORDER BY date DESC 
    LIMIT 1
  `

  // Get days since last rest
  const restSQL = `
    SELECT 
      CAST((JULIANDAY('now') - JULIANDAY(MAX(date))) AS INTEGER) as days_since_rest
    FROM activities 
    WHERE user_id = 'michael' 
      AND (type = 'recovery' OR distance = 0 OR duration < 1800)
  `

  const [fitnessResult, restResult] = [
    db.exec(fitnessSQL),
    db.exec(restSQL)
  ]

  let readinessData = {
    fitnessLevel: 50,
    fatigueLevel: 50,
    formLevel: 0,
    readinessScore: 50,
    daysSinceLastRest: 0,
    recommendation: 'Insufficient data for recommendation'
  }

  if (fitnessResult.length > 0 && fitnessResult[0].values.length > 0) {
    const fitness = fitnessResult[0].values[0]
    const [fitnessLvl, fatigueLvl, formLvl, tsb] = fitness

    const daysSinceRest = restResult.length > 0 && restResult[0].values.length > 0
      ? restResult[0].values[0][0] as number
      : 0

    // Calculate readiness score
    let readinessScore = 50
    
    if (formLvl > 10) readinessScore += 20        // Good form
    else if (formLvl < -15) readinessScore -= 30  // Poor form
    
    if (fitnessLvl > 70) readinessScore += 15     // High fitness
    else if (fitnessLvl < 30) readinessScore -= 10 // Low fitness
    
    if (fatigueLvl > 80) readinessScore -= 25     // High fatigue
    else if (fatigueLvl < 40) readinessScore += 15 // Low fatigue
    
    if (daysSinceRest > 6) readinessScore -= 20   // Overdue for rest
    else if (daysSinceRest < 2) readinessScore += 10 // Well rested

    readinessScore = Math.max(0, Math.min(100, readinessScore))

    // Generate recommendation
    let recommendation = ''
    if (readinessScore > 80) recommendation = 'Ready for high-intensity training'
    else if (readinessScore > 60) recommendation = 'Good for moderate training'
    else if (readinessScore > 40) recommendation = 'Easy training recommended'
    else recommendation = 'Recovery or rest day advised'

    readinessData = {
      fitnessLevel: fitnessLvl as number,
      fatigueLevel: fatigueLvl as number,
      formLevel: formLvl as number,
      readinessScore,
      daysSinceLastRest: daysSinceRest,
      recommendation
    }
  }

  setCachedResult(cacheKey, readinessData, 300000) // 5 min cache
  return readinessData
}

// ===== OPTIMIZED AGGREGATION QUERIES =====

/**
 * Get comprehensive dashboard stats in single optimized query
 */
export async function getDashboardStatsOptimized(): Promise<{
  totalActivities: number
  totalDistance: number
  totalDuration: number
  thisWeekKm: number
  thisMonthKm: number
  avgWeeklyKm: number
  currentStreak: number
  longestStreak: number
  activeDays: number
}> {
  const cacheKey = 'dashboard_stats'
  const cached = getCachedResult<any>(cacheKey)
  if (cached) return cached

  const db = await getDatabase()
  
  const sql = `
    WITH activity_stats AS (
      SELECT 
        COUNT(*) as total_activities,
        SUM(distance) / 1000.0 as total_distance,
        SUM(duration) as total_duration,
        COUNT(DISTINCT DATE(date)) as active_days
      FROM activities 
      WHERE user_id = 'michael'
    ),
    this_week AS (
      SELECT COALESCE(SUM(distance), 0) / 1000.0 as this_week_km
      FROM activities 
      WHERE user_id = 'michael' 
        AND date >= DATE('now', 'weekday 1', '-7 days')
    ),
    this_month AS (
      SELECT COALESCE(SUM(distance), 0) / 1000.0 as this_month_km
      FROM activities 
      WHERE user_id = 'michael' 
        AND date >= DATE('now', 'start of month')
    ),
    weekly_avg AS (
      SELECT AVG(weekly_km) as avg_weekly_km
      FROM (
        SELECT SUM(distance) / 1000.0 as weekly_km
        FROM activities 
        WHERE user_id = 'michael' 
          AND date >= DATE('now', '-84 days')
        GROUP BY DATE(date, 'weekday 1', '-7 days')
      )
    )
    SELECT 
      a.total_activities,
      ROUND(a.total_distance, 2) as total_distance,
      a.total_duration,
      ROUND(tw.this_week_km, 2) as this_week_km,
      ROUND(tm.this_month_km, 2) as this_month_km,
      ROUND(wa.avg_weekly_km, 2) as avg_weekly_km,
      a.active_days
    FROM activity_stats a
    CROSS JOIN this_week tw
    CROSS JOIN this_month tm  
    CROSS JOIN weekly_avg wa
  `

  const result = db.exec(sql)
  
  let stats = {
    totalActivities: 0,
    totalDistance: 0,
    totalDuration: 0,
    thisWeekKm: 0,
    thisMonthKm: 0,
    avgWeeklyKm: 0,
    currentStreak: 0,
    longestStreak: 0,
    activeDays: 0
  }

  if (result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0]
    const columns = result[0].columns

    columns.forEach((col, idx) => {
      if (col in stats) {
        (stats as any)[col] = row[idx] || 0
      }
    })

    // Calculate streaks (requires separate query for complexity)
    const streaks = await calculateStreaksOptimized()
    stats.currentStreak = streaks.current
    stats.longestStreak = streaks.longest
  }

  setCachedResult(cacheKey, stats, 600000) // 10 min cache
  return stats
}

/**
 * Calculate activity streaks optimized
 */
async function calculateStreaksOptimized(): Promise<{ current: number; longest: number }> {
  const db = await getDatabase()
  
  // Get distinct activity dates in descending order
  const sql = `
    SELECT DISTINCT DATE(date) as activity_date
    FROM activities 
    WHERE user_id = 'michael'
    ORDER BY activity_date DESC
    LIMIT 365
  `

  const result = db.exec(sql)
  
  if (result.length === 0 || result[0].values.length === 0) {
    return { current: 0, longest: 0 }
  }

  const dates = result[0].values.map(row => new Date(row[0] as string))
  
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Check current streak
  let checkDate = new Date(today)
  for (const activityDate of dates) {
    const actDate = new Date(activityDate)
    actDate.setHours(0, 0, 0, 0)
    
    if (actDate.getTime() === checkDate.getTime()) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (actDate.getTime() < checkDate.getTime() - 86400000) {
      // Gap found, stop current streak calculation
      break
    }
  }
  
  // Calculate longest streak
  let lastDate: Date | null = null
  for (const activityDate of dates.reverse()) { // Reverse to go chronological
    const actDate = new Date(activityDate)
    actDate.setHours(0, 0, 0, 0)
    
    if (lastDate) {
      const daysDiff = (actDate.getTime() - lastDate.getTime()) / 86400000
      
      if (daysDiff === 1) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    } else {
      tempStreak = 1
    }
    
    lastDate = actDate
  }
  
  longestStreak = Math.max(longestStreak, tempStreak)
  
  return { current: currentStreak, longest: longestStreak }
}

// ===== HELPER FUNCTIONS =====

function formatResultToActivities(result: any[]): SimpleActivity[] {
  if (result.length === 0) return []
  
  const columns = result[0].columns as string[]
  const values = result[0].values as any[][]

  return values.map(row => {
    const activity: any = {}
    columns.forEach((col, idx) => {
      const value = row[idx]
      
      if (col === 'track_points' && value) {
        try {
          activity.trackPoints = JSON.parse(value as string)
        } catch {
          activity.trackPoints = []
        }
      } else {
        // Convert snake_case to camelCase
        const camelKey = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        activity[camelKey] = value
      }
    })
    
    return activity as SimpleActivity
  })
}

/**
 * Clear all query caches (useful when data changes)
 */
export function clearQueryCache(): void {
  queryCache.clear()
  console.log('Query cache cleared')
}

/**
 * Get cache statistics for monitoring
 */
export function getQueryCacheStats(): {
  size: number
  keys: string[]
  totalMemoryEstimate: number
} {
  const keys = Array.from(queryCache.keys())
  const totalMemory = keys.reduce((sum, key) => {
    const data = queryCache.get(key)?.data
    return sum + (data ? JSON.stringify(data).length * 2 : 0) // Rough estimate
  }, 0)

  return {
    size: queryCache.size,
    keys,
    totalMemoryEstimate: totalMemory
  }
}

/**
 * Cleanup function to free prepared statements
 */
export function cleanupOptimizedQueries(): void {
  stmtManager.cleanup()
  clearQueryCache()
  console.log('Optimized queries cleaned up')
}