import { BaseDAO } from './base'

interface FitnessRow {
  id: number
  user_id: string
  date: string
  ctl: number | null
  atl: number | null
  tsb: number | null
  training_load: number | null
  created_at: string
}

export interface FitnessMetrics {
  date: string
  ctl: number // Chronic Training Load (fitness)
  atl: number // Acute Training Load (fatigue)
  tsb: number // Training Stress Balance (form)
  trainingLoad: number
}

/**
 * Data Access Object for Fitness Calculations (CTL/ATL/TSB)
 * Optimized for coach performance analysis
 */
export class FitnessDAO extends BaseDAO {
  private insertStatement = this.db.prepare(`
    INSERT OR REPLACE INTO fitness_calculations (
      user_id, date, ctl, atl, tsb, training_load
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)

  private selectByDateRangeStatement = this.db.prepare(`
    SELECT * FROM fitness_calculations
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `)

  private selectLatestStatement = this.db.prepare(`
    SELECT * FROM fitness_calculations
    WHERE user_id = ?
    ORDER BY date DESC
    LIMIT 1
  `)

  private selectRecentStatement = this.db.prepare(`
    SELECT * FROM fitness_calculations
    WHERE user_id = ? AND date >= date('now', '-180 days')
    ORDER BY date DESC
  `)

  /**
   * Insert or update fitness metrics for a specific date
   */
  async insertFitnessMetrics(userId: string, metrics: FitnessMetrics): Promise<void> {
    if (!this.validateDateString(metrics.date)) {
      throw new Error('Invalid date format')
    }

    this.executeWithRetry(this.insertStatement, [
      userId,
      metrics.date,
      metrics.ctl,
      metrics.atl,
      metrics.tsb,
      metrics.trainingLoad
    ])
  }

  /**
   * Bulk insert fitness metrics with transaction
   */
  async bulkInsertFitnessMetrics(userId: string, metricsArray: FitnessMetrics[]): Promise<void> {
    if (metricsArray.length === 0) return

    this.executeTransaction(() => {
      for (const metrics of metricsArray) {
        if (!this.validateDateString(metrics.date)) {
          console.warn('Skipping invalid date:', metrics.date)
          continue
        }

        this.insertStatement.run(
          userId,
          metrics.date,
          metrics.ctl,
          metrics.atl,
          metrics.tsb,
          metrics.trainingLoad
        )
      }
    })
  }

  /**
   * Get fitness metrics in date range
   */
  async getFitnessMetrics(userId: string, startDate: string, endDate: string): Promise<FitnessMetrics[]> {
    if (!this.validateDateString(startDate) || !this.validateDateString(endDate)) {
      throw new Error('Invalid date format')
    }

    const rows = this.db.prepare(this.selectByDateRangeStatement.source).all(
      userId, startDate, endDate
    ) as FitnessRow[]

    return rows.map(row => this.rowToFitnessMetrics(row))
  }

  /**
   * Get latest fitness metrics
   */
  async getLatestFitnessMetrics(userId: string): Promise<FitnessMetrics | null> {
    const row = this.executeWithRetry(this.selectLatestStatement, [userId]) as FitnessRow | undefined
    return row ? this.rowToFitnessMetrics(row) : null
  }

  /**
   * Get recent fitness metrics (last 180 days)
   */
  async getRecentFitnessMetrics(userId: string): Promise<FitnessMetrics[]> {
    const rows = this.db.prepare(this.selectRecentStatement.source).all(userId) as FitnessRow[]
    return rows.map(row => this.rowToFitnessMetrics(row))
  }

  /**
   * Calculate CTL/ATL/TSB for a date range
   * CTL (Chronic Training Load): 42-day exponentially weighted moving average
   * ATL (Acute Training Load): 7-day exponentially weighted moving average  
   * TSB (Training Stress Balance): CTL - ATL
   */
  async calculateAndStoreFitness(
    userId: string, 
    trainingData: Array<{ date: string; trainingStressScore: number }>,
    startDate: string
  ): Promise<void> {
    if (trainingData.length === 0) return

    // Sort by date to ensure chronological order
    const sortedData = trainingData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    let ctl = 0 // Chronic Training Load (42-day EWMA)
    let atl = 0 // Acute Training Load (7-day EWMA)
    
    // Exponential decay constants
    const ctlDecay = Math.exp(-1/42) // 42-day half-life
    const atlDecay = Math.exp(-1/7)  // 7-day half-life
    
    const metricsToInsert: FitnessMetrics[] = []

    // Get previous values if continuing from existing data
    const previousMetrics = await this.getLatestFitnessMetrics(userId)
    if (previousMetrics && new Date(previousMetrics.date) < new Date(startDate)) {
      ctl = previousMetrics.ctl
      atl = previousMetrics.atl
    }

    for (const data of sortedData) {
      const tss = data.trainingStressScore
      
      // Update CTL and ATL using exponentially weighted moving averages
      ctl = ctl * ctlDecay + tss * (1 - ctlDecay)
      atl = atl * atlDecay + tss * (1 - atlDecay)
      
      // Calculate TSB (Training Stress Balance)
      const tsb = ctl - atl
      
      metricsToInsert.push({
        date: data.date,
        ctl: Math.round(ctl * 100) / 100, // Round to 2 decimal places
        atl: Math.round(atl * 100) / 100,
        tsb: Math.round(tsb * 100) / 100,
        trainingLoad: tss
      })
    }

    // Bulk insert all calculated metrics
    await this.bulkInsertFitnessMetrics(userId, metricsToInsert)
  }

  /**
   * Get fitness trend analysis
   */
  async getFitnessTrend(userId: string, days = 90): Promise<{
    current: FitnessMetrics | null
    trend: 'improving' | 'maintaining' | 'declining'
    peakFitness: number
    currentFitness: number
    formStatus: 'fresh' | 'neutral' | 'fatigued'
  }> {
    const recent = await this.getRecentFitnessMetrics(userId)
    if (recent.length === 0) {
      return {
        current: null,
        trend: 'maintaining',
        peakFitness: 0,
        currentFitness: 0,
        formStatus: 'neutral'
      }
    }

    const current = recent[0]
    const peakFitness = Math.max(...recent.map(m => m.ctl))
    
    // Determine trend based on last 14 days
    const recentCTL = recent.slice(0, 14).map(m => m.ctl)
    const avgRecentCTL = recentCTL.reduce((a, b) => a + b, 0) / recentCTL.length
    const olderCTL = recent.slice(14, 28).map(m => m.ctl)
    const avgOlderCTL = olderCTL.length > 0 ? olderCTL.reduce((a, b) => a + b, 0) / olderCTL.length : avgRecentCTL
    
    let trend: 'improving' | 'maintaining' | 'declining' = 'maintaining'
    const changePercent = ((avgRecentCTL - avgOlderCTL) / avgOlderCTL) * 100
    
    if (changePercent > 5) trend = 'improving'
    else if (changePercent < -5) trend = 'declining'

    // Determine form status based on TSB
    let formStatus: 'fresh' | 'neutral' | 'fatigued' = 'neutral'
    if (current.tsb > 10) formStatus = 'fresh'
    else if (current.tsb < -20) formStatus = 'fatigued'

    return {
      current,
      trend,
      peakFitness,
      currentFitness: current.ctl,
      formStatus
    }
  }

  /**
   * Convert database row to FitnessMetrics
   */
  private rowToFitnessMetrics(row: FitnessRow): FitnessMetrics {
    return {
      date: row.date,
      ctl: row.ctl || 0,
      atl: row.atl || 0,
      tsb: row.tsb || 0,
      trainingLoad: row.training_load || 0
    }
  }
}