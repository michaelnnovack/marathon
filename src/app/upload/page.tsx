"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTcx, type Activity as TcxActivity } from '@/utils/tcx'
import { parseGpx } from '@/utils/gpx'
import { useActivities, type SimpleActivity, weeklyMileageKm } from '@/store/activities'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import ActivityCard from '@/components/ActivityCard'

type QueueItem = {
  id: string
  file: File
  name: string
  size: number
  ext: 'tcx' | 'gpx' | 'unknown'
  status: 'pending' | 'parsing' | 'done' | 'error'
  error?: string
  addedAt: number
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [uiActivities, setUiActivities] = useState<SimpleActivity[]>([])
  const acts = useActivities()
  useEffect(() => { acts.hydrate() }, [acts])

  const onFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const items: QueueItem[] = arr.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      file: f,
      name: f.name,
      size: f.size,
      ext: f.name.toLowerCase().endsWith('.tcx') ? 'tcx' : f.name.toLowerCase().endsWith('.gpx') ? 'gpx' : 'unknown',
      status: 'pending',
      addedAt: Date.now(),
    }))
    setQueue((prev) => [...prev, ...items])
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

  const processQueue = useCallback(async () => {
    if (processing) return
    setProcessing(true)
    try {
      for (const item of queue) {
        if (item.status !== 'pending') continue
        setQueue((prev) => prev.map(q => q.id === item.id ? { ...q, status: 'parsing' } : q))
        try {
          if (item.ext === 'tcx') {
            const parsed: TcxActivity[] = await parseTcx(item.file)
            const mapped: SimpleActivity[] = parsed.map(a => ({ date: a.startTime, distance: a.distance || 0, duration: a.duration || 0, avgHr: a.avgHr, elevationGain: a.elevationGain }))
            setUiActivities((prev) => [...prev, ...mapped])
            acts.addActivities(mapped)
          } else if (item.ext === 'gpx') {
            const parsed = await parseGpx(item.file)
            setUiActivities((prev) => [...prev, ...parsed])
            acts.addActivities(parsed)
          } else {
            throw new Error('Unsupported file type')
          }
          setQueue((prev) => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q))
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          setQueue((prev) => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: msg } : q))
        }
      }
    } finally {
      setProcessing(false)
    }
  }, [acts, processing, queue])

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
      <h1 className="text-xl font-semibold">Upload Activities (TCX / GPX)</h1>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div
            onDrop={onDrop}
            onDragOver={prevent}
            onDragEnter={prevent}
            className="rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-white/40 dark:bg-black/20 p-6 text-center"
          >
            <p className="text-sm opacity-80">Drag and drop files here</p>
            <p className="text-xs opacity-60">.tcx or .gpx — single or multiple</p>
            <div className="mt-4">
              <button
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => fileInputRef.current?.click()}
              >
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
              <div className="text-sm opacity-80">Queue</div>
              <div className="text-xs opacity-70">{completed}/{total} done{errors ? `, ${errors} errors` : ''}</div>
            </div>
            <ul className="max-h-56 overflow-auto divide-y divide-black/10 dark:divide-white/10">
              {queue.length === 0 && (
                <li className="px-4 py-3 text-sm opacity-70">No files yet. Add or drop files to begin.</li>
              )}
              {queue.map((q) => (
                <li key={q.id} className="px-4 py-3 text-sm flex items-center justify-between">
                  <div className="truncate">
                    <div className="truncate font-medium">{q.name}</div>
                    <div className="text-xs opacity-70">{(q.size/1024).toFixed(1)} KB · {q.ext.toUpperCase()}</div>
                    {q.error && <div className="text-xs text-red-600">{q.error}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${q.status==='done'?'bg-green-500/20 text-green-700 dark:text-green-300':q.status==='parsing'?'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300':q.status==='error'?'bg-red-500/20 text-red-700 dark:text-red-300':'bg-black/10 dark:bg-white/10'}`}>{q.status}</span>
                </li>
              ))}
            </ul>
            {queue.length > 0 && (
              <div className="px-4 py-3 flex gap-2">
                <button className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10" onClick={() => setQueue([])}>Clear queue</button>
                <button className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10" onClick={() => setUiActivities([])}>Clear parsed</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/60 dark:bg-black/30">
            <h3 className="font-medium mb-2">Parsed Activities</h3>
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
