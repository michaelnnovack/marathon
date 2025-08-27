import { BaseDAO } from './base'
import type { SimpleActivity } from '@/types'

interface ActivityRow {
  id: string
  user_id: string
  date: string
  distance: number
  duration: number
  avg_hr?: number
  max_hr?: number
  elevation_gain?: number
  calories?: number
  avg_pace?: number
  type?: string
  track_points_json?: string
  intervals_icu_id?: string
  created_at: string
  updated_at: string
  training_stress_score?: number
}

/**
 * Data Access Object for Activities with optimized queries for coach calculations
 */
export class ActivitiesDAO extends BaseDAO {
  private insertStatement = this.db.prepare(`
    INSERT OR REPLACE INTO activities (
      id, user_id, date, distance, duration, avg_hr, max_hr,
      elevation_gain, calories, avg_pace, type, track_points_json,
      intervals_icu_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  private selectByIdStatement = this.db.prepare(`
    SELECT * FROM activities WHERE id = ?
  `)

  private selectByUserStatement = this.db.prepare(`
    SELECT * FROM activities 
    WHERE user_id = ? 
    ORDER BY date DESC
    LIMIT ?
  `)

  private selectByDateRangeStatement = this.db.prepare(`
    SELECT * FROM activities 
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC
  `)

  private selectRecentStatement = this.db.prepare(`
    SELECT * FROM activities 
    WHERE user_id = ? AND date >= date('now', '-90 days')
    ORDER BY date DESC
  `)

  private deleteStatement = this.db.prepare(`
    DELETE FROM activities WHERE id = ?
  `)

  private selectWeeklyStatsStatement = this.db.prepare(`
    SELECT 
      strftime('%Y-%W', date) as week,
      COUNT(*) as activity_count,
      SUM(distance) as total_distance,
      SUM(duration) as total_duration,
      AVG(avg_pace) as avg_pace,
      SUM(elevation_gain) as total_elevation,
      AVG(training_stress_score) as avg_tss
    FROM activities
    WHERE user_id = ? AND date >= date('now', '-365 days')
    GROUP BY strftime('%Y-%W', date)
    ORDER BY week DESC
    LIMIT ?
  `)

  private selectTrainingLoadStatement = this.db.prepare(`
    SELECT 
      date,
      distance,
      duration,
      training_stress_score,
      CASE 
        WHEN training_stress_score IS NOT NULL THEN training_stress_score
        ELSE (duration / 3600.0) * 100  -- Fallback TSS calculation
      END as calculated_tss
    FROM activities
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `)

  /**
   * Insert or update activity
   */
  async insertActivity(activity: SimpleActivity, userId: string): Promise<void> {
    const now = this.getCurrentTimestamp()
    
    this.executeWithRetry(this.insertStatement, [
      activity.id || `activity_${Date.now()}`,
      userId,
      activity.date || now,
      activity.distance,
      activity.duration,
      activity.avgHr || null,
      activity.maxHr || null,
      activity.elevationGain || null,
      activity.calories || null,
      activity.avgPace || null,
      activity.type || null,
      this.toJsonString(activity.trackPoints),
      null, // intervals_icu_id - will be set separately
      now,
      now
    ])
  }

  /**
   * Bulk insert activities with transaction for performance
   */
  async bulkInsertActivities(activities: SimpleActivity[], userId: string): Promise<number> {
    if (activities.length === 0) return 0

    let insertedCount = 0
    const now = this.getCurrentTimestamp()

    this.executeTransaction(() => {
      for (const activity of activities) {
        try {
          this.insertStatement.run(
            activity.id || `activity_${Date.now()}_${Math.random()}`,
            userId,
            activity.date || now,
            activity.distance,
            activity.duration,
            activity.avgHr || null,
            activity.maxHr || null,
            activity.elevationGain || null,
            activity.calories || null,
            activity.avgPace || null,
            activity.type || null,
            this.toJsonString(activity.trackPoints),
            null,
            now,
            now
          )
          insertedCount++
        } catch (error) {
          console.error('Failed to insert activity:', activity.id, error)
        }
      }
    })

    return insertedCount
  }

  /**
   * Get activity by ID
   */
  async getById(id: string): Promise<SimpleActivity | null> {
    const row = this.executeWithRetry(this.selectByIdStatement, [id]) as ActivityRow | undefined
    return row ? this.rowToActivity(row) : null
  }

  /**
   * Get activities by user with limit
   */
  async getByUser(userId: string, limit = 100): Promise<SimpleActivity[]> {
    const rows = this.db.prepare(this.selectByUserStatement.source).all(userId, limit) as ActivityRow[]
    return rows.map(row => this.rowToActivity(row))
  }

  /**
   * Get activities in date range - optimized for coach calculations
   */
  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<SimpleActivity[]> {
    if (!this.validateDateString(startDate) || !this.validateDateString(endDate)) {
      throw new Error('Invalid date format')
    }

    const rows = this.db.prepare(this.selectByDateRangeStatement.source).all(
      userId, startDate, endDate
    ) as ActivityRow[]
    
    return rows.map(row => this.rowToActivity(row))
  }

  /**
   * Get recent activities (last 90 days) - optimized query
   */
  async getRecent(userId: string): Promise<SimpleActivity[]> {
    const rows = this.db.prepare(this.selectRecentStatement.source).all(userId) as ActivityRow[]
    return rows.map(row => this.rowToActivity(row))
  }

  /**
   * Get weekly training statistics - optimized for coach analysis
   */
  async getWeeklyStats(userId: string, weeks = 52): Promise<Array<{
    week: string
    activityCount: number
    totalDistance: number
    totalDuration: number
    avgPace: number | null
    totalElevation: number | null
    avgTss: number | null
  }>> {
    const rows = this.db.prepare(this.selectWeeklyStatsStatement.source).all(userId, weeks) as Array<{
      week: string
      activity_count: number
      total_distance: number
      total_duration: number
      avg_pace: number | null
      total_elevation: number | null
      avg_tss: number | null
    }>

    return rows.map(row => ({
      week: row.week,
      activityCount: row.activity_count,
      totalDistance: row.total_distance,
      totalDuration: row.total_duration,
      avgPace: row.avg_pace,
      totalElevation: row.total_elevation,
      avgTss: row.avg_tss
    }))
  }

  /**
   * Get training load data for CTL/ATL calculations - highly optimized
   */
  async getTrainingLoad(userId: string, startDate: string, endDate: string): Promise<Array<{
    date: string
    distance: number
    duration: number
    trainingStressScore: number
  }>> {
    if (!this.validateDateString(startDate) || !this.validateDateString(endDate)) {
      throw new Error('Invalid date format')
    }

    const rows = this.db.prepare(this.selectTrainingLoadStatement.source).all(
      userId, startDate, endDate
    ) as Array<{
      date: string
      distance: number
      duration: number
      training_stress_score: number | null
      calculated_tss: number
    }>

    return rows.map(row => ({
      date: row.date,
      distance: row.distance,
      duration: row.duration,
      trainingStressScore: row.calculated_tss
    }))
  }

  /**
   * Update activity
   */
  async updateActivity(id: string, updates: Partial<SimpleActivity>): Promise<boolean> {
    const current = await this.getById(id)
    if (!current) return false

    const merged = { ...current, ...updates }
    await this.insertActivity(merged, 'michael') // TODO: get from context
    return true
  }

  /**
   * Delete activity
   */
  async deleteActivity(id: string): Promise<boolean> {
    const result = this.executeWithRetry(this.deleteStatement, [id])
    return (result as any).changes > 0
  }

  /**
   * Get activity count for user
   */
  async getActivityCount(userId: string): Promise<number> {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM activities WHERE user_id = ?
    `).get(userId) as { count: number }

    return result.count
  }

  /**
   * Get total distance for user
   */
  async getTotalDistance(userId: string): Promise<number> {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(distance), 0) as total FROM activities WHERE user_id = ?
    `).get(userId) as { total: number }

    return result.total
  }

  /**
   * Convert database row to SimpleActivity
   */
  private rowToActivity(row: ActivityRow): SimpleActivity {
    return {
      id: row.id,
      date: row.date,
      distance: row.distance,
      duration: row.duration,
      avgHr: row.avg_hr || undefined,
      maxHr: row.max_hr || undefined,
      elevationGain: row.elevation_gain || undefined,
      calories: row.calories || undefined,
      avgPace: row.avg_pace || undefined,
      type: row.type as any || undefined,
      trackPoints: this.fromJsonString(row.track_points_json) || undefined
    }
  }
}