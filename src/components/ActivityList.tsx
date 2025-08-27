"use client"
import React, { useMemo, useRef } from 'react'
import type { SimpleActivity } from '@/types'
import { FixedSizeList as List, areEqual } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import dynamic from 'next/dynamic'
import { LoadingCard } from './LoadingSpinner'

const ActivityCard = dynamic(() => import('./ActivityCard'), { ssr: false, loading: () => <LoadingCard /> })

interface ActivityListProps {
  activities: SimpleActivity[]
  itemHeight?: number
  overscanCount?: number
  ariaLabel?: string
}

// Row renderer with memoization to avoid unnecessary re-renders
type RowData = { items: SimpleActivity[] }
const Row = React.memo(function Row({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) {
  const activity = data.items[index]
  return (
    <div style={style} className="px-1">
      <ActivityCard activity={activity} index={index} />
    </div>
  )
}, areEqual)

export default function ActivityList({ activities, itemHeight = 132, overscanCount = 6, ariaLabel = 'Activities' }: ActivityListProps) {
  const items = useMemo(() => activities.slice().reverse(), [activities]) // newest first
  const listRef = useRef<List>(null)

  // Reserved for future analytics hooks

  if (!activities.length) {
    return <div className="text-sm opacity-70">Your activities are syncing from intervals.icu...</div>
  }

  return (
    <div aria-label={ariaLabel} role="list" className="h-[540px] rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <List
            ref={listRef}
            height={height}
            width={width}
            itemCount={items.length}
            itemData={{ items } as RowData}
            itemSize={itemHeight}
            overscanCount={overscanCount}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  )
}
