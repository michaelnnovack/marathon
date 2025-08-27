import { getBrowserDatabase } from '../browser-db'
import { SimpleActivity } from '@/types'

/**
 * Browser-compatible Activities DAO with optimized queries for AI coach
 */
export class BrowserActivitiesDAO {
  /**
   * Get all activities for a user
   */
  async getAllActivities(userId: string): Promise<SimpleActivity[]> {
    const db = await getBrowserDatabase()
    return db.getRecentActivities(userId, 365) // Last year
  }

  /**
   * Get activities in date range (optimized for fitness calculations)
   */
  async getActivitiesInRange(userId: string, startDate: string, endDate: string): Promise<SimpleActivity[]> {
    const db = await getBrowserDatabase()
    return db.getActivitiesForDateRange(userId, startDate, endDate)
  }

  /**
   * Get recent activities (performance optimized)
   */
  async getRecentActivities(userId: string, limit: number = 100): Promise<SimpleActivity[]> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT * FROM activities 
      WHERE user_id = ? 
      ORDER BY date DESC 
      LIMIT ?
    `
    
    const rows = db.query(sql, [userId, limit])
    return rows.map(this.mapRowToActivity)
  }

  /**
   * Get weekly mileage data (optimized query)
   */
  async getWeeklyMileage(userId: string, weeks: number = 12): Promise<Array<{ week: string, km: number }>> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT 
        strftime('%Y-%W', date) as week,
        SUM(distance) / 1000.0 as km
      FROM activities 
      WHERE user_id = ? AND date >= date('now', '-${weeks * 7} days')
      GROUP BY strftime('%Y-%W', date)
      ORDER BY week DESC
    `
    
    return db.query(sql, [userId])
  }

  /**
   * Get last 7 days mileage (cached for performance)
   */
  async getLast7DaysMileage(userId: string): Promise<number> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT SUM(distance) / 1000.0 as km
      FROM activities 
      WHERE user_id = ? AND date >= date('now', '-7 days')
    `
    
    const result = db.query(sql, [userId])
    return result[0]?.km || 0
  }

  /**
   * Get training load progression (CTL/ATL data for charts)
   */
  async getTrainingLoadProgression(userId: string, days: number = 90): Promise<Array<{
    date: string
    ctl: number
    atl: number 
    tsb: number
  }>> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT date, ctl, atl, tsb
      FROM fitness_calculations
      WHERE user_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date ASC
    `
    
    return db.query(sql, [userId])
  }

  /**
   * Get current fitness status for AI coach
   */
  async getCurrentFitness(userId: string): Promise<{ ctl: number, atl: number, tsb: number, rampRate?: number } | null> {
    const db = await getBrowserDatabase()
    
    // Get latest fitness data
    const current = db.getCurrentFitness(userId)
    if (!current) return null

    // Calculate ramp rate (weekly change in CTL)
    const rampRateData = db.query(`
      SELECT 
        ctl,
        date,
        LAG(ctl, 7) OVER (ORDER BY date) as ctl_7_days_ago
      FROM fitness_calculations
      WHERE user_id = ? 
      ORDER BY date DESC 
      LIMIT 1
    `, [userId])

    const rampRate = rampRateData[0] ? 
      ((rampRateData[0].ctl - (rampRateData[0].ctl_7_days_ago || rampRateData[0].ctl)) / 7) : 0

    return {
      ...current,
      rampRate
    }
  }

  /**
   * Get workout intensity distribution
   */
  async getIntensityDistribution(userId: string, days: number = 90): Promise<{
    easy: number
    moderate: number
    hard: number
  }> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT 
        COUNT(CASE WHEN training_stress_score <= 150 THEN 1 END) as easy,
        COUNT(CASE WHEN training_stress_score > 150 AND training_stress_score <= 300 THEN 1 END) as moderate,
        COUNT(CASE WHEN training_stress_score > 300 THEN 1 END) as hard
      FROM activities
      WHERE user_id = ? AND date >= date('now', '-${days} days')
        AND training_stress_score IS NOT NULL
    `
    
    const result = db.query(sql, [userId])
    return result[0] || { easy: 0, moderate: 0, hard: 0 }
  }

  /**
   * Bulk sync activities from intervals.icu
   */
  async syncActivities(userId: string, activities: SimpleActivity[]): Promise<{ added: number, updated: number }> {
    const db = await getBrowserDatabase()
    
    let added = 0
    let updated = 0

    // Use bulk insert for performance
    const inserted = await db.bulkInsertActivities(activities, userId)
    added = inserted

    // Recalculate fitness metrics after sync
    await db.calculateFitnessMetrics(userId)

    console.log(`Sync completed: ${added} activities processed`)
    return { added, updated }
  }

  /**
   * Add single activity
   */
  async addActivity(userId: string, activity: SimpleActivity): Promise<void> {
    const db = await getBrowserDatabase()
    await db.upsertActivity(activity, userId)
    
    // Recalculate fitness for the affected date range
    const fromDate = new Date(activity.date || Date.now())
    fromDate.setDate(fromDate.getDate() - 7) // Recalc from 7 days before
    await db.calculateFitnessMetrics(userId, fromDate.toISOString().split('T')[0])
  }

  /**
   * Get personal bests for distance milestones
   */
  async getPersonalBests(userId: string): Promise<Array<{
    distance: number
    time: number
    pace: number
    date: string
  }>> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT 
        distance,
        MIN(duration) as time,
        distance / MIN(duration) as pace,
        date
      FROM activities
      WHERE user_id = ? AND distance >= 5000 -- 5K minimum
      GROUP BY CASE 
        WHEN distance >= 42000 THEN 42195  -- Marathon
        WHEN distance >= 21000 THEN 21097  -- Half Marathon  
        WHEN distance >= 10000 THEN 10000  -- 10K
        WHEN distance >= 5000 THEN 5000    -- 5K
      END
      ORDER BY distance DESC
    `
    
    return db.query(sql, [userId])
  }

  /**
   * Get recovery analysis data
   */
  async getRecoveryMetrics(userId: string, days: number = 14): Promise<Array<{
    date: string
    duration: number
    avgHr?: number
    distance: number
    recoveryScore: number
  }>> {
    const db = await getBrowserDatabase()
    const sql = `
      SELECT 
        date,
        duration,
        avg_hr,
        distance,
        -- Simple recovery score based on HR and duration
        CASE 
          WHEN avg_hr IS NOT NULL THEN 
            100 - ((avg_hr - 120) * 0.5) - (duration / 3600 * 5)
          ELSE 
            100 - (duration / 3600 * 10)
        END as recoveryScore
      FROM activities
      WHERE user_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date DESC
    `
    
    return db.query(sql, [userId])
  }

  /**
   * Clear all activities for a user
   */
  async clearActivities(userId: string): Promise<void> {
    const db = await getBrowserDatabase()
    db.exec('DELETE FROM activities WHERE user_id = ?', [userId])
    db.exec('DELETE FROM fitness_calculations WHERE user_id = ?', [userId])
    console.log('Cleared all activities and fitness data from browser database')
  }

  /**
   * Get database stats for debugging
   */
  async getStats(userId: string): Promise<{
    totalActivities: number
    dateRange: { earliest: string, latest: string }
    totalDistance: number
    avgWeeklyKm: number
  }> {
    const db = await getBrowserDatabase()
    
    const stats = db.query(`
      SELECT 
        COUNT(*) as totalActivities,
        MIN(date) as earliest,
        MAX(date) as latest,
        SUM(distance) / 1000.0 as totalDistance,
        SUM(distance) / 1000.0 / 
          (CAST(julianday(MAX(date)) - julianday(MIN(date)) AS REAL) / 7.0) as avgWeeklyKm
      FROM activities
      WHERE user_id = ?
    `, [userId])

    return stats[0] || { totalActivities: 0, dateRange: { earliest: '', latest: '' }, totalDistance: 0, avgWeeklyKm: 0 }
  }

  /**
   * Map database row to SimpleActivity object
   */
  private mapRowToActivity(row: any): SimpleActivity {
    return {
      id: row.id,
      date: row.date,
      distance: row.distance,
      duration: row.duration,
      avgHr: row.avg_hr,
      maxHr: row.max_hr,
      elevationGain: row.elevation_gain,
      calories: row.calories,
      avgPace: row.avg_pace,
      type: row.type
    }
  }
}

// Export singleton instance
export const browserActivitiesDAO = new BrowserActivitiesDAO()