"use client";
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface D3RadarChartProps {
  data: {
    metric: string
    value: number
    max: number
    color?: string
  }[]
  width?: number
  height?: number
}

export default function D3RadarChart({ 
  data, 
  width = 300, 
  height = 300 
}: D3RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const radius = Math.min(width, height) / 2 - 50
    const centerX = width / 2
    const centerY = height / 2

    const g = svg
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`)

    const angleSlice = (Math.PI * 2) / data.length

    // Create radial scale
    const rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, 1]) // Normalized to 0-1

    // Normalize data
    const normalizedData = data.map(d => ({
      ...d,
      normalizedValue: d.value / d.max
    }))

    // Create grid circles
    const levels = 5
    for (let i = 0; i < levels; i++) {
      const levelFactor = (i + 1) / levels

      g.append("circle")
        .attr("r", rScale(levelFactor))
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.2)
        .attr("stroke-width", 1)
    }

    // Create axis lines and labels
    normalizedData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2
      const lineCoordinates = [
        [0, 0],
        [rScale(1) * Math.cos(angle), rScale(1) * Math.sin(angle)]
      ]

      // Axis line
      g.append("line")
        .attr("x1", lineCoordinates[0][0])
        .attr("y1", lineCoordinates[0][1])
        .attr("x2", lineCoordinates[1][0])
        .attr("y2", lineCoordinates[1][1])
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", 1)

      // Label
      const labelRadius = rScale(1) + 20
      const labelX = labelRadius * Math.cos(angle)
      const labelY = labelRadius * Math.sin(angle)

      g.append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .attr("font-size", "12px")
        .attr("font-weight", "500")
        .text(d.metric)

      // Value label
      const valueRadius = rScale(d.normalizedValue) + 8
      const valueX = valueRadius * Math.cos(angle)
      const valueY = valueRadius * Math.sin(angle)

      if (d.normalizedValue > 0.1) { // Only show if there's enough space
        g.append("text")
          .attr("x", valueX)
          .attr("y", valueY)
          .attr("dy", "0.35em")
          .attr("text-anchor", "middle")
          .attr("fill", d.color || "#3B82F6")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .text(d.value.toFixed(1))
      }
    })

    // Create the area path
    const radarLine = d3.lineRadial<typeof normalizedData[0]>()
      .angle((d, i) => angleSlice * i)
      .radius(d => rScale(d.normalizedValue))
      .curve(d3.curveLinearClosed)

    // Area fill
    g.append("path")
      .datum(normalizedData)
      .attr("d", radarLine)
      .attr("fill", "#3B82F6")
      .attr("fill-opacity", 0.2)
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 2)

    // Data points
    normalizedData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2
      const pointX = rScale(d.normalizedValue) * Math.cos(angle)
      const pointY = rScale(d.normalizedValue) * Math.sin(angle)

      g.append("circle")
        .attr("cx", pointX)
        .attr("cy", pointY)
        .attr("r", 4)
        .attr("fill", d.color || "#3B82F6")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function() {
          d3.select(this).attr("r", 6)
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 4)
        })
    })

    // Center point
    g.append("circle")
      .attr("r", 3)
      .attr("fill", "currentColor")
      .attr("opacity", 0.5)

    // Grid value labels
    for (let i = 1; i <= levels; i++) {
      const levelValue = i / levels
      g.append("text")
        .attr("x", 5)
        .attr("y", -rScale(levelValue))
        .attr("dy", "0.35em")
        .attr("fill", "currentColor")
        .attr("font-size", "10px")
        .attr("opacity", 0.6)
        .text((levelValue * 100).toFixed(0) + '%')
    }

  }, [data, width, height])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <span className="text-gray-500 dark:text-gray-400">No data available</span>
      </div>
    )
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="overflow-visible"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}