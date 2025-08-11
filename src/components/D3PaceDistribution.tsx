"use client";
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Workout, WorkoutType } from '@/types'

interface D3PaceDistributionProps {
  workouts: Workout[]
  width?: number
  height?: number
  goalPace?: number // seconds per km
}

export default function D3PaceDistribution({ 
  workouts, 
  width = 500, 
  height = 300,
  goalPace 
}: D3PaceDistributionProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')

  useEffect(() => {
    if (!svgRef.current || !workouts.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Filter and process workouts
    const validWorkouts = workouts
      .filter(w => 
        w.completed && 
        w.actualData?.distance && 
        w.actualData?.duration &&
        (selectedType === 'all' || w.type === selectedType)
      )
      .map(w => ({
        ...w,
        pace: (w.actualData?.duration || 0) / ((w.actualData?.distance || 1) / 1000) // seconds per km
      }))

    if (!validWorkouts.length) {
      g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("class", "fill-current opacity-50")
        .text("No data available for selected workout type")
      return
    }

    // Create histogram
    const paceExtent = d3.extent(validWorkouts, d => d.pace) as [number, number]
    const paceRange = paceExtent[1] - paceExtent[0]
    const binCount = Math.min(15, Math.max(5, Math.floor(validWorkouts.length / 3)))
    
    const histogram = d3.histogram<typeof validWorkouts[0], number>()
      .value(d => d.pace)
      .domain([paceExtent[0] - paceRange * 0.1, paceExtent[1] + paceRange * 0.1])
      .thresholds(binCount)

    const bins = histogram(validWorkouts)

    // Scales
    const xScale = d3.scaleLinear()
      .domain([paceExtent[0] - paceRange * 0.1, paceExtent[1] + paceRange * 0.1])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length) || 0])
      .nice()
      .range([innerHeight, 0])

    // Bars
    const bars = g.selectAll(".bar")
      .data(bins)
      .enter()
      .append("g")
      .attr("class", "bar")

    bars.append("rect")
      .attr("x", d => xScale(d.x0!))
      .attr("y", d => yScale(d.length))
      .attr("width", d => Math.max(0, xScale(d.x1!) - xScale(d.x0!) - 1))
      .attr("height", d => innerHeight - yScale(d.length))
      .attr("fill", "#3B82F6")
      .attr("opacity", 0.7)
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("rx", 2)

    // Goal pace line
    if (goalPace && goalPace >= paceExtent[0] && goalPace <= paceExtent[1]) {
      g.append("line")
        .attr("x1", xScale(goalPace))
        .attr("x2", xScale(goalPace))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#EF4444")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")

      g.append("text")
        .attr("x", xScale(goalPace))
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("fill", "#EF4444")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .text("Goal Pace")
    }

    // Average pace line
    const avgPace = d3.mean(validWorkouts, d => d.pace) ?? 0
    g.append("line")
      .attr("x1", xScale(avgPace))
      .attr("x2", xScale(avgPace))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#10B981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3")

    g.append("text")
      .attr("x", xScale(avgPace))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#10B981")
      .attr("font-size", "11px")
      .text("Average")

    // Axes
    const formatPace = (seconds: number) => {
      const minutes = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => formatPace(d as number)))
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 35)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("Pace (min/km)")

    g.append("g")
      .call(d3.axisLeft(yScale))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("x", -innerHeight / 2)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("Workouts")

    // Statistics text
    const stats = g.append("g")
      .attr("class", "stats")
      .attr("transform", `translate(${innerWidth - 120}, 10)`)

    stats.append("text")
      .attr("y", 0)
      .attr("fill", "currentColor")
      .attr("font-size", "11px")
      .text(`Workouts: ${validWorkouts.length}`)

    stats.append("text")
      .attr("y", 15)
      .attr("fill", "currentColor")
      .attr("font-size", "11px")
      .text(`Avg: ${formatPace(avgPace)}`)

    if (goalPace) {
      const improvement = ((avgPace - goalPace) / goalPace) * 100
      stats.append("text")
        .attr("y", 30)
        .attr("fill", improvement > 0 ? "#EF4444" : "#10B981")
        .attr("font-size", "11px")
        .text(`${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`)
    }

  }, [workouts, selectedType, width, height, goalPace])

  const workoutTypes: (WorkoutType | 'all')[] = ['all', 'easy', 'tempo', 'interval', 'long']

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {workoutTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible bg-white/5 dark:bg-black/5 rounded-lg"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  )
}