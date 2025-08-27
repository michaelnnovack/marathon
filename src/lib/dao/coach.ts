import { BaseDAO } from './base'

export type CoachRecommendationType = 'training_load' | 'recovery' | 'pacing' | 'workout_suggestion' | 'race_strategy'

export interface CoachRecommendation {
  id: string
  type: CoachRecommendationType
  title: string
  message: string
  confidence: number // 0.0 to 1.0
  data?: any // supporting data
  isRead: boolean
  isDismissed: boolean
  validUntil?: string // ISO date
  createdAt: string
}

interface CoachRecommendationRow {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  confidence: number
  data_json: string | null
  is_read: number
  is_dismissed: number
  valid_until: string | null
  created_at: string
  updated_at: string
}

/**
 * Data Access Object for Coach Recommendations
 * Handles AI coach insights and advice storage
 */
export class CoachDAO extends BaseDAO {
  private insertStatement = this.db.prepare(`
    INSERT OR REPLACE INTO coach_recommendations (
      id, user_id, type, title, message, confidence, data_json,
      is_read, is_dismissed, valid_until, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  private selectActiveStatement = this.db.prepare(`
    SELECT * FROM coach_recommendations
    WHERE user_id = ? 
      AND is_dismissed = 0 
      AND (valid_until IS NULL OR valid_until > datetime('now'))
    ORDER BY created_at DESC
    LIMIT ?
  `)

  private selectByIdStatement = this.db.prepare(`
    SELECT * FROM coach_recommendations WHERE id = ?
  `)

  private selectUnreadStatement = this.db.prepare(`
    SELECT * FROM coach_recommendations
    WHERE user_id = ? 
      AND is_read = 0 
      AND is_dismissed = 0
      AND (valid_until IS NULL OR valid_until > datetime('now'))
    ORDER BY created_at DESC
  `)

  private selectByTypeStatement = this.db.prepare(`
    SELECT * FROM coach_recommendations
    WHERE user_id = ? AND type = ?
      AND is_dismissed = 0
      AND (valid_until IS NULL OR valid_until > datetime('now'))
    ORDER BY created_at DESC
    LIMIT ?
  `)

  private updateReadStatusStatement = this.db.prepare(`
    UPDATE coach_recommendations 
    SET is_read = ?, updated_at = ?
    WHERE id = ?
  `)

  private updateDismissedStatusStatement = this.db.prepare(`
    UPDATE coach_recommendations 
    SET is_dismissed = ?, updated_at = ?
    WHERE id = ?
  `)

  private cleanupExpiredStatement = this.db.prepare(`
    DELETE FROM coach_recommendations 
    WHERE valid_until IS NOT NULL AND valid_until < datetime('now')
  `)

  /**
   * Create a new coach recommendation
   */
  async createRecommendation(
    userId: string,
    recommendation: Omit<CoachRecommendation, 'id' | 'isRead' | 'isDismissed' | 'createdAt'>
  ): Promise<string> {
    const id = `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = this.getCurrentTimestamp()

    this.executeWithRetry(this.insertStatement, [
      id,
      userId,
      recommendation.type,
      recommendation.title,
      recommendation.message,
      recommendation.confidence,
      this.toJsonString(recommendation.data),
      0, // is_read
      0, // is_dismissed
      recommendation.validUntil || null,
      now,
      now
    ])

    return id
  }

  /**
   * Get active recommendations for user
   */
  async getActiveRecommendations(userId: string, limit = 20): Promise<CoachRecommendation[]> {
    const rows = this.db.prepare(this.selectActiveStatement.source).all(userId, limit) as CoachRecommendationRow[]
    return rows.map(row => this.rowToRecommendation(row))
  }

  /**
   * Get recommendation by ID
   */
  async getRecommendationById(id: string): Promise<CoachRecommendation | null> {
    const row = this.executeWithRetry(this.selectByIdStatement, [id]) as CoachRecommendationRow | undefined
    return row ? this.rowToRecommendation(row) : null
  }

  /**
   * Get unread recommendations
   */
  async getUnreadRecommendations(userId: string): Promise<CoachRecommendation[]> {
    const rows = this.db.prepare(this.selectUnreadStatement.source).all(userId) as CoachRecommendationRow[]
    return rows.map(row => this.rowToRecommendation(row))
  }

  /**
   * Get recommendations by type
   */
  async getRecommendationsByType(
    userId: string, 
    type: CoachRecommendationType,
    limit = 10
  ): Promise<CoachRecommendation[]> {
    const rows = this.db.prepare(this.selectByTypeStatement.source).all(userId, type, limit) as CoachRecommendationRow[]
    return rows.map(row => this.rowToRecommendation(row))
  }

  /**
   * Mark recommendation as read
   */
  async markAsRead(id: string): Promise<boolean> {
    const result = this.executeWithRetry(this.updateReadStatusStatement, [
      1,
      this.getCurrentTimestamp(),
      id
    ])
    return (result as any).changes > 0
  }

  /**
   * Mark recommendation as dismissed
   */
  async dismissRecommendation(id: string): Promise<boolean> {
    const result = this.executeWithRetry(this.updateDismissedStatusStatement, [
      1,
      this.getCurrentTimestamp(),
      id
    ])
    return (result as any).changes > 0
  }

  /**
   * Clean up expired recommendations
   */
  async cleanupExpiredRecommendations(): Promise<number> {
    const result = this.executeWithRetry(this.cleanupExpiredStatement, [])
    return (result as any).changes || 0
  }

  /**
   * Create training load recommendation
   */
  async createTrainingLoadRecommendation(
    userId: string,
    currentLoad: number,
    optimalRange: [number, number],
    confidence: number
  ): Promise<string> {
    const isOverTraining = currentLoad > optimalRange[1]
    const isUnderTraining = currentLoad < optimalRange[0]
    
    let title: string
    let message: string
    
    if (isOverTraining) {
      title = 'Training Load Warning'
      message = `Your current training load (${currentLoad.toFixed(1)}) is above the optimal range. Consider reducing intensity or taking a recovery day.`
    } else if (isUnderTraining) {
      title = 'Training Opportunity'
      message = `Your training load (${currentLoad.toFixed(1)}) is below optimal. You could safely increase your training volume.`
    } else {
      title = 'Training Load Optimal'
      message = `Your current training load (${currentLoad.toFixed(1)}) is in the optimal range. Keep up the great work!`
    }

    return await this.createRecommendation(userId, {
      type: 'training_load',
      title,
      message,
      confidence,
      data: {
        currentLoad,
        optimalRange,
        status: isOverTraining ? 'over' : isUnderTraining ? 'under' : 'optimal'
      },
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Valid for 7 days
    })
  }

  /**
   * Create recovery recommendation
   */
  async createRecoveryRecommendation(
    userId: string,
    tsb: number,
    recentLoad: number,
    confidence: number
  ): Promise<string> {
    const isOverReached = tsb < -20
    const needsRecovery = tsb < -10
    
    let title: string
    let message: string
    
    if (isOverReached) {
      title = 'Recovery Required'
      message = `Your Training Stress Balance (${tsb.toFixed(1)}) indicates you need immediate recovery. Consider taking 2-3 easy days.`
    } else if (needsRecovery) {
      title = 'Recovery Recommended'
      message = `Your Training Stress Balance (${tsb.toFixed(1)}) suggests you could benefit from an easy day.`
    } else {
      title = 'Recovery Status Good'
      message = `Your Training Stress Balance (${tsb.toFixed(1)}) is healthy. You're recovering well from training.`
    }

    return await this.createRecommendation(userId, {
      type: 'recovery',
      title,
      message,
      confidence,
      data: {
        tsb,
        recentLoad,
        status: isOverReached ? 'critical' : needsRecovery ? 'needed' : 'good'
      },
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // Valid for 3 days
    })
  }

  /**
   * Create workout suggestion
   */
  async createWorkoutSuggestion(
    userId: string,
    workoutType: string,
    targetDistance: number,
    targetPace: string,
    rationale: string,
    confidence: number
  ): Promise<string> {
    return await this.createRecommendation(userId, {
      type: 'workout_suggestion',
      title: `${workoutType} Workout Suggested`,
      message: `Try a ${workoutType} workout: ${(targetDistance/1000).toFixed(1)}km at ${targetPace} pace. ${rationale}`,
      confidence,
      data: {
        workoutType,
        targetDistance,
        targetPace,
        rationale
      },
      validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // Valid for 5 days
    })
  }

  /**
   * Get recommendation statistics
   */
  async getRecommendationStats(userId: string): Promise<{
    total: number
    unread: number
    dismissed: number
    byType: Record<CoachRecommendationType, number>
  }> {
    const totalResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM coach_recommendations WHERE user_id = ?
    `).get(userId) as { count: number }

    const unreadResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM coach_recommendations 
      WHERE user_id = ? AND is_read = 0 AND is_dismissed = 0
    `).get(userId) as { count: number }

    const dismissedResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM coach_recommendations 
      WHERE user_id = ? AND is_dismissed = 1
    `).get(userId) as { count: number }

    const typeResults = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM coach_recommendations 
      WHERE user_id = ? AND is_dismissed = 0
      GROUP BY type
    `).all(userId) as Array<{ type: string; count: number }>

    const byType: Record<CoachRecommendationType, number> = {
      training_load: 0,
      recovery: 0,
      pacing: 0,
      workout_suggestion: 0,
      race_strategy: 0
    }

    for (const result of typeResults) {
      if (result.type in byType) {
        byType[result.type as CoachRecommendationType] = result.count
      }
    }

    return {
      total: totalResult.count,
      unread: unreadResult.count,
      dismissed: dismissedResult.count,
      byType
    }
  }

  /**
   * Convert database row to CoachRecommendation
   */
  private rowToRecommendation(row: CoachRecommendationRow): CoachRecommendation {
    return {
      id: row.id,
      type: row.type as CoachRecommendationType,
      title: row.title,
      message: row.message,
      confidence: row.confidence,
      data: this.fromJsonString(row.data_json),
      isRead: Boolean(row.is_read),
      isDismissed: Boolean(row.is_dismissed),
      validUntil: row.valid_until || undefined,
      createdAt: row.created_at
    }
  }
}