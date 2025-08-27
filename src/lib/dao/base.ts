import Database from 'better-sqlite3'
import { getDatabase } from '../database'

/**
 * Base Data Access Object with common database operations
 */
export abstract class BaseDAO {
  protected db: Database.Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Execute a prepared statement with retry logic
   */
  protected executeWithRetry<T>(
    statement: Database.Statement<any[], T>,
    params?: any[],
    maxRetries = 3
  ): T {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return params ? statement.get(...params) : statement.get()
      } catch (error) {
        lastError = error as Error
        
        // Check if it's a database locked error
        if (lastError.message.includes('database is locked') && attempt < maxRetries) {
          console.warn(`Database locked on attempt ${attempt}, retrying...`)
          // Wait before retry with exponential backoff
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000)
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
          continue
        }
        
        throw lastError
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Execute multiple statements in a transaction
   */
  protected executeTransaction<T>(operations: () => T): T {
    const transaction = this.db.transaction(operations)
    return transaction()
  }

  /**
   * Get current timestamp in ISO format
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString()
  }

  /**
   * Validate date string format
   */
  protected validateDateString(dateString: string): boolean {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  /**
   * Convert JavaScript object to JSON string safely
   */
  protected toJsonString(obj: any): string | null {
    try {
      return obj ? JSON.stringify(obj) : null
    } catch (error) {
      console.error('Failed to serialize object to JSON:', error)
      return null
    }
  }

  /**
   * Parse JSON string safely
   */
  protected fromJsonString<T>(jsonString: string | null): T | null {
    if (!jsonString) return null
    
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      console.error('Failed to parse JSON string:', error)
      return null
    }
  }
}