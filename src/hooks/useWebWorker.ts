import { useCallback, useRef } from 'react'
import type { SimpleActivity } from '@/store/activities'

interface WorkerData {
  activities: SimpleActivity[]
}

export function useWebWorker() {
  const workerRef = useRef<Worker | null>(null)
  
  const initWorker = useCallback(() => {
    if (typeof window === 'undefined' || workerRef.current) return
    
    try {
      workerRef.current = new Worker('/workers/activityProcessor.js')
    } catch (error) {
      console.warn('Web Worker not supported or failed to load:', error)
    }
  }, [])
  
  const calculateAsync = useCallback((type: string, data: WorkerData): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        initWorker()
        if (!workerRef.current) {
          reject(new Error('Web Worker not available'))
          return
        }
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Worker calculation timeout'))
      }, 5000) // 5 second timeout
      
      const handleMessage = (e: MessageEvent) => {
        clearTimeout(timeout)
        workerRef.current?.removeEventListener('message', handleMessage)
        resolve(e.data.data)
      }
      
      workerRef.current.addEventListener('message', handleMessage)
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
      calculateAsync('CALCULATE_WEEKLY_MILEAGE', { activities }),
    calculateLast7Days: (activities: SimpleActivity[]) => 
      calculateAsync('CALCULATE_LAST_7_DAYS', { activities }),
    predictMarathonTime: (activities: SimpleActivity[]) => 
      calculateAsync('PREDICT_MARATHON_TIME', { activities }),
    cleanup
  }
}