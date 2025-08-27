import { getBrowserDatabase } from '../browser-db'

export interface CoachRecommendation {
  id: string
  userId: string
  type: 'training_load' | 'recovery' | 'pacing' | 'workout_suggestion' | 'race_strategy'
  title: string
  message: string
  confidence: number
  data?: any
  isRead: boolean
  isDismissed: boolean
  priority: number
  validUntil?: string
  createdAt: string
}

export interface FitnessAnalysis {
  currentFitness: number
  fatigue: number
  form: number
  rampRate: number
  recommendation: 'increase' | 'maintain' | 'reduce' | 'rest'
  confidence: number
}

/**
 * Browser-compatible Coach DAO for AI recommendations and fitness analysis
 */
export class BrowserCoachDAO {
  /**
   * Generate AI coach recommendations based on current fitness state
   */
  async generateRecommendations(userId: string): Promise<CoachRecommendation[]> {
    const db = await getBrowserDatabase()
    
    // Get current fitness status
    const fitness = db.getCurrentFitness(userId)
    if (!fitness) {
      return [{
        id: this.generateId(),
        userId,
        type: 'training_load',
        title: 'Get Started',
        message: 'Start tracking your runs to receive personalized coaching recommendations.',
        confidence: 1.0,
        isRead: false,
        isDismissed: false,
        priority: 1,
        createdAt: new Date().toISOString()
      }]
    }

    const recommendations: CoachRecommendation[] = []
    
    // Analyze training stress balance (Form)
    if (fitness.tsb < -30) {
      recommendations.push({
        id: this.generateId(),
        userId,
        type: 'recovery',
        title: 'Recovery Needed',
        message: `Your form is low (TSB: ${fitness.tsb.toFixed(1)}). Consider reducing training intensity or taking a rest day.`,
        confidence: Math.abs(fitness.tsb) / 40,
        data: { tsb: fitness.tsb, recommended_action: 'reduce_intensity' },
        isRead: false,
        isDismissed: false,
        priority: 1,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      })
    } else if (fitness.tsb > 20) {
      recommendations.push({
        id: this.generateId(),
        userId,
        type: 'training_load',
        title: 'Ready for Intensity',
        message: `Your form is excellent (TSB: ${fitness.tsb.toFixed(1)}). This is a great time for a challenging workout.`,
        confidence: Math.min(fitness.tsb / 25, 1.0),
        data: { tsb: fitness.tsb, recommended_action: 'increase_intensity' },
        isRead: false,
        isDismissed: false,
        priority: 2,
        validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      })
    }

    // Analyze chronic training load (Fitness)
    if (fitness.ctl < 20) {
      recommendations.push({
        id: this.generateId(),
        userId,
        type: 'training_load',
        title: 'Build Base Fitness',
        message: 'Your fitness level is developing. Focus on consistent easy runs to build your aerobic base.',
        confidence: 0.8,
        data: { ctl: fitness.ctl, phase: 'base_building' },
        isRead: false,
        isDismissed: false,
        priority: 2,
        createdAt: new Date().toISOString()
      })
    }

    // Analyze ramp rate if available
    if (fitness.rampRate && Math.abs(fitness.rampRate) > 5) {
      const isIncreasing = fitness.rampRate > 0
      recommendations.push({
        id: this.generateId(),
        userId,
        type: 'training_load',
        title: isIncreasing ? 'Training Load Increasing Rapidly' : 'Training Load Declining',
        message: isIncreasing 
          ? `Your training load is increasing by ${fitness.rampRate.toFixed(1)} per week. Consider moderating the increase to avoid overtraining.`
          : `Your training load has decreased by ${Math.abs(fitness.rampRate).toFixed(1)} per week. Gradually return to your previous level.`,
        confidence: Math.min(Math.abs(fitness.rampRate) / 10, 0.9),
        data: { ramp_rate: fitness.rampRate },
        isRead: false,
        isDismissed: false,
        priority: isIncreasing ? 1 : 3,
        createdAt: new Date().toISOString()
      })
    }

    // Get recent workout patterns
    const recentWorkouts = await this.getRecentWorkoutPattern(userId)
    if (recentWorkouts.consecutiveEasyDays >= 7) {
      recommendations.push({
        id: this.generateId(),
        userId,
        type: 'workout_suggestion',
        title: 'Time for Intensity',
        message: `You've done ${recentWorkouts.consecutiveEasyDays} consecutive easy days. Consider adding a tempo or interval session.`,
        confidence: 0.7,
        data: { consecutive_easy_days: recentWorkouts.consecutiveEasyDays },
        isRead: false,
        isDismissed: false,
        priority: 2,
        createdAt: new Date().toISOString()
      })
    }

    // Store recommendations in database
    for (const rec of recommendations) {
      await this.saveRecommendation(rec)
    }

    return recommendations
  }

  /**
   * Get all active recommendations for user
   */
  async getRecommendations(userId: string, includeRead: boolean = false): Promise<CoachRecommendation[]> {
    const db = await getBrowserDatabase()
    
    let sql = `
      SELECT * FROM coach_recommendations
      WHERE user_id = ? AND is_dismissed = FALSE
        AND (valid_until IS NULL OR valid_until > datetime('now'))
    `
    
    if (!includeRead) {
      sql += ' AND is_read = FALSE'
    }
    
    sql += ' ORDER BY priority ASC, created_at DESC'
    
    const rows = db.query(sql, [userId])
    return rows.map(this.mapRowToRecommendation)
  }

  /**
   * Mark recommendation as read
   */
  async markAsRead(recommendationId: string): Promise<void> {
    const db = await getBrowserDatabase()
    db.exec('UPDATE coach_recommendations SET is_read = TRUE WHERE id = ?', [recommendationId])
  }

  /**
   * Dismiss recommendation
   */
  async dismissRecommendation(recommendationId: string): Promise<void> {
    const db = await getBrowserDatabase()
    db.exec('UPDATE coach_recommendations SET is_dismissed = TRUE WHERE id = ?', [recommendationId])
  }

  /**
   * Get fitness analysis for dashboard
   */
  async getFitnessAnalysis(userId: string): Promise<FitnessAnalysis | null> {
    const db = await getBrowserDatabase()
    const fitness = db.getCurrentFitness(userId)
    
    if (!fitness) return null

    // Determine training recommendation based on CTL/ATL/TSB
    let recommendation: 'increase' | 'maintain' | 'reduce' | 'rest'
    let confidence: number

    if (fitness.tsb < -30) {
      recommendation = 'rest'
      confidence = Math.min(Math.abs(fitness.tsb) / 40, 1.0)
    } else if (fitness.tsb < -15) {
      recommendation = 'reduce'
      confidence = Math.abs(fitness.tsb) / 30
    } else if (fitness.tsb > 15) {
      recommendation = 'increase'
      confidence = Math.min(fitness.tsb / 25, 1.0)
    } else {
      recommendation = 'maintain'
      confidence = 0.7
    }

    return {
      currentFitness: fitness.ctl,
      fatigue: fitness.atl,
      form: fitness.tsb,
      rampRate: 0, // TODO: Calculate from historical data
      recommendation,
      confidence
    }
  }

  /**
   * Get training load trends for charts
   */
  async getTrainingLoadTrends(userId: string, days: number = 42): Promise<Array<{
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
   * Get race prediction based on current fitness
   */
  async getRacePrediction(userId: string, distance: number): Promise<{
    predictedTime: number
    confidence: number
    basedOnFitness: number
  } | null> {
    const db = await getBrowserDatabase()
    const fitness = db.getCurrentFitness(userId)
    
    if (!fitness || fitness.ctl < 10) return null

    // Simple race prediction model based on CTL
    // This is a simplified version - a real implementation would use more sophisticated modeling
    const fitnessScale = Math.min(fitness.ctl / 50, 1.0) // Normalize fitness to 0-1
    
    // Base times for different distances (in seconds) for average fitness
    const baseTimes = {
      5000: 25 * 60,      // 25 min 5K
      10000: 55 * 60,     // 55 min 10K  
      21097: 2 * 3600,    // 2 hour half
      42195: 4.5 * 3600   // 4.5 hour marathon
    }

    const baseTime = baseTimes[distance as keyof typeof baseTimes] || (distance / 1000 * 6 * 60) // 6 min/km default
    const improvement = (fitnessScale - 0.5) * 0.3 // Up to 30% improvement/decline
    const predictedTime = baseTime * (1 - improvement)

    return {
      predictedTime,
      confidence: Math.min(fitness.ctl / 30, 0.8),
      basedOnFitness: fitness.ctl
    }
  }

  /**
   * Clean up old recommendations
   */
  async cleanupOldRecommendations(userId: string, daysOld: number = 30): Promise<number> {
    const db = await getBrowserDatabase()
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()
    
    const result = db.query(
      'SELECT COUNT(*) as count FROM coach_recommendations WHERE user_id = ? AND created_at < ?',
      [userId, cutoffDate]
    )
    
    db.exec(
      'DELETE FROM coach_recommendations WHERE user_id = ? AND created_at < ?',
      [userId, cutoffDate]
    )

    return result[0]?.count || 0
  }

  /**
   * Save recommendation to database
   */
  private async saveRecommendation(recommendation: CoachRecommendation): Promise<void> {
    const db = await getBrowserDatabase()
    const sql = `
      INSERT OR REPLACE INTO coach_recommendations
      (id, user_id, type, title, message, confidence, data_json, 
       is_read, is_dismissed, priority, valid_until, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const params = [
      recommendation.id,
      recommendation.userId,
      recommendation.type,
      recommendation.title,
      recommendation.message,
      recommendation.confidence,
      recommendation.data ? JSON.stringify(recommendation.data) : null,
      recommendation.isRead,
      recommendation.isDismissed,
      recommendation.priority,
      recommendation.validUntil,
      recommendation.createdAt
    ]
    
    db.exec(sql, params)
  }

  /**
   * Get recent workout patterns for analysis
   */
  private async getRecentWorkoutPattern(userId: string): Promise<{
    consecutiveEasyDays: number
    totalWorkouts: number
    intensityDistribution: { easy: number, moderate: number, hard: number }
  }> {
    const db = await getBrowserDatabase()
    
    // Simple analysis - count consecutive days with low TSS
    const recent = db.query(`
      SELECT training_stress_score, date
      FROM activities
      WHERE user_id = ? AND date >= date('now', '-14 days')
      ORDER BY date DESC
    `, [userId])

    let consecutiveEasyDays = 0
    for (const workout of recent) {
      if ((workout.training_stress_score || 0) <= 150) {
        consecutiveEasyDays++
      } else {
        break
      }
    }

    const intensityDistribution = {
      easy: recent.filter(w => (w.training_stress_score || 0) <= 150).length,
      moderate: recent.filter(w => (w.training_stress_score || 0) > 150 && (w.training_stress_score || 0) <= 300).length,
      hard: recent.filter(w => (w.training_stress_score || 0) > 300).length
    }

    return {
      consecutiveEasyDays,
      totalWorkouts: recent.length,
      intensityDistribution
    }
  }

  /**
   * Map database row to CoachRecommendation
   */
  private mapRowToRecommendation(row: any): CoachRecommendation {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      confidence: row.confidence,
      data: row.data_json ? JSON.parse(row.data_json) : undefined,
      isRead: Boolean(row.is_read),
      isDismissed: Boolean(row.is_dismissed),
      priority: row.priority,
      validUntil: row.valid_until,
      createdAt: row.created_at
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Export singleton instance
export const browserCoachDAO = new BrowserCoachDAO()