import { getBrowserDatabase, isBrowser } from './browser-db'

interface BrowserMigration {
  version: number
  name: string
  up: string
  down?: string
}

/**
 * Browser database migrations for schema evolution
 * Stores migration state in localStorage since IndexedDB is used for data
 */
export class BrowserMigrationManager {
  private readonly MIGRATION_KEY = 'marathon_db_version'
  
  private migrations: BrowserMigration[] = [
    {
      version: 1,
      name: 'initial_schema',
      up: '' // Schema is created in browser-db.ts
    },
    {
      version: 2,
      name: 'add_ramp_rate_to_fitness',
      up: `
        ALTER TABLE fitness_calculations ADD COLUMN ramp_rate REAL;
        CREATE INDEX IF NOT EXISTS idx_fitness_ramp_rate ON fitness_calculations(ramp_rate);
      `
    },
    {
      version: 3,
      name: 'add_priority_to_recommendations', 
      up: `
        ALTER TABLE coach_recommendations ADD COLUMN priority INTEGER DEFAULT 3;
        UPDATE coach_recommendations SET priority = 
          CASE type
            WHEN 'recovery' THEN 1
            WHEN 'training_load' THEN 2
            WHEN 'workout_suggestion' THEN 2
            WHEN 'pacing' THEN 3
            WHEN 'race_strategy' THEN 3
            ELSE 3
          END;
        CREATE INDEX IF NOT EXISTS idx_coach_priority ON coach_recommendations(user_id, priority DESC, created_at DESC);
      `
    },
    {
      version: 4,
      name: 'add_workout_type_analysis',
      up: `
        CREATE TABLE IF NOT EXISTS workout_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          workout_type TEXT,
          intensity_score REAL,
          efficiency_score REAL,
          recovery_impact REAL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workout_analysis_user_date ON workout_analysis(user_id, date DESC);
      `
    },
    {
      version: 5,
      name: 'add_performance_predictions',
      up: `
        CREATE TABLE IF NOT EXISTS race_predictions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          distance INTEGER NOT NULL,
          predicted_time REAL NOT NULL,
          confidence REAL NOT NULL,
          based_on_fitness REAL NOT NULL,
          prediction_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_race_predictions_user ON race_predictions(user_id, distance);
      `
    }
  ]

  /**
   * Get current database version from localStorage
   */
  getCurrentVersion(): number {
    if (!isBrowser()) return 0
    
    const version = localStorage.getItem(this.MIGRATION_KEY)
    return version ? parseInt(version, 10) : 0
  }

  /**
   * Set database version in localStorage
   */
  private setVersion(version: number): void {
    if (isBrowser()) {
      localStorage.setItem(this.MIGRATION_KEY, version.toString())
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    if (!isBrowser()) {
      console.log('Skipping browser migrations - not in browser environment')
      return
    }

    const db = await getBrowserDatabase()
    const currentVersion = this.getCurrentVersion()
    
    console.log(`Current browser database version: ${currentVersion}`)

    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion)
    
    if (pendingMigrations.length === 0) {
      console.log('Browser database is up to date')
      return
    }

    console.log(`Running ${pendingMigrations.length} browser database migrations...`)

    try {
      for (const migration of pendingMigrations) {
        console.log(`Running browser migration ${migration.version}: ${migration.name}`)
        
        if (migration.version === 1) {
          // Skip initial schema - it's handled by browser-db.ts
          console.log('✓ Migration 1 (initial schema) handled by database initialization')
        } else if (migration.up.trim()) {
          // Execute the migration SQL
          try {
            db.exec(migration.up)
            console.log(`✓ Browser migration ${migration.version} completed`)
          } catch (error) {
            console.error(`✗ Browser migration ${migration.version} failed:`, error)
            throw error
          }
        } else {
          console.log(`✓ Browser migration ${migration.version} (no SQL to execute)`)
        }

        // Update version after successful migration
        this.setVersion(migration.version)
      }

      const finalVersion = this.getCurrentVersion()
      console.log(`Browser database upgraded to version ${finalVersion}`)

    } catch (error) {
      console.error('Browser migration failed:', error)
      throw error
    }
  }

  /**
   * Rollback to a specific version (careful - data loss possible)
   */
  async rollback(targetVersion: number): Promise<void> {
    if (!isBrowser()) return

    const currentVersion = this.getCurrentVersion()
    
    if (targetVersion >= currentVersion) {
      console.log('Nothing to rollback')
      return
    }

    console.warn(`Rolling back browser database from version ${currentVersion} to ${targetVersion}`)
    console.warn('This may cause data loss!')

    const db = await getBrowserDatabase()
    const migrationsToRollback = this.migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .reverse()

    try {
      for (const migration of migrationsToRollback) {
        if (migration.down) {
          console.log(`Rolling back browser migration ${migration.version}: ${migration.name}`)
          db.exec(migration.down)
          console.log(`✓ Browser migration ${migration.version} rolled back`)
        } else {
          console.warn(`Migration ${migration.version} has no rollback script - cannot rollback`)
          break // Stop rollback if we can't rollback cleanly
        }
      }

      this.setVersion(targetVersion)
      console.log(`Browser database rolled back to version ${targetVersion}`)

    } catch (error) {
      console.error('Browser rollback failed:', error)
      throw error
    }
  }

  /**
   * Reset browser database completely (for development/testing)
   */
  async resetDatabase(): Promise<void> {
    if (!isBrowser()) return

    console.warn('Resetting browser database - all data will be lost!')

    try {
      // Clear IndexedDB
      const request = indexedDB.deleteDatabase('marathon_db')
      
      await new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
        request.onblocked = () => {
          console.warn('Database deletion blocked - close other tabs')
          resolve() // Continue anyway
        }
      })

      // Clear version tracking
      localStorage.removeItem(this.MIGRATION_KEY)
      
      console.log('✓ Browser database reset complete')

      // Reinitialize database
      const db = await getBrowserDatabase()
      await this.runMigrations()

    } catch (error) {
      console.error('Failed to reset browser database:', error)
      throw error
    }
  }

  /**
   * Get migration status for debugging
   */
  getMigrationStatus(): {
    currentVersion: number
    availableVersion: number
    pendingMigrations: string[]
    appliedMigrations: string[]
  } {
    const currentVersion = this.getCurrentVersion()
    const maxVersion = Math.max(...this.migrations.map(m => m.version))
    
    return {
      currentVersion,
      availableVersion: maxVersion,
      pendingMigrations: this.migrations
        .filter(m => m.version > currentVersion)
        .map(m => `${m.version}: ${m.name}`),
      appliedMigrations: this.migrations
        .filter(m => m.version <= currentVersion)
        .map(m => `${m.version}: ${m.name}`)
    }
  }

  /**
   * Force set version (dangerous - only for development)
   */
  forceSetVersion(version: number): void {
    console.warn(`Force setting browser database version to ${version}`)
    this.setVersion(version)
  }
}

// Export singleton instance
export const browserMigrationManager = new BrowserMigrationManager()

/**
 * Auto-run migrations when module loads (in browser only)
 */
if (isBrowser()) {
  browserMigrationManager.runMigrations().catch(error => {
    console.error('Failed to auto-run browser migrations:', error)
  })
}