"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTcx, type Activity as TcxActivity } from '@/utils/tcx'
import { parseGpx } from '@/utils/gpx'
import { useActivities, type SimpleActivity, weeklyMileageKm } from '@/store/activities'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CloudArrowUpIcon, TrashIcon, FolderOpenIcon } from '@heroicons/react/24/outline'
import ActivityCard from '@/components/ActivityCard'
// import { HeroImage, CardImage } from '@/components/UnsplashImage'
import { HeroImage, CardImage } from '@/components/SimpleFallback'

type QueueItem = {
  id: string
  file: File
  name: string
  size: number
  ext: 'tcx' | 'gpx' | 'unknown'
  status: 'pending' | 'parsing' | 'done' | 'error'
  error?: string
  addedAt: number
  progress?: number // 0-1 for parsing progress
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [concurrentLimit] = useState(2) // Process max 2 files concurrently
  const [activeProcessing, setActiveProcessing] = useState(0)
  const [uiActivities, setUiActivities] = useState<SimpleActivity[]>([])
  const acts = useActivities()
  useEffect(() => { acts.hydrate() }, [acts])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any ongoing processing when component unmounts
      setProcessing(false)
      setActiveProcessing(0)
    }
  }, [])

  const onFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    
    // Filter out files that are too large or invalid
    const validFiles = arr.filter(f => {
      if (f.size > 100 * 1024 * 1024) return false // >100MB
      if (f.size === 0) return false // Empty files
      const ext = f.name.toLowerCase()
      return ext.endsWith('.tcx') || ext.endsWith('.gpx')
    })
    
    // Warn about rejected files
    const rejectedCount = arr.length - validFiles.length
    if (rejectedCount > 0) {
      console.warn(`Rejected ${rejectedCount} files (too large, empty, or unsupported format)`)
    }
    
    const items: QueueItem[] = validFiles.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      file: f,
      name: f.name,
      size: f.size,
      ext: f.name.toLowerCase().endsWith('.tcx') ? 'tcx' : f.name.toLowerCase().endsWith('.gpx') ? 'gpx' : 'unknown',
      status: 'pending',
      addedAt: Date.now(),
    }))
    
    // Limit total queue size to prevent memory issues
    setQueue((prev) => {
      const newQueue = [...prev, ...items]
      if (newQueue.length > 50) {
        console.warn('Queue limited to 50 files. Oldest files removed.')
        return newQueue.slice(-50)
      }
      return newQueue
    })
  }, [])

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    onFiles(e.target.files)
    e.target.value = '' // allow re-selecting same files
  }, [onFiles])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      onFiles(e.dataTransfer.files)
    }
  }, [onFiles])

  const prevent = (e: React.DragEvent) => { e.preventDefault() }

  const processItem = useCallback(async (item: QueueItem) => {
    if (item.status !== 'pending') return
    
    // Check file size before processing
    if (item.size > 100 * 1024 * 1024) { // 100MB hard limit
      setQueue((prev) => prev.map(q => 
        q.id === item.id 
          ? { ...q, status: 'error', error: 'File too large (>100MB)' } 
          : q
      ))
      return
    }

    setQueue((prev) => prev.map(q => 
      q.id === item.id 
        ? { ...q, status: 'parsing', progress: 0 } 
        : q
    ))
    
    const updateProgress = (progress: number) => {
      setQueue((prev) => prev.map(q => 
        q.id === item.id 
          ? { ...q, progress } 
          : q
      ))
    }

    try {
      if (item.ext === 'tcx') {
        const parsed: TcxActivity[] = await parseTcx(item.file, updateProgress)
        const mapped: SimpleActivity[] = parsed.map(a => ({ 
          date: a.startTime, 
          distance: a.distance || 0, 
          duration: a.duration || 0, 
          avgHr: a.avgHr, 
          elevationGain: a.elevationGain 
        }))
        setUiActivities((prev) => [...prev, ...mapped])
        acts.addActivities(mapped)
      } else if (item.ext === 'gpx') {
        const parsed = await parseGpx(item.file, updateProgress)
        setUiActivities((prev) => [...prev, ...parsed])
        acts.addActivities(parsed)
      } else {
        throw new Error('Unsupported file type')
      }
      
      setQueue((prev) => prev.map(q => 
        q.id === item.id 
          ? { ...q, status: 'done', progress: 1 } 
          : q
      ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setQueue((prev) => prev.map(q => 
        q.id === item.id 
          ? { ...q, status: 'error', error: msg, progress: 0 } 
          : q
      ))
    }
  }, [acts])

  const processQueue = useCallback(async () => {
    if (processing) return
    setProcessing(true)
    
    try {
      const pendingItems = queue.filter(item => item.status === 'pending')
      const batches = []
      
      // Process items in batches to limit concurrency
      for (let i = 0; i < pendingItems.length; i += concurrentLimit) {
        batches.push(pendingItems.slice(i, i + concurrentLimit))
      }
      
      for (const batch of batches) {
        setActiveProcessing(batch.length)
        await Promise.all(batch.map(item => processItem(item)))
        setActiveProcessing(0)
        
        // Small delay between batches to keep UI responsive
        if (batch.length === concurrentLimit) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } finally {
      setProcessing(false)
      setActiveProcessing(0)
    }
  }, [processing, queue, concurrentLimit, processItem])

  useEffect(() => {
    if (queue.some(q => q.status === 'pending') && !processing) {
      void processQueue()
    }
  }, [queue, processing, processQueue])

  const total = queue.length
  const completed = queue.filter(q => q.status === 'done').length
  const errors = queue.filter(q => q.status === 'error').length

  const chartData = useMemo(() => uiActivities.map((a, i) => ({ i, km: (a.distance || 0) / 1000, min: (a.duration || 0) / 60 })), [uiActivities])

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <HeroImage 
        query="GPS watch running data athlete technology" 
        className="h-40 rounded-2xl"
      >
        <h1 className="text-3xl font-bold mb-2">Upload Activities</h1>
        <p className="text-lg opacity-90">Import your TCX and GPX files</p>
      </HeroImage>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div
            onDrop={onDrop}
            onDragOver={prevent}
            onDragEnter={prevent}
            className={`rounded-2xl border border-dashed transition-colors p-6 text-center ${
              processing 
                ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' 
                : 'border-black/20 dark:border-white/20 bg-white/40 dark:bg-black/20 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <CloudArrowUpIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm opacity-80">
              {processing ? 'Processing files...' : 'Drag and drop files here'}
            </p>
            <p className="text-xs opacity-60">
              .tcx or .gpx — max 100MB, up to 50 files
            </p>
            <div className="mt-4">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
              >
                <FolderOpenIcon className="w-4 h-4" />
                Select files
              </button>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".tcx,.gpx"
                multiple
                onChange={onSelect}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-sm opacity-80">Queue {processing && `(${activeProcessing} active)`}</div>
              <div className="text-xs opacity-70">
                {completed}/{total} done{errors ? `, ${errors} errors` : ''}
                {processing && (
                  <span className="ml-2 inline-flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                  </span>
                )}
              </div>
            </div>
            <ul className="max-h-56 overflow-auto divide-y divide-black/10 dark:divide-white/10">
              {queue.length === 0 && (
                <li className="px-4 py-3 text-sm opacity-70">No files yet. Add or drop files to begin.</li>
              )}
              {queue.map((q) => (
                <li key={q.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="truncate flex-1">
                      <div className="truncate font-medium">{q.name}</div>
                      <div className="text-xs opacity-70">{(q.size/1024/1024).toFixed(1)} MB · {q.ext.toUpperCase()}</div>
                      {q.error && <div className="text-xs text-red-600 mt-1">{q.error}</div>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${
                      q.status==='done'
                        ?'bg-green-500/20 text-green-700 dark:text-green-300'
                        :q.status==='parsing'
                        ?'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                        :q.status==='error'
                        ?'bg-red-500/20 text-red-700 dark:text-red-300'
                        :'bg-black/10 dark:bg-white/10'
                    }`}>
                      {q.status === 'parsing' && q.progress !== undefined 
                        ? `${Math.round(q.progress * 100)}%` 
                        : q.status
                      }
                    </span>
                  </div>
                  
                  {/* Progress bar for parsing files */}
                  {q.status === 'parsing' && q.progress !== undefined && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.max(q.progress * 100, 5)}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {queue.length > 0 && (
              <div className="px-4 py-3 flex gap-2">
                <button 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50" 
                  onClick={() => setQueue([])} 
                  disabled={processing}
                >
                  <TrashIcon className="w-3 h-3" />
                  Clear queue
                </button>
                <button 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5" 
                  onClick={() => {
                    setUiActivities([])
                    // Force garbage collection hint if available
                    if (typeof globalThis !== 'undefined' && 'gc' in globalThis && typeof (globalThis as { gc?: () => void }).gc === 'function') {
                      setTimeout(() => (globalThis as { gc: () => void }).gc(), 100)
                    }
                  }}
                >
                  <TrashIcon className="w-3 h-3" />
                  Clear parsed
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/60 dark:bg-black/30">
            <div className="flex items-center gap-3 mb-2">
              <CardImage 
                query="running activity data success" 
                className="w-6 h-6 rounded object-cover" 
                small={true} 
              />
              <h3 className="font-medium">Parsed Activities</h3>
            </div>
            {uiActivities.length === 0 ? (
              <div className="text-sm opacity-70">No parsed activities yet.</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto">
                {uiActivities.slice(-5).map((activity, i) => (
                  <ActivityCard 
                    key={i} 
                    activity={activity} 
                    index={uiActivities.length - 5 + i}
                  />
                ))}
                {uiActivities.length > 5 && (
                  <div className="text-xs text-center opacity-70 py-2">
                    Showing latest 5 of {uiActivities.length} activities
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-64 rounded-xl border border-black/10 dark:border-white/10 p-2 bg-white/60 dark:bg-black/30">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="i" tick={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#4f46e5" />
                <YAxis yAxisId="right" orientation="right" stroke="#16a34a" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="km" stroke="#4f46e5" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="min" stroke="#16a34a" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {!!acts.list.length && (
            <div className="h-64">
              <h4 className="font-medium mt-4">Weekly Mileage (from saved)</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyMileageKm(acts.list)}>
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="km" stroke="#4f46e5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
