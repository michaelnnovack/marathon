"use client";
import { useState, useMemo } from 'react'
import { HeartRateZones as HRZones, HeartRateZone } from '@/types'

function calculateMaxHR(age: number, method: 'tanaka' | 'fox' = 'tanaka'): number {
  switch (method) {
    case 'tanaka':
      return Math.round(208 - (0.7 * age))
    case 'fox':
    default:
      return Math.round(220 - age)
  }
}

function calculateZones(maxHR: number, restingHR: number): HeartRateZone[] {
  const hrReserve = maxHR - restingHR
  
  return [
    {
      zone: 1,
      name: 'Active Recovery',
      percentage: [50, 60],
      bpm: [
        Math.round(restingHR + (hrReserve * 0.50)),
        Math.round(restingHR + (hrReserve * 0.60))
      ],
      description: 'Very light intensity for recovery and warm-up'
    },
    {
      zone: 2,
      name: 'Aerobic Base',
      percentage: [60, 70],
      bpm: [
        Math.round(restingHR + (hrReserve * 0.60)),
        Math.round(restingHR + (hrReserve * 0.70))
      ],
      description: 'Easy conversational pace, builds aerobic base'
    },
    {
      zone: 3,
      name: 'Aerobic',
      percentage: [70, 80],
      bpm: [
        Math.round(restingHR + (hrReserve * 0.70)),
        Math.round(restingHR + (hrReserve * 0.80))
      ],
      description: 'Moderate intensity, comfortably hard effort'
    },
    {
      zone: 4,
      name: 'Lactate Threshold',
      percentage: [80, 90],
      bpm: [
        Math.round(restingHR + (hrReserve * 0.80)),
        Math.round(restingHR + (hrReserve * 0.90))
      ],
      description: 'Hard intensity, sustainable for ~1 hour'
    },
    {
      zone: 5,
      name: 'VO2 Max',
      percentage: [90, 100],
      bpm: [
        Math.round(restingHR + (hrReserve * 0.90)),
        maxHR
      ],
      description: 'Very hard, maximum sustainable for 3-8 minutes'
    }
  ]
}

export default function HeartRateZones() {
  const [age, setAge] = useState<string>('')
  const [restingHR, setRestingHR] = useState<string>('')
  const [maxHR, setMaxHR] = useState<string>('')
  const [useCustomMax, setUseCustomMax] = useState(false)

  const heartRateZones: HRZones | null = useMemo(() => {
    const ageNum = parseInt(age)
    const restingNum = parseInt(restingHR)
    
    if (!ageNum || !restingNum || ageNum < 10 || ageNum > 100 || restingNum < 30 || restingNum > 100) {
      return null
    }

    let maxHRValue: number
    if (useCustomMax && maxHR) {
      const customMax = parseInt(maxHR)
      if (customMax < 100 || customMax > 250) return null
      maxHRValue = customMax
    } else {
      maxHRValue = calculateMaxHR(ageNum, 'tanaka')
    }

    if (maxHRValue <= restingNum) return null

    return {
      maxHR: maxHRValue,
      restingHR: restingNum,
      zones: calculateZones(maxHRValue, restingNum)
    }
  }, [age, restingHR, maxHR, useCustomMax])

  const getZoneColor = (zone: number) => {
    const colors = [
      'bg-blue-500',    // Zone 1
      'bg-green-500',   // Zone 2  
      'bg-yellow-500',  // Zone 3
      'bg-orange-500',  // Zone 4
      'bg-red-500'      // Zone 5
    ]
    return colors[zone - 1] || 'bg-gray-500'
  }

  return (
    <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
      <h3 className="font-medium mb-4">Heart Rate Zones Calculator</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm opacity-70 mb-1">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="25"
            min="10"
            max="100"
            className="w-full px-3 py-2 rounded-lg border border-black/20 dark:border-white/20 bg-white dark:bg-black/50 text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm opacity-70 mb-1">Resting HR (bpm)</label>
          <input
            type="number"
            value={restingHR}
            onChange={(e) => setRestingHR(e.target.value)}
            placeholder="60"
            min="30"
            max="100"
            className="w-full px-3 py-2 rounded-lg border border-black/20 dark:border-white/20 bg-white dark:bg-black/50 text-sm"
          />
        </div>

        <div>
          <label className="flex items-center text-sm opacity-70 mb-1">
            <input
              type="checkbox"
              checked={useCustomMax}
              onChange={(e) => setUseCustomMax(e.target.checked)}
              className="mr-2"
            />
            Custom Max HR
          </label>
          <input
            type="number"
            value={maxHR}
            onChange={(e) => setMaxHR(e.target.value)}
            placeholder={age ? calculateMaxHR(parseInt(age)).toString() : "190"}
            min="100"
            max="250"
            disabled={!useCustomMax}
            className="w-full px-3 py-2 rounded-lg border border-black/20 dark:border-white/20 bg-white dark:bg-black/50 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {heartRateZones ? (
        <div className="space-y-3">
          <div className="text-sm opacity-70 mb-3">
            Max HR: {heartRateZones.maxHR} bpm | Resting HR: {heartRateZones.restingHR} bpm | HR Reserve: {heartRateZones.maxHR - heartRateZones.restingHR} bpm
          </div>
          
          {heartRateZones.zones.map((zone) => (
            <div key={zone.zone} className="flex items-center gap-3 p-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/30 dark:bg-black/20">
              <div className={`w-8 h-8 rounded-full ${getZoneColor(zone.zone)} flex items-center justify-center text-white text-sm font-medium`}>
                {zone.zone}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-sm">{zone.name}</div>
                    <div className="text-xs opacity-70">{zone.description}</div>
                  </div>
                  <div className="text-right mt-1 sm:mt-0">
                    <div className="font-medium text-sm">{zone.bpm[0]}-{zone.bpm[1]} bpm</div>
                    <div className="text-xs opacity-70">{zone.percentage[0]}-{zone.percentage[1]}% HRR</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="text-xs opacity-70 mt-4 space-y-1">
            <p>• HRR = Heart Rate Reserve (Max HR - Resting HR)</p>
            <p>• Max HR calculated using Tanaka formula: 208 - (0.7 × age)</p>
            <p>• For best accuracy, determine your actual max HR through testing</p>
          </div>
        </div>
      ) : (
        <div className="text-sm opacity-70 text-center py-8">
          Enter your age and resting heart rate to calculate your training zones
        </div>
      )}
    </div>
  )
}