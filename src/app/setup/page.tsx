"use client";
import { useEffect, useMemo, useState, Suspense, lazy, useCallback, useRef } from 'react'
import { useUserStore } from '@/store/user'
import { useActivities } from '@/store/activities'
import { CheckIcon, CalendarIcon, ClockIcon, ArrowUturnLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
// Removed HeroImage import for clean design
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { parseTcx, type Activity as TcxActivity } from '@/utils/tcx'
import { parseGpx } from '@/utils/gpx'
import type { SimpleActivity } from '@/types'

// 🚀 Lazy load the heavy HeartRateZones component
const HeartRateZones = lazy(() => import('@/components/HeartRateZones'))

// Loading fallback for HeartRateZones
const HeartRateZonesLoader = () => (
  <Card className="animate-pulse">
    <div className="space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>
  </Card>
)

function isValidHHMMSS(v: string) {
  const m = v.match(/^([0-1]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  return !!m
}

type UploadItem = {
  id: string
  file: File
  name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
  activitiesAdded?: number
  duplicatesSkipped?: number
}

export default function SetupPage() {
  const user = useUserStore((s) => s.user)
  const setRaceDate = useUserStore((s) => s.setRaceDate)
  const setGoalTime = useUserStore((s) => s.setGoalTime)
  const hydrate = useUserStore((s) => s.hydrate)
  const acts = useActivities()
  
  const [race, setRace] = useState<string>("")
  const [goal, setGoal] = useState<string>("")
  const goalValid = useMemo(() => (goal ? isValidHHMMSS(goal) : true), [goal])
  
  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (user?.raceDate) setRace(user.raceDate)
    if (user?.goalTime) setGoal(user.goalTime)
  }, [user?.raceDate, user?.goalTime])

  // Upload handling functions
  const processFile = useCallback(async (item: UploadItem) => {
    setUploads(prev => prev.map(u => 
      u.id === item.id ? { ...u, status: 'processing' } : u
    ))

    try {
      let activities: SimpleActivity[] = []
      const ext = item.file.name.toLowerCase().split('.').pop()

      if (ext === 'tcx') {
        const parsed: TcxActivity[] = await parseTcx(item.file)
        activities = parsed.map(a => ({ 
          date: a.startTime, 
          distance: a.distance || 0, 
          duration: a.duration || 0, 
          avgHr: a.avgHr, 
          elevationGain: a.elevationGain 
        }))
      } else if (ext === 'gpx') {
        activities = await parseGpx(item.file)
      } else {
        throw new Error('Unsupported file type. Please use TCX or GPX files.')
      }

      const result = acts.addActivities(activities)
      
      setUploads(prev => prev.map(u => 
        u.id === item.id ? { 
          ...u, 
          status: 'done',
          activitiesAdded: result.added,
          duplicatesSkipped: result.duplicates
        } : u
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setUploads(prev => prev.map(u => 
        u.id === item.id ? { ...u, status: 'error', error: message } : u
      ))
    }
  }, [acts])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => {
      const ext = file.name.toLowerCase().split('.').pop()
      return ext === 'tcx' || ext === 'gpx'
    })

    const newUploads: UploadItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      status: 'pending' as const
    }))

    setUploads(prev => [...prev, ...newUploads])
  }, [])

  const processUploads = useCallback(async () => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      const pendingUploads = uploads.filter(u => u.status === 'pending')
      for (const upload of pendingUploads) {
        await processFile(upload)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [uploads, isProcessing, processFile])

  // Auto-process uploads
  useEffect(() => {
    if (uploads.some(u => u.status === 'pending') && !isProcessing) {
      processUploads()
    }
  }, [uploads, isProcessing, processUploads])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
    e.target.value = '' // Reset input
  }, [handleFiles])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const prevent = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center py-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Training Setup</h1>
        <p className="text-lg opacity-70">Configure your race goals and training zones</p>
      </div>
      
      {/* Race Configuration */}
      <Card>
        <h2 className="font-medium mb-4">Race Configuration</h2>
        <div className="grid gap-4 max-w-lg">
          <label className="grid gap-1">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <CalendarIcon className="w-4 h-4" />
              Race Date
            </div>
            <input
              type="date"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="grid gap-1">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <ClockIcon className="w-4 h-4" />
              Goal Time (HH:MM:SS)
            </div>
            <input
              placeholder="03:30:00"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className={`px-3 py-2 rounded-lg border bg-white/60 dark:bg-black/30 focus:outline-none focus:ring-2 ${
                goal && !goalValid 
                  ? 'border-red-400 focus:ring-red-500' 
                  : 'border-black/10 dark:border-white/10 focus:ring-indigo-500'
              }`}
            />
            {goal && !goalValid && (
              <span className="text-xs text-red-500">Enter time as HH:MM:SS</span>
            )}
          </label>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => {
                if (race) setRaceDate(race)
                if (goalValid && goal) setGoalTime(goal)
              }}
              leftIcon={<CheckIcon className="w-4 h-4" />}
            >
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (user?.raceDate) setRace(user.raceDate)
                if (user?.goalTime) setGoal(user.goalTime)
              }}
              leftIcon={<ArrowUturnLeftIcon className="w-4 h-4" />}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Activity Data Upload */}
      <Card>
        <h2 className="font-medium mb-4">Training Data Upload</h2>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onDrop={onDrop}
            onDragOver={prevent}
            onDragEnter={prevent}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload your training files
            </p>
            <p className="text-sm text-gray-500">
              Drop TCX or GPX files here, or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".tcx,.gpx"
              multiple
              className="hidden"
              onChange={onFileSelect}
            />
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Upload Progress</span>
                <span className="text-gray-600">
                  {uploads.filter(u => u.status === 'done').length}/{uploads.length} completed
                </span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{upload.name}</div>
                      {upload.status === 'done' && (
                        <div className="text-xs text-green-600">
                          {upload.activitiesAdded} activities added
                          {upload.duplicatesSkipped && upload.duplicatesSkipped > 0 && (
                            <span className="text-orange-600"> • {upload.duplicatesSkipped} duplicates skipped</span>
                          )}
                        </div>
                      )}
                      {upload.error && (
                        <div className="text-xs text-red-600">{upload.error}</div>
                      )}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      upload.status === 'done' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                        : upload.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                        : upload.status === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {upload.status === 'processing' && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          Processing
                        </div>
                      )}
                      {upload.status === 'done' && 'Complete'}
                      {upload.status === 'error' && 'Error'}
                      {upload.status === 'pending' && 'Pending'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-1"><strong>Supported formats:</strong> TCX and GPX files from GPS watches</p>
            <p><strong>What happens:</strong> Your training data is analyzed for performance insights and duplicate activities are automatically filtered out.</p>
          </div>
        </div>
      </Card>

      {/* Heart Rate Zones - Lazy Loaded */}
      <ErrorBoundaryWrapper 
        componentName="HeartRateZones"
        fallback={
          <Card>
            <div className="text-center py-8">
              <p className="text-red-600 mb-2">Failed to load Heart Rate Zones</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Card>
        }
      >
        <Suspense fallback={<HeartRateZonesLoader />}>
          <HeartRateZones />
        </Suspense>
      </ErrorBoundaryWrapper>
    </div>
  )
}
