"use client";
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Workout, WorkoutType } from '@/types'

interface D3TrainingProgressProps {
  workouts: Workout[]
  width?: number
  height?: number
}

const workoutColors: Record<WorkoutType, string> = {
  easy: '#10B981',
  tempo: '#F59E0B',
  interval: '#EF4444',
  long: '#3B82F6',
  recovery: '#8B5CF6',
  cross: '#6B7280'
}

export default function D3TrainingProgress({ 
  workouts, 
  width = 800, 
  height = 400 
}: D3TrainingProgressProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredData, setHoveredData] = useState<Workout | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!svgRef.current || !workouts.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Parse dates and get completed workouts with actual data
    const completedWorkouts = workouts
      .filter(w => w.completed && w.actualData?.distance && w.actualData?.duration)
      .map(w => ({
        ...w,
        parsedDate: new Date(w.date),
        pace: (w.actualData?.duration || 0) / ((w.actualData?.distance || 1) / 1000), // seconds per km
        distance: w.actualData!.distance! / 1000 // convert to km
      }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())

    if (!completedWorkouts.length) {
      g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("class", "fill-current opacity-50")
        .text("No completed workouts with data available")
      return
    }

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(completedWorkouts, d => d.parsedDate) as [Date, Date])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain(d3.extent(completedWorkouts, d => d.distance) as [number, number])
      .nice()
      .range([innerHeight, 0])

    const radiusScale = d3.scaleSqrt()
      .domain(d3.extent(completedWorkouts, d => d.pace) as [number, number])
      .range([4, 12])

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => d3.timeFormat("%m/%d")(d as Date)))
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 35)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("Date")

    g.append("g")
      .call(d3.axisLeft(yScale))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -innerHeight / 2)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("Distance (km)")

    // Trend line
    const line = d3.line<typeof completedWorkouts[0]>()
      .x(d => xScale(d.parsedDate))
      .y(d => yScale(d.distance))
      .curve(d3.curveMonotoneX)

    g.append("path")
      .datum(completedWorkouts)
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 2)
      .attr("opacity", 0.3)
      .attr("d", line)

    // Workout points
    g.selectAll(".workout-point")
      .data(completedWorkouts)
      .enter()
      .append("circle")
      .attr("class", "workout-point")
      .attr("cx", d => xScale(d.parsedDate))
      .attr("cy", d => yScale(d.distance))
      .attr("r", d => radiusScale(d.pace))
      .attr("fill", d => workoutColors[d.type])
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-width", 3)
        setHoveredData(d)
        setMousePosition({ x: event.pageX, y: event.pageY })
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke-width", 2)
        setHoveredData(null)
      })

    // Legend
    const legend = g.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${innerWidth - 120}, 10)`)

    const workoutTypes = Object.keys(workoutColors) as WorkoutType[]
    const legendItems = legend.selectAll(".legend-item")
      .data(workoutTypes)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`)

    legendItems.append("circle")
      .attr("r", 6)
      .attr("fill", d => workoutColors[d])
      .attr("stroke", "white")
      .attr("stroke-width", 1)

    legendItems.append("text")
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "currentColor")
      .style("font-size", "12px")
      .text(d => d.charAt(0).toUpperCase() + d.slice(1))

  }, [workouts, width, height])

  const formatPace = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      
      {hoveredData && (
        <div
          className="absolute z-10 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm pointer-events-none"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-medium mb-1">
            {hoveredData.type.charAt(0).toUpperCase() + hoveredData.type.slice(1)} Run
          </div>
          <div className="text-xs space-y-1 opacity-80">
            <div>Date: {new Date(hoveredData.date).toLocaleDateString()}</div>
            <div>Distance: {(hoveredData.actualData!.distance! / 1000).toFixed(2)} km</div>
            <div>Duration: {formatDuration(hoveredData.actualData!.duration!)}</div>
            <div>Pace: {formatPace(hoveredData.actualData!.duration! / (hoveredData.actualData!.distance! / 1000))} /km</div>
            {hoveredData.actualData?.avgHr && (
              <div>Avg HR: {hoveredData.actualData.avgHr} bpm</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}