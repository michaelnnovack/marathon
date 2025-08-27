/**
 * React hook for database initialization and management
 */

import { useEffect, useState } from 'react'
import { initializeDatabase, getDatabaseStats } from '@/lib/database'
import { isMigrationNeeded, getMigrationStatus, migrateFromLocalStorage } from '@/lib/database/migration'
import { updateFitnessMetrics } from '@/lib/fitness/metrics'

export interface DatabaseStatus {
  isInitialized: boolean
  isInitializing: boolean
  migrationNeeded: boolean
  migrationStatus?: any
  error: string | null
  stats?: {
    size: number
    tables: string[]
    totalRows: number
    lastSaved?: string
  }
}

/**
 * Hook to manage database initialization and migration
 */
export function useDatabase() {
  const [status, setStatus] = useState<DatabaseStatus>({
    isInitialized: false,
    isInitializing: false,
    migrationNeeded: false,
    error: null
  })

  useEffect(() => {
    let mounted = true

    async function initialize() {
      if (!mounted) return
      
      setStatus(prev => ({ ...prev, isInitializing: true, error: null }))

      try {
        // Check if migration is needed
        const needsMigration = await isMigrationNeeded()
        
        if (needsMigration) {
          const migrationStatus = await getMigrationStatus()
          setStatus(prev => ({
            ...prev,
            migrationNeeded: true,
            migrationStatus
          }))
        }

        // Initialize database
        await initializeDatabase()

        // Get database stats
        const stats = await getDatabaseStats()

        if (!mounted) return

        setStatus(prev => ({
          ...prev,
          isInitialized: true,
          isInitializing: false,
          stats
        }))

      } catch (error) {
        if (!mounted) return

        console.error('Database initialization failed:', error)
        setStatus(prev => ({
          ...prev,
          isInitialized: false,
          isInitializing: false,
          error: error instanceof Error ? error.message : 'Database initialization failed'
        }))
      }
    }

    // Only run in browser environment
    if (typeof window !== 'undefined') {
      initialize()
    }

    return () => {
      mounted = false
    }
  }, [])

  const performMigration = async (): Promise<boolean> => {
    try {
      setStatus(prev => ({ ...prev, isInitializing: true, error: null }))

      const result = await migrateFromLocalStorage()
      
      if (result.success) {
        // After migration, calculate fitness metrics for the last 90 days
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 90)
        
        await updateFitnessMetrics(
          startDate.toISOString().split('T')[0],
          endDate
        )

        const stats = await getDatabaseStats()
        
        setStatus(prev => ({
          ...prev,
          migrationNeeded: false,
          isInitialized: true,
          isInitializing: false,
          stats,
          error: null
        }))

        return true
      } else {
        setStatus(prev => ({
          ...prev,
          isInitializing: false,
          error: `Migration failed: ${result.errors.join(', ')}`
        }))

        return false
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      }))

      return false
    }
  }

  const refreshStats = async (): Promise<void> => {
    try {
      const stats = await getDatabaseStats()
      setStatus(prev => ({ ...prev, stats }))
    } catch (error) {
      console.error('Failed to refresh database stats:', error)
    }
  }

  return {
    ...status,
    performMigration,
    refreshStats
  }
}

/**
 * Hook for fitness metrics management
 */
export function useFitnessMetrics() {
  const [isCalculating, setIsCalculating] = useState(false)
  const [lastCalculated, setLastCalculated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const calculateMetrics = async (days = 90): Promise<boolean> => {
    try {
      setIsCalculating(true)
      setError(null)

      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      await updateFitnessMetrics(
        startDate.toISOString().split('T')[0],
        endDate
      )

      setLastCalculated(new Date().toISOString())
      return true

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to calculate fitness metrics'
      setError(errorMsg)
      console.error('Fitness metrics calculation failed:', error)
      return false

    } finally {
      setIsCalculating(false)
    }
  }

  return {
    isCalculating,
    lastCalculated,
    error,
    calculateMetrics
  }
}