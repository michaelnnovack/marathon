"use client";
import { useState, Suspense } from 'react'
import { Workout, HeartRateZones } from '@/types'
import { LoadingCard } from '@/components/LoadingSpinner'
import dynamic from 'next/dynamic'

// Dynamically import D3 components to reduce initial bundle size
const D3TrainingProgress = dynamic(() => import('@/components/D3TrainingProgress'), {
  loading: () => <LoadingCard className="h-96" />
})
const D3HeartRateZoneChart = dynamic(() => import('@/components/D3HeartRateZoneChart'), {
  loading: () => <LoadingCard className="h-64" />
})
const D3PaceDistribution = dynamic(() => import('@/components/D3PaceDistribution'), {
  loading: () => <LoadingCard className="h-80" />
})
const D3RadarChart = dynamic(() => import('@/components/D3RadarChart'), {
  loading: () => <LoadingCard className="h-96" />
})

// Sample data for demonstration
const sampleWorkouts: Workout[] = [
  {
    id: '1',
    date: '2024-01-01',
    type: 'easy',
    description: 'Easy run',
    duration: 45,
    completed: true,
    actualData: {
      distance: 8000, // 8km
      duration: 2700, // 45 minutes
      avgHr: 145,
      elevationGain: 50,
      trainingLoad: 85
    }
  },
  {
    id: '2',
    date: '2024-01-03',
    type: 'tempo',
    description: 'Tempo run',
    duration: 35,
    completed: true,
    actualData: {
      distance: 6000,
      duration: 2100,
      avgHr: 165,
      elevationGain: 30,
      trainingLoad: 120
    }
  },
  {
    id: '3',
    date: '2024-01-05',
    type: 'long',
    description: 'Long run',
    duration: 90,
    completed: true,
    actualData: {
      distance: 15000,
      duration: 5400,
      avgHr: 150,
      elevationGain: 120,
      trainingLoad: 180
    }
  },
  {
    id: '4',
    date: '2024-01-07',
    type: 'interval',
    description: 'Speed intervals',
    duration: 40,
    completed: true,
    actualData: {
      distance: 5500,
      duration: 2400,
      avgHr: 175,
      elevationGain: 20,
      trainingLoad: 145
    }
  },
  {
    id: '5',
    date: '2024-01-10',
    type: 'easy',
    description: 'Recovery run',
    duration: 30,
    completed: true,
    actualData: {
      distance: 5000,
      duration: 1800,
      avgHr: 140,
      elevationGain: 25,
      trainingLoad: 65
    }
  }
]

const sampleHeartRateZones: HeartRateZones = {
  maxHR: 190,
  restingHR: 60,
  lastUpdated: new Date().toISOString(),
  zones: [
    {
      zone: 1,
      name: 'Active Recovery',
      percentage: [50, 60],
      bpm: [125, 138],
      description: 'Very light intensity for recovery and warm-up',
      color: '#3B82F6'
    },
    {
      zone: 2,
      name: 'Aerobic Base',
      percentage: [60, 70],
      bpm: [138, 151],
      description: 'Easy conversational pace, builds aerobic base',
      color: '#10B981'
    },
    {
      zone: 3,
      name: 'Aerobic',
      percentage: [70, 80],
      bpm: [151, 164],
      description: 'Moderate intensity, comfortably hard effort',
      color: '#F59E0B'
    },
    {
      zone: 4,
      name: 'Lactate Threshold',
      percentage: [80, 90],
      bpm: [164, 177],
      description: 'Hard intensity, sustainable for ~1 hour',
      color: '#F97316'
    },
    {
      zone: 5,
      name: 'VO2 Max',
      percentage: [90, 100],
      bpm: [177, 190],
      description: 'Very hard, maximum sustainable for 3-8 minutes',
      color: '#EF4444'
    }
  ]
}

const sampleHRData = Array.from({ length: 50 }, (_, i) => ({
  hr: 140 + Math.sin(i * 0.3) * 20 + Math.random() * 10,
  duration: i
}))

const fitnessMetrics = [
  { metric: 'Endurance', value: 8.5, max: 10, color: '#3B82F6' },
  { metric: 'Speed', value: 6.2, max: 10, color: '#EF4444' },
  { metric: 'Strength', value: 7.1, max: 10, color: '#10B981' },
  { metric: 'Recovery', value: 9.0, max: 10, color: '#F59E0B' },
  { metric: 'Consistency', value: 8.8, max: 10, color: '#8B5CF6' },
  { metric: 'Flexibility', value: 5.5, max: 10, color: '#F97316' }
]

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState('progress')
  const goalPaceSeconds = 4 * 60 + 30 // 4:30 per km

  const tabs = [
    { id: 'progress', name: 'Training Progress', icon: '📈' },
    { id: 'heart-rate', name: 'Heart Rate Zones', icon: '❤️' },
    { id: 'pace', name: 'Pace Distribution', icon: '⏱️' },
    { id: 'fitness', name: 'Fitness Radar', icon: '🎯' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            D3.js Data Visualizations
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Interactive charts for marathon training analytics
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Chart Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          {activeTab === 'progress' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Training Progress Over Time
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Track your workout progression with interactive scatter plots showing distance, pace, and workout types.
              </p>
              <div className="overflow-x-auto">
                <Suspense fallback={<LoadingCard className="h-96" />}>
                  <D3TrainingProgress workouts={sampleWorkouts} width={800} height={400} />
                </Suspense>
              </div>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>• Bubble size represents pace (larger = slower)</p>
                <p>• Colors indicate workout types</p>
                <p>• Hover over points for detailed information</p>
              </div>
            </div>
          )}

          {activeTab === 'heart-rate' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Heart Rate Zone Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Visualize your heart rate zones and training intensity distribution.
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Zone Overview</h3>
                  <Suspense fallback={<LoadingCard className="h-64" />}>
                    <D3HeartRateZoneChart 
                      heartRateZones={sampleHeartRateZones} 
                      width={500} 
                      height={300} 
                    />
                  </Suspense>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Sample Workout HR Profile</h3>
                  <Suspense fallback={<LoadingCard className="h-64" />}>
                    <D3HeartRateZoneChart 
                      heartRateZones={sampleHeartRateZones} 
                      workoutData={sampleHRData}
                      width={500} 
                      height={300} 
                    />
                  </Suspense>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>• Zone colors match your training intensity levels</p>
                <p>• Hover over zones to see descriptions</p>
                <p>• Time series shows HR progression during workouts</p>
              </div>
            </div>
          )}

          {activeTab === 'pace' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Pace Distribution Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Analyze your pace patterns across different workout types and compare to your goal pace.
              </p>
              <Suspense fallback={<LoadingCard className="h-80" />}>
                <D3PaceDistribution 
                  workouts={sampleWorkouts} 
                  width={600} 
                  height={350}
                  goalPace={goalPaceSeconds}
                />
              </Suspense>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>• Red dashed line shows your goal marathon pace</p>
                <p>• Green dashed line shows your average pace</p>
                <p>• Filter by workout type using the buttons above</p>
                <p>• Histogram shows frequency distribution of your paces</p>
              </div>
            </div>
          )}

          {activeTab === 'fitness' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Fitness Assessment Radar
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Multi-dimensional view of your training progress across key fitness metrics.
              </p>
              <div className="flex justify-center">
                <Suspense fallback={<LoadingCard className="h-96 w-96" />}>
                  <D3RadarChart data={fitnessMetrics} width={400} height={400} />
                </Suspense>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">Metrics Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {fitnessMetrics.map(metric => (
                    <div key={metric.metric} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: metric.color }}
                      />
                      <div>
                        <div className="font-medium">{metric.metric}</div>
                        <div className="text-sm opacity-70">{metric.value}/10</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Integration Instructions */}
        <div className="mt-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            🚀 How to Integrate These Components
          </h3>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300">
              These D3.js components are ready to use in your marathon training app:
            </p>
            <ul className="text-gray-600 dark:text-gray-300 space-y-2">
              <li><strong>D3TrainingProgress:</strong> Perfect for your main dashboard to show workout trends</li>
              <li><strong>D3HeartRateZoneChart:</strong> Enhance your existing HeartRateZones component</li>
              <li><strong>D3PaceDistribution:</strong> Add to plan pages to analyze pace consistency</li>
              <li><strong>D3RadarChart:</strong> Great for athlete profile or progress assessment pages</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 mt-4">
              Each component is fully responsive, supports dark mode, and integrates with your existing TypeScript interfaces.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}