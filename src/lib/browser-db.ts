import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { SimpleActivity, User, Achievement, PersonalRecord } from '@/types'

/**
 * Browser-compatible SQLite database using sql.js
 * This provides local storage for the AI coach functionality
 */
class BrowserDatabase {
  private sql: SqlJsStatic | null = null
  private db: Database | null = null
  private isInitialized = false
  private readonly dbName = 'marathon_coach_db'

  /**
   * Initialize sql.js and create/load database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize sql.js
      this.sql = await initSqlJs({
        locateFile: (file: string) => `/sql-wasm.wasm`
      })

      // Try to load existing database from IndexedDB
      const savedDb = await this.loadFromIndexedDB()
      
      if (savedDb) {
        this.db = new this.sql.Database(savedDb)
        console.log('Loaded existing database from browser storage')
      } else {
        // Create new database
        this.db = new this.sql.Database()
        console.log('Created new browser database')
      }

      // Create schema
      this.createSchema()
      
      // Save to IndexedDB
      await this.saveToIndexedDB()
      
      this.isInitialized = true
      console.log('Browser database initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize browser database:', error)
      throw error
    }
  }

  /**
   * Create database schema optimized for coach calculations
   */
  private createSchema(): void {
    if (!this.db) throw new Error('Database not initialized')

    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        race_date TEXT,
        goal_time TEXT,
        level TEXT DEFAULT 'beginner',
        current_fitness REAL,
        max_heart_rate INTEGER,
        resting_heart_rate INTEGER,
        weight REAL,
        height REAL,
        preferences_json TEXT,
        stats_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Activities table - optimized for fitness calculations
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        distance REAL NOT NULL,
        duration REAL NOT NULL,
        avg_hr INTEGER,
        max_hr INTEGER,
        elevation_gain REAL,
        calories INTEGER,
        avg_pace REAL,
        type TEXT,
        training_stress_score REAL,
        intervals_icu_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Fitness calculations table - CTL/ATL/TSB for AI coach
      CREATE TABLE IF NOT EXISTS fitness_calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        ctl REAL, -- Chronic Training Load (fitness)
        atl REAL, -- Acute Training Load (fatigue) 
        tsb REAL, -- Training Stress Balance (form)
        training_load REAL,
        ramp_rate REAL, -- weekly training load change
        created_at TEXT NOT NULL
      );

      -- Coach recommendations table
      CREATE TABLE IF NOT EXISTS coach_recommendations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        confidence REAL NOT NULL,
        data_json TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        is_dismissed BOOLEAN DEFAULT FALSE,
        priority INTEGER DEFAULT 3,
        valid_until TEXT,
        created_at TEXT NOT NULL
      );

      -- Achievements table
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        threshold REAL NOT NULL,
        unit TEXT,
        category TEXT,
        unlocked_at TEXT,
        progress REAL DEFAULT 0.0,
        created_at TEXT NOT NULL
      );

      -- Personal records table
      CREATE TABLE IF NOT EXISTS personal_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        date TEXT NOT NULL,
        activity_id TEXT,
        previous_record REAL,
        created_at TEXT NOT NULL
      );

      -- Performance optimized indexes
      CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_date_tss ON activities(date, training_stress_score);
      CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON fitness_calculations(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_coach_user_priority ON coach_recommendations(user_id, priority DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_coach_unread ON coach_recommendations(user_id, is_read, is_dismissed);

      -- Materialized views for fast coach queries
      CREATE VIEW IF NOT EXISTS recent_fitness AS
      SELECT 
        user_id,
        date,
        ctl,
        atl, 
        tsb,
        ramp_rate,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as rn
      FROM fitness_calculations
      WHERE date >= date('now', '-90 days');

      CREATE VIEW IF NOT EXISTS weekly_stats AS
      SELECT 
        user_id,
        strftime('%Y-%W', date) as week,
        COUNT(*) as activity_count,
        SUM(distance) / 1000.0 as total_km,
        SUM(duration) / 3600.0 as total_hours,
        AVG(training_stress_score) as avg_tss,
        SUM(training_stress_score) as weekly_tss
      FROM activities
      WHERE date >= date('now', '-180 days')
      GROUP BY user_id, strftime('%Y-%W', date);
    `

    this.db.exec(schema)
  }

  /**
   * Save database to browser IndexedDB for persistence
   */
  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const data = this.db!.export()
      const request = indexedDB.open('marathon_db', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['databases'], 'readwrite')
        const store = transaction.objectStore('databases')
        
        store.put(data, this.dbName)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases')
        }
      }
    })
  }

  /**
   * Load database from browser IndexedDB
   */
  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('marathon_db', 1)
      
      request.onerror = () => resolve(null)
      request.onsuccess = () => {
        const db = request.result
        
        if (!db.objectStoreNames.contains('databases')) {
          resolve(null)
          return
        }
        
        const transaction = db.transaction(['databases'], 'readonly')
        const store = transaction.objectStore('databases')
        const getRequest = store.get(this.dbName)
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null)
        }
        getRequest.onerror = () => resolve(null)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases')
        }
        resolve(null) // New database, no existing data
      }
    })
  }

  /**
   * Execute SQL query and return results
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized')
    
    try {
      const stmt = this.db.prepare(sql)
      const results: T[] = []
      
      stmt.bind(params)
      while (stmt.step()) {
        const row = stmt.getAsObject()
        results.push(row as T)
      }
      stmt.free()
      
      return results
    } catch (error) {
      console.error('Query execution failed:', error)
      throw error
    }
  }

  /**
   * Execute SQL command (INSERT, UPDATE, DELETE)
   */
  exec(sql: string, params: any[] = []): void {
    if (!this.db) throw new Error('Database not initialized')
    
    try {
      if (params.length > 0) {
        const stmt = this.db.prepare(sql)
        stmt.run(params)
        stmt.free()
      } else {
        this.db.exec(sql)
      }
      
      // Auto-save after modifications
      this.saveToIndexedDB().catch(console.error)
      
    } catch (error) {
      console.error('Exec execution failed:', error)
      throw error
    }
  }

  /**
   * Insert or update user
   */
  async upsertUser(user: User): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO users 
      (id, name, email, race_date, goal_time, level, current_fitness, 
       max_heart_rate, resting_heart_rate, weight, height, 
       preferences_json, stats_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const params = [
      user.id, user.name, user.email, user.raceDate, user.goalTime, user.level,
      user.currentFitness, user.maxHeartRate, user.restingHeartRate, 
      user.weight, user.height,
      JSON.stringify(user.preferences), JSON.stringify(user.stats),
      user.createdAt, user.updatedAt
    ]
    
    this.exec(sql, params)
  }

  /**
   * Insert or update activity
   */
  async upsertActivity(activity: SimpleActivity, userId: string): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO activities
      (id, user_id, date, distance, duration, avg_hr, max_hr, elevation_gain, 
       calories, avg_pace, type, intervals_icu_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      activity.id || this.generateId(), userId, activity.date, activity.distance,
      activity.duration, activity.avgHr, activity.maxHr, activity.elevationGain,
      activity.calories, activity.avgPace, activity.type, activity.id,
      now, now
    ]
    
    this.exec(sql, params)
  }

  /**
   * Bulk insert activities (optimized for initial sync)
   */
  async bulkInsertActivities(activities: SimpleActivity[], userId: string): Promise<number> {
    if (!activities.length) return 0

    try {
      const sql = `
        INSERT OR IGNORE INTO activities
        (id, user_id, date, distance, duration, avg_hr, max_hr, elevation_gain, 
         calories, avg_pace, type, intervals_icu_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const now = new Date().toISOString()
      let inserted = 0

      for (const activity of activities) {
        const params = [
          activity.id || this.generateId(), userId, activity.date, activity.distance,
          activity.duration, activity.avgHr, activity.maxHr, activity.elevationGain,
          activity.calories, activity.avgPace, activity.type, activity.id,
          now, now
        ]

        try {
          this.exec(sql, params)
          inserted++
        } catch (error) {
          // Ignore duplicates but log other errors
          if (!error.message?.includes('UNIQUE constraint')) {
            console.error('Failed to insert activity:', activity.id, error)
          }
        }
      }

      console.log(`Bulk inserted ${inserted}/${activities.length} activities`)
      return inserted
    } catch (error) {
      console.error('Bulk insert failed:', error)
      throw error
    }
  }

  /**
   * Get activities for date range (optimized for coach calculations)
   */
  getActivitiesForDateRange(userId: string, startDate: string, endDate: string): SimpleActivity[] {
    const sql = `
      SELECT * FROM activities 
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC
    `
    
    const rows = this.query(sql, [userId, startDate, endDate])
    return rows.map(this.mapRowToActivity)
  }

  /**
   * Get recent activities (last N days)
   */
  getRecentActivities(userId: string, days: number = 90): SimpleActivity[] {
    const sql = `
      SELECT * FROM activities 
      WHERE user_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date DESC
    `
    
    const rows = this.query(sql, [userId])
    return rows.map(this.mapRowToActivity)
  }

  /**
   * Calculate and store fitness metrics (CTL/ATL/TSB)
   */
  async calculateFitnessMetrics(userId: string, startDate?: string): Promise<void> {
    const fromDate = startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // Get activities with TSS
    const activities = this.query(`
      SELECT date, training_stress_score, distance, duration
      FROM activities 
      WHERE user_id = ? AND date >= ? 
      ORDER BY date ASC
    `, [userId, fromDate])

    const CTL_DECAY = 42 // Fitness decay constant
    const ATL_DECAY = 7  // Fatigue decay constant

    let ctl = 0
    let atl = 0

    for (const activity of activities) {
      const tss = activity.training_stress_score || this.estimateTSS(activity)
      
      // Update CTL and ATL using exponential weighted moving averages
      ctl = ctl + (tss - ctl) / CTL_DECAY
      atl = atl + (tss - atl) / ATL_DECAY
      const tsb = ctl - atl

      // Store calculation
      this.exec(`
        INSERT OR REPLACE INTO fitness_calculations
        (user_id, date, ctl, atl, tsb, training_load, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, activity.date, ctl, atl, tsb, tss, new Date().toISOString()])
    }
  }

  /**
   * Get current fitness status
   */
  getCurrentFitness(userId: string): { ctl: number, atl: number, tsb: number } | null {
    const rows = this.query(`
      SELECT ctl, atl, tsb FROM fitness_calculations
      WHERE user_id = ? ORDER BY date DESC LIMIT 1
    `, [userId])

    return rows[0] || null
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * Estimate Training Stress Score if not provided
   */
  private estimateTSS(activity: { distance: number, duration: number, avg_hr?: number }): number {
    // Simple TSS estimation based on duration and intensity
    const hours = activity.duration / 3600
    const pace = activity.distance / activity.duration // m/s
    
    // Base TSS on duration and rough intensity estimate
    const intensityFactor = Math.min(pace / 3.33, 1.5) // normalized against ~5 min/km pace
    return Math.round(hours * 100 * intensityFactor)
  }

  /**
   * Map database row to SimpleActivity
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

  /**
   * Close database
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
  }
}

// Singleton instance
let browserDb: BrowserDatabase | null = null

/**
 * Get browser database instance
 */
export async function getBrowserDatabase(): Promise<BrowserDatabase> {
  if (!browserDb) {
    browserDb = new BrowserDatabase()
    await browserDb.initialize()
  }
  return browserDb
}

/**
 * Check if we're in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}