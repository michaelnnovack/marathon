"use client";
import { Suspense, lazy } from 'react'
import { LoadingSkeleton } from './LoadingSpinner'

// Lazy load Recharts components
const ResponsiveContainer = lazy(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })))
const LineChart = lazy(() => import('recharts').then(mod => ({ default: mod.LineChart })))
const Line = lazy(() => import('recharts').then(mod => ({ default: mod.Line })))
const XAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })))
const YAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })))
const Tooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })))

interface LazyChartProps {
  data: Record<string, unknown>[]
  height?: string
  dataKey?: string
  xAxisKey?: string
  stroke?: string
}

function ChartContent({ data, height = "100%", dataKey = "km", xAxisKey = "week", stroke = "#4f46e5" }: LazyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} stroke={stroke} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function LazyChart(props: LazyChartProps) {
  return (
    <Suspense fallback={
      <div className="h-48 sm:h-56 md:h-64 flex items-center justify-center">
        <LoadingSkeleton lines={8} className="w-full h-full" />
      </div>
    }>
      <ChartContent {...props} />
    </Suspense>
  )
}