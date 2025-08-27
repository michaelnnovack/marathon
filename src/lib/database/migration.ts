// Stub database migration to prevent SSR issues

console.warn('Database migration functionality is temporarily stubbed to prevent SSR issues')

export interface MigrationResult {
  success: boolean
  migratedData: {
    activities: number
    userPreferences: boolean
    achievements: number
    personalRecords: number
  }
  warnings: string[]
  errors: string[]
}

export async function isMigrationNeeded() {
  return false
}

export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  return {
    success: true,
    migratedData: {
      activities: 0,
      userPreferences: false,
      achievements: 0,
      personalRecords: 0
    },
    warnings: [],
    errors: []
  }
}

export async function validateMigration() {
  return { valid: true, issues: [] }
}

export async function rollbackMigration() {
  return { success: true, warnings: [] }
}