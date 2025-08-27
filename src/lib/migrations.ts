import { getDatabase } from './database'
import { readFileSync } from 'fs'
import { join } from 'path'

interface Migration {
  version: number
  name: string
  up: string
  down?: string
}

// Migration tracking table
const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`

// Define migrations
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: '', // Will be loaded from schema.sql
  },
  {
    version: 2,
    name: 'add_training_stress_score',
    up: `
      ALTER TABLE activities ADD COLUMN training_stress_score REAL;
      CREATE INDEX IF NOT EXISTS idx_activities_tss ON activities(training_stress_score);
    `,
    down: `
      ALTER TABLE activities DROP COLUMN training_stress_score;
      DROP INDEX IF EXISTS idx_activities_tss;
    `
  },
  {
    version: 3,
    name: 'add_workout_notes',
    up: `
      ALTER TABLE workouts ADD COLUMN notes TEXT;
      ALTER TABLE workouts ADD COLUMN weather_json TEXT;
    `,
    down: `
      ALTER TABLE workouts DROP COLUMN notes;
      ALTER TABLE workouts DROP COLUMN weather_json;
    `
  }
]

export function getCurrentVersion(): number {
  const db = getDatabase()
  
  // Ensure migrations table exists
  db.exec(MIGRATION_TABLE_SQL)
  
  const result = db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null }
  return result.version || 0
}

export function runMigrations(): void {
  const db = getDatabase()
  const currentVersion = getCurrentVersion()
  
  console.log(`Current database version: ${currentVersion}`)
  
  // Begin transaction for all migrations
  const transaction = db.transaction(() => {
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.name}`)
        
        let sql = migration.up
        
        // Load initial schema from file for version 1
        if (migration.version === 1) {
          try {
            const schemaPath = join(process.cwd(), 'src', 'lib', 'schema.sql')
            sql = readFileSync(schemaPath, 'utf-8')
          } catch (error) {
            console.error('Failed to load schema.sql:', error)
            throw error
          }
        }
        
        // Execute migration
        try {
          db.exec(sql)
          
          // Record migration
          db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(
            migration.version,
            migration.name
          )
          
          console.log(`✓ Migration ${migration.version} completed`)
        } catch (error) {
          console.error(`✗ Migration ${migration.version} failed:`, error)
          throw error
        }
      }
    }
  })
  
  transaction()
  
  const newVersion = getCurrentVersion()
  if (newVersion > currentVersion) {
    console.log(`Database upgraded from version ${currentVersion} to ${newVersion}`)
  } else {
    console.log('Database is up to date')
  }
}

export function rollbackMigration(targetVersion: number): void {
  const db = getDatabase()
  const currentVersion = getCurrentVersion()
  
  if (targetVersion >= currentVersion) {
    console.log('Nothing to rollback')
    return
  }
  
  console.log(`Rolling back from version ${currentVersion} to ${targetVersion}`)
  
  const transaction = db.transaction(() => {
    // Rollback migrations in reverse order
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .reverse()
    
    for (const migration of migrationsToRollback) {
      if (migration.down) {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`)
        
        try {
          db.exec(migration.down)
          
          // Remove from migrations table
          db.prepare('DELETE FROM migrations WHERE version = ?').run(migration.version)
          
          console.log(`✓ Migration ${migration.version} rolled back`)
        } catch (error) {
          console.error(`✗ Rollback of migration ${migration.version} failed:`, error)
          throw error
        }
      } else {
        console.warn(`Migration ${migration.version} has no rollback script - skipping`)
      }
    }
  })
  
  transaction()
  console.log(`Database rolled back to version ${targetVersion}`)
}

// Utility to reset database (useful for development)
export function resetDatabase(): void {
  const db = getDatabase()
  
  console.log('Resetting database...')
  
  // Get all table names
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[]
  
  // Drop all tables
  const transaction = db.transaction(() => {
    for (const table of tables) {
      db.exec(`DROP TABLE IF EXISTS ${table.name}`)
    }
  })
  
  transaction()
  
  console.log('Database reset complete')
  
  // Run migrations to recreate schema
  runMigrations()
}