import type { SimpleActivity, TrackPoint } from '@/store/activities'

export async function parseGpx(file: File): Promise<SimpleActivity[]> {
  const text = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const trks = Array.from(xml.getElementsByTagName('trk'))
  const out: SimpleActivity[] = []
  for (const trk of trks) {
    const pts = Array.from(trk.getElementsByTagName('trkpt'))
    let dist = 0
    let elevGain = 0
    let lastLat: number|undefined, lastLon: number|undefined, lastEle: number|undefined
    let startTime: string | undefined
    let endTime: string | undefined
    const trackPoints: TrackPoint[] = []
    
    for (const p of pts) {
      const lat = parseFloat(p.getAttribute('lat')||'0')
      const lon = parseFloat(p.getAttribute('lon')||'0')
      const ele = parseFloat(p.getElementsByTagName('ele')[0]?.textContent||'0')
      const time = p.getElementsByTagName('time')[0]?.textContent||undefined
      
      // Store track point (sample every 10th point to reduce data size)
      if (trackPoints.length % 10 === 0 || trackPoints.length < 100) {
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
    const dur = startTime && endTime ? (new Date(endTime).getTime()-new Date(startTime).getTime())/1000 : 0
    out.push({ 
      date: startTime, 
      distance: dist, 
      duration: dur, 
      elevationGain: Math.round(elevGain),
      trackPoints: trackPoints.length > 0 ? trackPoints : undefined
    })
  }
  return out
}
