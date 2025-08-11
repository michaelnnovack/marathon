"use client"
import { useEffect, useState } from 'react'

export function useSize<T extends HTMLElement>() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    // No-op on server
  }, [])

  function attach(node: T | null) {
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      const box = entry.contentRect
      setSize({ width: Math.max(0, box.width), height: Math.max(0, box.height) })
    })
    ro.observe(node)
    // Set initial size
    const rect = node.getBoundingClientRect()
    setSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) })
    ;(node as unknown as { __ro?: ResizeObserver }).__ro = ro
  }

  function detach(node: T | null) {
    if (!node) return
    const ro: ResizeObserver | undefined = (node as unknown as { __ro?: ResizeObserver }).__ro
    if (ro) ro.disconnect()
  }

  return { size, attach, detach }
}
