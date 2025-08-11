"use client";
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { HeartRateZones } from '@/types'

interface D3HeartRateZoneChartProps {
  heartRateZones: HeartRateZones
  workoutData?: { hr: number; duration: number }[] // HR readings over time
  width?: number
  height?: number
}

export default function D3HeartRateZoneChart({ 
  heartRateZones, 
  workoutData = [],
  width = 600, 
  height = 400 
}: D3HeartRateZoneChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredZone, setHoveredZone] = useState<number | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 60, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Zone colors matching your existing component
    const zoneColors = ['#3B82F6', '#10B981', '#F59E0B', '#F97316', '#EF4444']

    if (workoutData.length > 0) {
      // Time series view with HR zones as background
      const xScale = d3.scaleLinear()
        .domain([0, workoutData.length - 1])
        .range([0, innerWidth])

      const yScale = d3.scaleLinear()
        .domain([
          Math.min(heartRateZones.restingHR - 10, d3.min(workoutData, d => d.hr) || 0),
          Math.max(heartRateZones.maxHR + 10, d3.max(workoutData, d => d.hr) || 200)
        ])
        .range([innerHeight, 0])

      // Draw zone backgrounds
      heartRateZones.zones.forEach((zone, i) => {
        g.append("rect")
          .attr("x", 0)
          .attr("y", yScale(zone.bpm[1]))
          .attr("width", innerWidth)
          .attr("height", yScale(zone.bpm[0]) - yScale(zone.bpm[1]))
          .attr("fill", zoneColors[i])
          .attr("opacity", hoveredZone === null ? 0.1 : hoveredZone === zone.zone ? 0.2 : 0.05)
          .style("cursor", "pointer")
          .on("mouseover", () => setHoveredZone(zone.zone))
          .on("mouseout", () => setHoveredZone(null))

        // Zone labels
        g.append("text")
          .attr("x", 10)
          .attr("y", yScale((zone.bpm[0] + zone.bpm[1]) / 2))
          .attr("dy", "0.35em")
          .attr("fill", "currentColor")
          .attr("font-size", "12px")
          .attr("font-weight", "500")
          .text(`Zone ${zone.zone}`)
      })

      // HR line
      const line = d3.line<{ hr: number; duration: number }>()
        .x((d, i) => xScale(i))
        .y(d => yScale(d.hr))
        .curve(d3.curveMonotoneX)

      g.append("path")
        .datum(workoutData)
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 2)
        .attr("d", line)

      // Axes
      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d => `${Math.round(Number(d))}m`))

      g.append("g")
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -innerHeight / 2)
        .attr("fill", "currentColor")
        .style("text-anchor", "middle")
        .text("Heart Rate (bpm)")

    } else {
      // Static zone visualization
      const barHeight = innerHeight / heartRateZones.zones.length
      
      heartRateZones.zones.forEach((zone, i) => {
        const y = i * barHeight
        const barWidth = ((zone.bpm[1] - zone.bpm[0]) / (heartRateZones.maxHR - heartRateZones.restingHR)) * innerWidth

        // Zone bar
        g.append("rect")
          .attr("x", 0)
          .attr("y", y)
          .attr("width", barWidth)
          .attr("height", barHeight - 2)
          .attr("fill", zoneColors[i])
          .attr("opacity", hoveredZone === null ? 0.7 : hoveredZone === zone.zone ? 1 : 0.3)
          .attr("rx", 4)
          .style("cursor", "pointer")
          .on("mouseover", () => setHoveredZone(zone.zone))
          .on("mouseout", () => setHoveredZone(null))

        // Zone info
        g.append("text")
          .attr("x", 10)
          .attr("y", y + barHeight / 2 - 8)
          .attr("fill", "white")
          .attr("font-size", "14px")
          .attr("font-weight", "600")
          .text(`Zone ${zone.zone}: ${zone.name}`)

        g.append("text")
          .attr("x", 10)
          .attr("y", y + barHeight / 2 + 8)
          .attr("fill", "white")
          .attr("font-size", "12px")
          .text(`${zone.bpm[0]}-${zone.bpm[1]} bpm (${zone.percentage[0]}-${zone.percentage[1]}%)`)

        // Percentage indicator
        g.append("text")
          .attr("x", barWidth - 10)
          .attr("y", y + barHeight / 2)
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .attr("fill", "white")
          .attr("font-size", "16px")
          .attr("font-weight", "700")
          .text(`${zone.percentage[1] - zone.percentage[0]}%`)
      })

      // Max HR indicator
      g.append("line")
        .attr("x1", innerWidth)
        .attr("x2", innerWidth)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "currentColor")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.5)

      g.append("text")
        .attr("x", innerWidth - 5)
        .attr("y", -5)
        .attr("text-anchor", "end")
        .attr("fill", "currentColor")
        .attr("font-size", "12px")
        .text(`Max HR: ${heartRateZones.maxHR}`)
    }

  }, [heartRateZones, workoutData, width, height, hoveredZone])

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible bg-white/5 dark:bg-black/5 rounded-lg"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      
      {hoveredZone && (
        <div className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
          {heartRateZones.zones.find(z => z.zone === hoveredZone)?.description}
        </div>
      )}
    </div>
  )
}