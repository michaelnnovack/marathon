-- Marathon Training Database Schema
-- Optimized for fast queries and coaching intelligence

-- User preferences and coaching settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'michael',
    units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
    theme TEXT NOT NULL DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
    notifications_workout_reminders INTEGER DEFAULT 1,
    notifications_achievement_alerts INTEGER DEFAULT 1,
    notifications_weekly_reports INTEGER DEFAULT 1,
    privacy_share_progress INTEGER DEFAULT 0,
    privacy_public_profile INTEGER DEFAULT 0,
    coaching_enabled INTEGER DEFAULT 1,
    coaching_intensity TEXT DEFAULT 'moderate' CHECK (coaching_intensity IN ('conservative', 'moderate', 'aggressive')),
    coaching_focus TEXT DEFAULT 'endurance', -- JSON array of focus areas
    auto_rest_days INTEGER DEFAULT 1,
    max_weekly_mileage REAL,
    race_date TEXT, -- ISO date string
    goal_time TEXT, -- HH:MM:SS format
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Activities with enhanced coaching metadata
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'michael',
    date TEXT NOT NULL, -- ISO date string
    distance REAL NOT NULL, -- meters
    duration INTEGER NOT NULL, -- seconds
    avg_hr INTEGER,
    max_hr INTEGER,
    elevation_gain REAL, -- meters
    calories INTEGER,
    avg_pace REAL, -- meters per second
    type TEXT DEFAULT 'easy' CHECK (type IN ('easy', 'tempo', 'interval', 'long', 'recovery', 'cross', 'race')),
    
    -- Coaching metadata
    training_stress_score REAL, -- TSS calculated from HR/power
    intensity_factor REAL, -- IF for the workout
    coaching_notes TEXT,
    perceived_exertion INTEGER CHECK (perceived_exertion BETWEEN 1 AND 10),
    weather_conditions TEXT,
    terrain TEXT,
    
    -- GPS track data (JSON)
    track_points TEXT, -- JSON array of TrackPoint objects
    
    -- Source and sync info
    source TEXT DEFAULT 'intervals_icu',
    external_id TEXT, -- ID from intervals.icu or other sources
    synced_at TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(external_id, source)
);

-- Training plans with dynamic adaptation
CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'michael',
    name TEXT NOT NULL,
    type TEXT DEFAULT 'marathon' CHECK (type IN ('5k', '10k', 'half_marathon', 'marathon', 'custom')),
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    
    -- Plan configuration
    start_date TEXT NOT NULL, -- ISO date
    race_date TEXT, -- ISO date
    goal_time TEXT, -- HH:MM:SS
    weekly_mileage_target REAL,
    
    -- Dynamic adaptation state
    current_week INTEGER DEFAULT 1,
    adaptation_factor REAL DEFAULT 1.0, -- Multiplier for plan intensity
    last_adapted_at TEXT,
    
    -- Plan structure (JSON)
    weeks_data TEXT NOT NULL, -- JSON array of Week objects
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily coach recommendations and workout history
CREATE TABLE IF NOT EXISTS coach_recommendations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'michael',
    date TEXT NOT NULL, -- ISO date string
    
    -- Recommended workout
    workout_type TEXT NOT NULL CHECK (workout_type IN ('easy', 'tempo', 'interval', 'long', 'recovery', 'cross', 'rest')),
    distance_target REAL, -- meters, null for rest days
    duration_target INTEGER, -- seconds
    pace_target REAL, -- meters per second
    hr_zone_target INTEGER, -- 1-5
    
    -- Coaching rationale
    recommendation_reason TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.7 CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    
    -- Adaptation factors
    fitness_readiness REAL, -- 0-1 scale based on CTL/ATL
    fatigue_factor REAL, -- 0-1 scale
    motivation_factor REAL, -- 0-1 scale
    
    -- Completion tracking
    completed INTEGER DEFAULT 0,
    actual_activity_id TEXT,
    completion_notes TEXT,
    
    -- Coach feedback
    adherence_score REAL, -- How well did they follow the recommendation
    next_day_adjustment TEXT, -- Adjustments for tomorrow
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(user_id, date),
    FOREIGN KEY (actual_activity_id) REFERENCES activities(id)
);

-- Fitness metrics for advanced coaching (CTL/ATL/TSB curves)
CREATE TABLE IF NOT EXISTS fitness_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'michael',
    date TEXT NOT NULL, -- ISO date string
    
    -- Core Training Load metrics
    chronic_training_load REAL NOT NULL DEFAULT 0, -- CTL (42-day exponential average)
    acute_training_load REAL NOT NULL DEFAULT 0,   -- ATL (7-day exponential average)
    training_stress_balance REAL NOT NULL DEFAULT 0, -- TSB = CTL - ATL
    
    -- Daily metrics
    daily_training_stress REAL DEFAULT 0, -- TSS for the day
    daily_duration INTEGER DEFAULT 0, -- Total training seconds
    daily_distance REAL DEFAULT 0, -- Total training meters
    
    -- Readiness indicators
    fitness_level REAL, -- 0-100 scale derived from CTL
    fatigue_level REAL, -- 0-100 scale derived from ATL
    form_level REAL,    -- -100 to +100 scale derived from TSB
    
    -- Recovery metrics
    resting_hr INTEGER,
    hrv_score REAL, -- Heart Rate Variability if available
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    
    -- Performance indicators
    vo2_max_estimate REAL,
    lactate_threshold_pace REAL, -- meters per second
    aerobic_efficiency REAL, -- pace at aerobic threshold
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(user_id, date)
);

-- Workout completion tracking for detailed analysis
CREATE TABLE IF NOT EXISTS workout_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'michael',
    planned_workout_id TEXT, -- From training plan or coach recommendation
    actual_activity_id TEXT,
    
    -- Completion assessment
    completion_type TEXT CHECK (completion_type IN ('completed', 'modified', 'skipped', 'replaced')),
    adherence_percentage REAL CHECK (adherence_percentage BETWEEN 0 AND 100),
    
    -- Planned vs Actual comparison
    planned_distance REAL,
    actual_distance REAL,
    planned_duration INTEGER,
    actual_duration INTEGER,
    planned_pace REAL,
    actual_pace REAL,
    
    -- Subjective feedback
    perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
    enjoyment_rating INTEGER CHECK (enjoyment_rating BETWEEN 1 AND 5),
    completion_notes TEXT,
    
    -- Coach analysis
    performance_analysis TEXT,
    next_workout_adjustments TEXT,
    
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (actual_activity_id) REFERENCES activities(id)
);

-- Performance indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source, external_id);

CREATE INDEX IF NOT EXISTS idx_coach_recommendations_date ON coach_recommendations(date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_recommendations_user_date ON coach_recommendations(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_recommendations_completed ON coach_recommendations(completed);

CREATE INDEX IF NOT EXISTS idx_fitness_metrics_date ON fitness_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_fitness_metrics_user_date ON fitness_metrics(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_workout_completions_date ON workout_completions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_completions_activity ON workout_completions(actual_activity_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
    AFTER UPDATE ON user_preferences
BEGIN
    UPDATE user_preferences SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_activities_timestamp 
    AFTER UPDATE ON activities
BEGIN
    UPDATE activities SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_training_plans_timestamp 
    AFTER UPDATE ON training_plans
BEGIN
    UPDATE training_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_coach_recommendations_timestamp 
    AFTER UPDATE ON coach_recommendations
BEGIN
    UPDATE coach_recommendations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS recent_activities AS
SELECT 
    id, date, distance, duration, type, avg_hr, training_stress_score,
    ROUND(distance/1000.0, 2) as distance_km,
    ROUND(duration/60.0, 1) as duration_minutes,
    CASE WHEN avg_pace > 0 THEN ROUND(1000.0/avg_pace, 2) ELSE NULL END as pace_min_per_km
FROM activities 
WHERE user_id = 'michael'
ORDER BY date DESC 
LIMIT 50;

CREATE VIEW IF NOT EXISTS weekly_fitness_summary AS
SELECT 
    DATE(date, 'weekday 1', '-7 days') as week_start,
    AVG(chronic_training_load) as avg_ctl,
    AVG(acute_training_load) as avg_atl,
    AVG(training_stress_balance) as avg_tsb,
    SUM(daily_training_stress) as weekly_tss,
    SUM(daily_distance)/1000.0 as weekly_km,
    COUNT(*) as days_with_data
FROM fitness_metrics 
WHERE user_id = 'michael'
GROUP BY DATE(date, 'weekday 1', '-7 days')
ORDER BY week_start DESC
LIMIT 12;

CREATE VIEW IF NOT EXISTS coaching_adherence AS
SELECT 
    DATE(date, 'weekday 1', '-7 days') as week_start,
    COUNT(*) as total_recommendations,
    SUM(completed) as completed_workouts,
    ROUND(100.0 * SUM(completed) / COUNT(*), 1) as adherence_percentage,
    AVG(adherence_score) as avg_adherence_score
FROM coach_recommendations
WHERE user_id = 'michael'
GROUP BY DATE(date, 'weekday 1', '-7 days')
ORDER BY week_start DESC
LIMIT 12;