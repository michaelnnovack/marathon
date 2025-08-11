import type { SimpleActivity, TrackPoint } from '@/store/activities'

// Helper function to yield control back to the UI
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if ('scheduler' in globalThis && (globalThis as typeof globalThis & { scheduler?: { postTask?: (callback: () => void, options: { priority: string }) => void } }).scheduler?.postTask) {
      ((globalThis as typeof globalThis & { scheduler: { postTask: (callback: () => void, options: { priority: string }) => void } }).scheduler.postTask)(() => resolve(), { priority: 'user-blocking' })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

export async function parseGpx(
  file: File,
  onProgress?: (progress: number) => void
): Promise<SimpleActivity[]> {
  // Limit file size to prevent memory issues
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('File too large. Maximum size is 50MB.')
  }

  const text = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const trks = Array.from(xml.getElementsByTagName('trk'))
  const out: SimpleActivity[] = []
  const totalTracks = trks.length
  
  for (let trackIndex = 0; trackIndex < trks.length; trackIndex++) {
    const trk = trks[trackIndex]
    
    // Report progress
    onProgress?.(trackIndex / totalTracks)
    const pts = Array.from(trk.getElementsByTagName('trkpt'))
    let dist = 0
    let elevGain = 0
    let lastLat: number|undefined, lastLon: number|undefined, lastEle: number|undefined
    let startTime: string | undefined
    let endTime: string | undefined
    const trackPoints: TrackPoint[] = []
    
    // Process points in batches to prevent UI blocking
    const batchSize = 200
    for (let i = 0; i < pts.length; i += batchSize) {
      const batch = pts.slice(i, i + batchSize)
      
      for (const p of batch) {
        const lat = parseFloat(p.getAttribute('lat')||'0')
        const lon = parseFloat(p.getAttribute('lon')||'0')
        const ele = parseFloat(p.getElementsByTagName('ele')[0]?.textContent||'0')
        const time = p.getElementsByTagName('time')[0]?.textContent||undefined
        
        // More aggressive sampling: every 25th point or first 40 points
        const shouldSample = trackPoints.length < 40 || trackPoints.length % 25 === 0
        if (shouldSample && trackPoints.length < 800) { // Cap at 800 points
          trackPoints.push({
            lat,
            lng: lon,
            elevation: ele || undefined,
            time
          })
        }
        
        if (!startTime && time) startTime = time
        if (time) endTime = time
        if (lastLat !== undefined && lastLon !== undefined) {
          const R = 6371000
          const toRad = (x:number)=>x*Math.PI/180
          const dLat = toRad(lat - lastLat)
          const dLon = toRad(lon - lastLon)
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lastLat))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2
          const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          dist += R*c
        }
        if (lastEle !== undefined && ele > lastEle) elevGain += (ele - lastEle)
        lastLat = lat; lastLon = lon; lastEle = ele
      }
      
      // Yield control after each batch
      if (i + batchSize < pts.length) {
        await yieldToMain()
      }
    }
    const dur = startTime && endTime ? (new Date(endTime).getTime()-new Date(startTime).getTime())/1000 : 0
    out.push({ 
      date: startTime, 
      distance: dist, 
      duration: dur, 
      elevationGain: Math.round(elevGain),
      trackPoints: trackPoints.length > 0 ? trackPoints : undefined
    })
  }
  
  onProgress?.(1) // Complete
  return out
}
