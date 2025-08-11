import { useCallback, useRef } from 'react'
import type { SimpleActivity, PredictionResult, WeeklyMileage } from '@/types'

interface WorkerMessage {
  type: string
  data?: unknown
  error?: string
  progress?: number
}

interface ProcessedData {
  totalDistance: number
  totalDuration: number
  avgPace: number
  totalActivities: number
  last7Days: number
  last30Days: number
  activitiesWithGPS: number
}

export function useWebWorker() {
  const workerRef = useRef<Worker | null>(null)
  
  const initWorker = useCallback(() => {
    if (typeof window === 'undefined' || workerRef.current) return
    
    try {
      workerRef.current = new Worker('/workers/dataProcessor.js')
    } catch (error) {
      console.warn('Web Worker not supported or failed to load:', error)
    }
  }, [])
  
  const calculateAsync = useCallback((
    type: string, 
    data: { activities: SimpleActivity[] },
    onProgress?: (progress: number) => void
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        initWorker()
        if (!workerRef.current) {
          reject(new Error('Web Worker not available'))
          return
        }
      }
      
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Worker calculation timeout'))
      }, 30000) // 30 second timeout for heavy calculations
      
      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        const { type: responseType, data: responseData, error, progress } = e.data
        
        if (error) {
          cleanup()
          reject(new Error(error))
          return
        }
        
        if (responseType === 'PROGRESS' && progress !== undefined && onProgress) {
          onProgress(progress)
          return
        }
        
        // Check for matching response types
        const expectedTypes = {
          'CALCULATE_WEEKLY_MILEAGE': 'WEEKLY_MILEAGE_RESULT',
          'PROCESS_ACTIVITIES': 'ACTIVITIES_PROCESSED', 
          'CALCULATE_PREDICTIONS': 'PREDICTION_RESULT'
        }
        
        if (responseType === expectedTypes[type as keyof typeof expectedTypes]) {
          cleanup()
          resolve(responseData)
        }
      }
      
      const handleError = (error: ErrorEvent) => {
        cleanup()
        reject(new Error(error.message || 'Worker error'))
      }
      
      const cleanup = () => {
        clearTimeout(timeout)
        if (workerRef.current) {
          workerRef.current.removeEventListener('message', handleMessage)
          workerRef.current.removeEventListener('error', handleError)
        }
      }
      
      workerRef.current.addEventListener('message', handleMessage)
      workerRef.current.addEventListener('error', handleError)
      workerRef.current.postMessage({ type, data })
    })
  }, [initWorker])
  
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])
  
  return {
    calculateWeeklyMileage: (activities: SimpleActivity[]) => 
      calculateAsync('CALCULATE_WEEKLY_MILEAGE', { activities }) as Promise<WeeklyMileage[]>,
    
    processActivities: (activities: SimpleActivity[], onProgress?: (progress: number) => void) =>
      calculateAsync('PROCESS_ACTIVITIES', { activities }, onProgress) as Promise<ProcessedData>,
    
    predictMarathonTime: (activities: SimpleActivity[]) => 
      calculateAsync('CALCULATE_PREDICTIONS', { activities }) as Promise<PredictionResult>,
    
    cleanup
  }
}