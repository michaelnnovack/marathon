# Unified Coaching Dashboard Design Specification

## Executive Summary

This document outlines a comprehensive single-page coaching dashboard that eliminates tabs and consolidates all training data into a scannable, trust-first interface. The design prioritizes "glance and go" functionality with a 5-second information hierarchy.

## Core Design Principles

### 1. Information Hierarchy
**Primary → Secondary → Contextual**
- **Today** (Hero section): Today's workout with immediate action
- **This Week** (Progress section): Weekly mileage progress and run overview  
- **Race Readiness** (Assessment section): Performance metrics and zones
- **Heart Rate Zones** (Reference section): Always accessible but not dominant

### 2. Progressive Disclosure
- Core metrics always visible
- Details expand on demand
- No-nonsense data presentation
- Forward-looking coaching focus

### 3. Mobile-First Responsive
- Single column on mobile (320px+)
- Two-column on tablet (768px+)
- Three-column on desktop (1024px+)

## Page Layout Structure

```
┌─────────────────────────────────────────────┐
│ HEADER: Marathon Coach • Sync Status        │
├─────────────────────────────────────────────┤
│ 1. TODAY'S WORKOUT (Hero Section)          │
│    [Type • Distance at Pace]                │
│    [Detailed intervals if applicable]        │
│    [Mark Complete] [Modify Plan]            │
├─────────────────────────────────────────────┤
│ 2. THIS WEEK (Progress Section)            │
│    ┌─────────────┬─────────────┬──────────┐ │
│    │ Weekly Mile │ Today's HR  │ Run List │ │
│    │ Progress    │ Zones       │ Overview │ │
│    │ 42.5/65 km  │ Z2: 135-148 │ M: 8K    │ │
│    │ [Progress   │ Z3: 148-165 │ T: Rest  │ │
│    │  Bar 65%]   │ Z4: 165-180 │ W: Tempo │ │
│    └─────────────┴─────────────┴──────────┘ │
├─────────────────────────────────────────────┤
│ 3. RACE READINESS (Assessment Section)     │
│    ┌─────────────┬─────────────┬──────────┐ │
│    │ Marathon    │ Comparison  │ Readiness│ │
│    │ Prediction  │ vs Last Week│ Score    │ │
│    │ 3:15:32     │ +2.3km      │ 78/100   │ │
│    │ (On track)  │ +15s/km     │ Good     │ │
│    └─────────────┴─────────────┴──────────┘ │
├─────────────────────────────────────────────┤
│ 4. POST-WORKOUT FEEDBACK (Dynamic)         │
│    [Appears immediately after completing]   │
│    Performance • Effort • Next Steps        │
└─────────────────────────────────────────────┘
```

## Component Specifications

### 1. Header Component
```tsx
interface HeaderProps {
  userName: string
  lastSyncTime: string
  syncStatus: 'syncing' | 'synced' | 'error'
  onSync: () => void
}
```

**Visual Design:**
- Fixed position header (60px height)
- Coach name with personalization
- Sync status indicator with timestamp
- Sync button (disabled during sync)

### 2. Today's Workout (Hero Section)
```tsx
interface TodaysWorkoutProps {
  workout: {
    type: string           // "Tempo Run"
    distance: string       // "8K"
    pace: string          // "5:45/km" 
    intervals?: {         // For complex workouts
      warmup: string      // "1K easy"
      mainSet: string[]   // ["3x2K @ 5:45", "400m recovery"]
      cooldown: string    // "1K easy"
    }
    heartRateZones?: {
      target: number      // Primary zone (2, 3, 4, etc.)
      range: [number, number] // [135, 148]
    }
    reasoning: string     // Coach explanation
    priority: 'essential' | 'recommended' | 'optional'
  }
  onComplete: () => void
  onModify: () => void
}
```

**Visual Design:**
- Large, prominent card (gradient background)
- Workout type badge with icon
- Distance and pace as primary text (32px)
- Expandable intervals section for complex workouts
- Heart rate zone indicator (colored pill)
- Action buttons (complete/modify)
- Reasoning text (16px, muted)

### 3. Weekly Progress Section
```tsx
interface WeeklyProgressProps {
  weeklyMileage: {
    current: number       // 42.5
    target: number       // 65
    percentage: number   // 65.4
    trend: 'up' | 'down' | 'stable'
  }
  todaysHeartRateZones: {
    zone: number
    name: string
    range: [number, number]
    color: string
  }[]
  weeklyRunsOverview: {
    day: string          // "Mon", "Tue", etc.
    type: string         // "Easy", "Tempo", "Rest"
    distance?: string    // "8K"
    completed: boolean
    isPaceTarget?: boolean // For long runs with splits
    paceSplits?: string[] // ["6:30", "6:15", "6:00"]
  }[]
}
```

**Layout (Desktop 3-column, Mobile stacked):**

**Column 1: Weekly Mileage Progress**
- Large progress bar (current/target)
- Percentage completion
- Trend indicator (arrow + percentage)
- Weekly comparison vs last week

**Column 2: Heart Rate Zones (Quick Reference)**
- Compact zone list (Z1-Z5)
- BPM ranges only
- Color-coded indicators
- Expandable for full calculator

**Column 3: Weekly Runs Overview**
- 7-day grid (Mon-Sun)
- Run type + distance
- Completion checkmarks
- Today highlighted
- Long runs show pace splits on hover

### 4. Race Readiness Section
```tsx
interface RaceReadinessProps {
  marathonPrediction: {
    time: string         // "3:15:32"
    confidence: 'high' | 'medium' | 'low'
    onTrack: boolean     // vs goal time
    improvement: string  // "+30s vs last month"
  }
  weeklyComparison: {
    distance: string     // "+2.3km vs last week"
    pace: string        // "+15s/km vs last week"  
    trend: 'improving' | 'stable' | 'declining'
  }
  readinessScore: {
    overall: number      // 78
    components: {
      aerobic: number    // 85
      speed: number      // 70
      endurance: number  // 82
      recovery: number   // 75
    }
    recommendations: string[]
  }
}
```

**Layout (Desktop 3-column, Mobile stacked):**

**Column 1: Marathon Prediction**
- Large time display
- On-track indicator (green/yellow/red)
- Confidence level
- Improvement trend

**Column 2: Weekly Comparison**
- Distance vs last week
- Average pace vs last week
- Speed/endurance arrows
- Trend visualization

**Column 3: Readiness Score**
- Overall score (large number)
- Component breakdown (mini bars)
- Top 2 recommendations
- Expandable for full analysis

### 5. Post-Workout Feedback (Dynamic)
```tsx
interface PostWorkoutFeedbackProps {
  feedback: {
    performance: string   // "Strong tempo effort today"
    effort: string       // "Heart rate stayed in target zone"
    nextSteps: string    // "Easy run tomorrow for recovery"
    encouragement: string // "You're building great fitness"
  }
  metrics: {
    averagePace: string
    heartRateEfficiency: number
    trainingLoad: 'low' | 'moderate' | 'high'
  }
  onDismiss: () => void
}
```

**Visual Design:**
- Slides in immediately after workout completion
- Coach avatar with personalized feedback
- Performance metrics summary
- Dismissible after reading
- Auto-dismiss after 30 seconds

## Progressive Disclosure Patterns

### 1. Heart Rate Zones
**Collapsed State:**
```
HR Zones: Z2 (135-148) • Z3 (148-165) • Z4 (165-180)
[Expand Calculator]
```

**Expanded State:**
```
Heart Rate Zones Calculator
Age: [28] Resting HR: [52] Custom Max: [_]
Z1: Recovery     125-135 bpm  (Very light)
Z2: Aerobic      135-148 bpm  (Conversational)
Z3: Tempo        148-165 bpm  (Comfortably hard)
Z4: Threshold    165-180 bpm  (Hard, ~1 hour)  
Z5: VO2 Max      180-190 bpm  (Very hard, 3-8 min)
```

### 2. Weekly Runs Overview
**Collapsed State:**
```
This Week: 5/7 runs complete • Next: Tempo Run
```

**Expanded State:**
```
Mon: 8K Easy ✓      Thu: 12K Tempo →
Tue: Rest ✓         Fri: 6K Easy
Wed: 6x400m ✓       Sat: Rest  
                    Sun: 20K Long
```

### 3. Readiness Score Details
**Collapsed State:**
```
Race Readiness: 78/100 (Good)
```

**Expanded State:**
```
Aerobic Base:     ████████░░ 85%
Speed Work:       ███████░░░ 70%  
Endurance:        ████████░░ 82%
Recovery:         ███████░░░ 75%

Recommendations:
• Increase weekly speed work frequency
• Focus on Z2 aerobic base building
```

## Mobile-First Responsive Breakpoints

### Mobile (320px - 767px)
- Single column layout
- Stacked sections
- Simplified progress bars
- Touch-optimized buttons (44px min)
- Collapsed details by default

### Tablet (768px - 1023px)  
- Two-column layout for progress section
- Expanded heart rate zones
- Larger touch targets
- Side-by-side comparisons

### Desktop (1024px+)
- Three-column layout for main sections
- All details visible
- Hover states
- Keyboard navigation
- Advanced tooltips

## Data Flow Architecture

### 1. Real-time Updates
```typescript
interface DashboardState {
  todaysWorkout: WorkoutRecommendation
  weeklyProgress: WeeklyMileage & RunsOverview
  raceReadiness: RaceReadinessScore
  postWorkoutFeedback?: PostWorkoutFeedback
  heartRateZones: HeartRateZones
  lastUpdated: string
}
```

### 2. Update Triggers
- **Page load**: Fetch complete dashboard state
- **Workout completion**: Show feedback immediately
- **Weekly rollover**: Refresh weekly data
- **Manual sync**: Update from intervals.icu
- **Settings change**: Recalculate zones/targets

### 3. Caching Strategy
- Dashboard state: 15 minutes
- Heart rate zones: Until user settings change  
- Weekly progress: 1 hour
- Post-workout feedback: Session only

## Performance Considerations

### 1. Critical Rendering Path
- Today's workout loads first (hero section)
- Progressive enhancement for secondary sections
- Skeleton loaders for delayed content
- Error boundaries for each section

### 2. Bundle Optimization
- Code splitting by section
- Lazy load heart rate calculator
- Defer non-critical visualizations
- Optimize image loading

### 3. Accessibility
- WCAG 2.1 AA compliance
- Screen reader optimization
- Keyboard navigation
- High contrast mode support
- Reduced motion preferences

## Coach Personality Implementation

### 1. Voice and Tone
- **Direct**: "Your tempo pace today is 5:45/km"
- **Data-driven**: "Heart rate efficiency up 3% this week"
- **Forward-looking**: "Tomorrow's easy run will aid recovery"
- **No-nonsense**: Eliminate filler words and excessive encouragement

### 2. Feedback Patterns
```typescript
const coachFeedback = {
  performance: {
    strong: "Solid effort - you hit your target zones consistently",
    average: "Good work - slight pace variation but strong overall",
    below: "Tough session - focus on recovery and tomorrow's easy run"
  },
  nextSteps: {
    recovery: "Easy 6K tomorrow for active recovery",
    maintain: "Continue current training intensity", 
    increase: "Ready to step up - next week adds 5km to your long run"
  }
}
```

### 3. Contextual Coaching
- Pre-workout: Focus on execution
- During taper: Emphasize confidence
- After hard session: Prioritize recovery
- Before race: Trust training, stay calm

## Implementation Priority

### Phase 1: Core Dashboard (Week 1)
1. Today's workout hero section
2. Weekly mileage progress bar
3. Basic heart rate zones display
4. Weekly runs overview

### Phase 2: Enhanced Features (Week 2)
1. Race readiness scoring
2. Post-workout feedback system
3. Progressive disclosure interactions
4. Mobile responsive design

### Phase 3: Advanced Intelligence (Week 3)
1. Predictive workout recommendations
2. Injury risk assessment
3. Performance trend analysis
4. Advanced coaching feedback

This unified dashboard eliminates decision paralysis by presenting all critical information in a scannable hierarchy, while maintaining the depth and intelligence of a professional coaching system.