import { getBrowserDatabase, isBrowser } from './browser-db'
import { browserActivitiesDAO } from './dao/browser-activities'
import { SimpleActivity, User, Achievement, PersonalRecord } from '@/types'

/**
 * Utility to migrate existing localStorage data to SQLite
 */
export class DataMigrator {
  private readonly MIGRATION_FLAG = 'mt_sqlite_migrated'

  /**
   * Check if migration has already been completed
   */
  hasMigrated(): boolean {
    if (!isBrowser()) return true
    return localStorage.getItem(this.MIGRATION_FLAG) === 'true'
  }

  /**
   * Mark migration as completed
   */
  private markMigrated(): void {
    if (isBrowser()) {
      localStorage.setItem(this.MIGRATION_FLAG, 'true')
    }
  }

  /**
   * Run complete data migration from localStorage to SQLite
   */
  async migrateAll(): Promise<{
    users: number
    activities: number
    achievements: number
    personalRecords: number
    errors: string[]
  }> {
    if (!isBrowser()) {
      console.log('Skipping migration - not in browser environment')
      return { users: 0, activities: 0, achievements: 0, personalRecords: 0, errors: [] }
    }

    if (this.hasMigrated()) {
      console.log('Data migration already completed')
      return { users: 0, activities: 0, achievements: 0, personalRecords: 0, errors: [] }
    }

    console.log('Starting data migration from localStorage to SQLite...')

    const results = {
      users: 0,
      activities: 0,
      achievements: 0,
      personalRecords: 0,
      errors: [] as string[]
    }

    try {
      const db = await getBrowserDatabase()

      // Migrate user data
      try {
        const userCount = await this.migrateUserData(db)
        results.users = userCount
        console.log(`✓ Migrated ${userCount} user records`)
      } catch (error) {
        const msg = `Failed to migrate user data: ${error}`
        console.error(msg)
        results.errors.push(msg)
      }

      // Migrate activities
      try {
        const activityCount = await this.migrateActivities()
        results.activities = activityCount
        console.log(`✓ Migrated ${activityCount} activities`)
      } catch (error) {
        const msg = `Failed to migrate activities: ${error}`
        console.error(msg)
        results.errors.push(msg)
      }

      // Migrate achievements
      try {
        const achievementCount = await this.migrateAchievements(db)
        results.achievements = achievementCount
        console.log(`✓ Migrated ${achievementCount} achievements`)
      } catch (error) {
        const msg = `Failed to migrate achievements: ${error}`
        console.error(msg)
        results.errors.push(msg)
      }

      // Migrate personal records
      try {
        const recordCount = await this.migratePersonalRecords(db)
        results.personalRecords = recordCount
        console.log(`✓ Migrated ${recordCount} personal records`)
      } catch (error) {
        const msg = `Failed to migrate personal records: ${error}`
        console.error(msg)
        results.errors.push(msg)
      }

      // Calculate fitness metrics for migrated activities
      if (results.activities > 0) {
        try {
          console.log('Calculating fitness metrics for migrated activities...')
          await db.calculateFitnessMetrics('michael') // Using hardcoded user ID from user store
          console.log('✓ Fitness metrics calculated')
        } catch (error) {
          const msg = `Failed to calculate fitness metrics: ${error}`
          console.error(msg)
          results.errors.push(msg)
        }
      }

      // Mark migration as completed only if no critical errors
      if (results.errors.length === 0) {
        this.markMigrated()
        console.log('✅ Data migration completed successfully')
      } else {
        console.warn('⚠️ Migration completed with errors - not marking as fully migrated')
      }

    } catch (error) {
      const msg = `Migration failed: ${error}`
      console.error(msg)
      results.errors.push(msg)
      throw error
    }

    return results
  }

  /**
   * Migrate user data from localStorage
   */
  private async migrateUserData(db: any): Promise<number> {
    const userRaw = localStorage.getItem('mt_user')
    if (!userRaw) return 0

    try {
      const user = JSON.parse(userRaw) as User
      await db.upsertUser(user)
      return 1
    } catch (error) {
      console.error('Failed to parse user data:', error)
      return 0
    }
  }

  /**
   * Migrate activities from localStorage
   */
  private async migrateActivities(): Promise<number> {
    // Try all possible activity storage keys
    const activityKeys = [
      'mt_activities',           // Current intervals.icu activities
      'mt_activities_old',       // Legacy activities
      'mt_uploaded_activities',  // Uploaded activities
      'mt_manual_activities'     // Manual activities
    ]

    let totalMigrated = 0

    for (const key of activityKeys) {
      const data = localStorage.getItem(key)
      if (!data) continue

      try {
        const activities = JSON.parse(data) as SimpleActivity[]
        if (Array.isArray(activities) && activities.length > 0) {
          console.log(`Migrating ${activities.length} activities from ${key}...`)
          
          // Clean and validate activities
          const cleanActivities = activities
            .filter(a => a && typeof a.distance === 'number' && typeof a.duration === 'number')
            .map(a => ({
              ...a,
              id: a.id || this.generateId(),
              date: a.date || new Date().toISOString().split('T')[0]
            }))

          const { added } = await browserActivitiesDAO.syncActivities('michael', cleanActivities)
          totalMigrated += added
          
          console.log(`✓ Migrated ${added} activities from ${key}`)
        }
      } catch (error) {
        console.error(`Failed to migrate activities from ${key}:`, error)
      }
    }

    return totalMigrated
  }

  /**
   * Migrate achievements from localStorage
   */
  private async migrateAchievements(db: any): Promise<number> {
    const achievementsRaw = localStorage.getItem('mt_achievements')
    if (!achievementsRaw) return 0

    try {
      const achievements = JSON.parse(achievementsRaw) as Achievement[]
      if (!Array.isArray(achievements)) return 0

      let migrated = 0
      for (const achievement of achievements) {
        try {
          const sql = `
            INSERT OR REPLACE INTO achievements
            (id, user_id, type, title, description, icon, threshold, unit, 
             category, unlocked_at, progress, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          
          const params = [
            achievement.id,
            'michael', // Hardcoded user ID
            achievement.type,
            achievement.title,
            achievement.description,
            achievement.icon,
            achievement.threshold,
            achievement.unit,
            achievement.category,
            achievement.unlockedAt,
            achievement.progress,
            new Date().toISOString()
          ]
          
          db.exec(sql, params)
          migrated++
        } catch (error) {
          console.error('Failed to migrate achievement:', achievement.id, error)
        }
      }

      return migrated
    } catch (error) {
      console.error('Failed to parse achievements:', error)
      return 0
    }
  }

  /**
   * Migrate personal records from localStorage
   */
  private async migratePersonalRecords(db: any): Promise<number> {
    const recordsRaw = localStorage.getItem('mt_personal_records')
    if (!recordsRaw) return 0

    try {
      const records = JSON.parse(recordsRaw) as PersonalRecord[]
      if (!Array.isArray(records)) return 0

      let migrated = 0
      for (const record of records) {
        try {
          const sql = `
            INSERT OR REPLACE INTO personal_records
            (id, user_id, type, value, unit, date, activity_id, previous_record, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          
          const params = [
            record.id,
            'michael', // Hardcoded user ID
            record.type,
            record.value,
            record.unit,
            record.date,
            record.activityId,
            record.previousRecord,
            new Date().toISOString()
          ]
          
          db.exec(sql, params)
          migrated++
        } catch (error) {
          console.error('Failed to migrate personal record:', record.id, error)
        }
      }

      return migrated
    } catch (error) {
      console.error('Failed to parse personal records:', error)
      return 0
    }
  }

  /**
   * Force re-run migration (for development/testing)
   */
  async forceMigration(): Promise<any> {
    if (isBrowser()) {
      localStorage.removeItem(this.MIGRATION_FLAG)
      console.log('Migration flag cleared - re-running migration...')
    }
    return this.migrateAll()
  }

  /**
   * Clean up old localStorage data after successful migration
   */
  async cleanupOldData(): Promise<void> {
    if (!this.hasMigrated()) {
      console.log('Migration not completed - skipping cleanup')
      return
    }

    console.log('Cleaning up old localStorage data...')

    const keysToRemove = [
      'mt_activities_old',
      'mt_uploaded_activities', 
      'mt_manual_activities'
      // Keep 'mt_activities' as it's still used for intervals.icu cache
      // Keep 'mt_user', 'mt_achievements', 'mt_personal_records' as fallbacks
    ]

    for (const key of keysToRemove) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key)
        console.log(`Removed ${key}`)
      }
    }

    console.log('✓ Cleanup completed')
  }

  /**
   * Get migration status for debugging
   */
  getMigrationStatus(): {
    completed: boolean
    localStorageSize: number
    availableKeys: string[]
    estimatedRecords: { [key: string]: number }
  } {
    if (!isBrowser()) {
      return { completed: true, localStorageSize: 0, availableKeys: [], estimatedRecords: {} }
    }

    const keys = Object.keys(localStorage).filter(key => key.startsWith('mt_'))
    const estimatedRecords: { [key: string]: number } = {}
    let totalSize = 0

    for (const key of keys) {
      const data = localStorage.getItem(key)
      if (data) {
        totalSize += data.length
        try {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed)) {
            estimatedRecords[key] = parsed.length
          } else if (typeof parsed === 'object') {
            estimatedRecords[key] = 1
          }
        } catch {
          estimatedRecords[key] = 0
        }
      }
    }

    return {
      completed: this.hasMigrated(),
      localStorageSize: totalSize,
      availableKeys: keys,
      estimatedRecords
    }
  }

  /**
   * Generate unique ID for missing IDs
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Export singleton instance
export const dataMigrator = new DataMigrator()

/**
 * Auto-run migration when module loads (in browser only)
 */
if (isBrowser()) {
  // Run migration after a short delay to let the page load
  setTimeout(() => {
    dataMigrator.migrateAll().catch(error => {
      console.error('Auto-migration failed:', error)
    })
  }, 1000)
}