-- Marathon Training Database Schema
-- Optimized for local SQLite storage with coach calculations

-- Users table - single user for now but extensible
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    race_date TEXT, -- ISO date string
    goal_time TEXT, -- HH:MM:SS format
    level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    current_fitness REAL, -- 0-100 scale
    max_heart_rate INTEGER,
    resting_heart_rate INTEGER,
    weight REAL, -- kg
    height REAL, -- cm
    date_of_birth TEXT, -- ISO date
    preferences_json TEXT, -- JSON blob for flexibility
    stats_json TEXT, -- JSON blob for user stats
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Activities table - core training data
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL, -- ISO date string
    distance REAL NOT NULL, -- meters
    duration REAL NOT NULL, -- seconds
    avg_hr INTEGER,
    max_hr INTEGER,
    elevation_gain REAL, -- meters
    calories INTEGER,
    avg_pace REAL, -- meters per second
    type TEXT CHECK (type IN ('easy', 'tempo', 'interval', 'long', 'recovery', 'cross', 'race')),
    track_points_json TEXT, -- JSON array of GPS points
    intervals_icu_id TEXT UNIQUE, -- for sync tracking
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Training plans table
CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL, -- ISO date
    end_date TEXT NOT NULL, -- ISO date
    target_race_date TEXT, -- ISO date
    current_week INTEGER DEFAULT 1,
    focus_areas_json TEXT, -- JSON array
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workouts table - planned workouts
CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    training_plan_id TEXT REFERENCES training_plans(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL, -- ISO date
    type TEXT CHECK (type IN ('easy', 'tempo', 'interval', 'long', 'recovery', 'cross', 'race')),
    description TEXT NOT NULL,
    target_pace TEXT, -- pace target
    duration INTEGER NOT NULL, -- minutes
    target_distance REAL, -- meters, optional
    completed BOOLEAN DEFAULT FALSE,
    actual_activity_id TEXT REFERENCES activities(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Coach recommendations table - AI coach insights
CREATE TABLE IF NOT EXISTS coach_recommendations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('training_load', 'recovery', 'pacing', 'workout_suggestion', 'race_strategy')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    data_json TEXT, -- supporting data as JSON
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    valid_until TEXT, -- ISO date when recommendation expires
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fitness calculations table - for CTL/ATL/TSB calculations
CREATE TABLE IF NOT EXISTS fitness_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL, -- ISO date
    ctl REAL, -- Chronic Training Load (fitness)
    atl REAL, -- Acute Training Load (fatigue)
    tsb REAL, -- Training Stress Balance (form)
    training_load REAL, -- daily training load
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('distance', 'streak', 'pace', 'consistency', 'milestone')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    threshold REAL NOT NULL,
    unit TEXT,
    category TEXT CHECK (category IN ('bronze', 'silver', 'gold', 'platinum')),
    unlocked_at TEXT, -- ISO date when achieved
    progress REAL DEFAULT 0.0 CHECK (progress BETWEEN 0.0 AND 1.0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personal records table
CREATE TABLE IF NOT EXISTS personal_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon', 'longest_run', 'most_elevation')),
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO date
    activity_id TEXT REFERENCES activities(id),
    previous_record REAL, -- previous best for comparison
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
-- Activities indexes (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_date_range ON activities(date, user_id);
CREATE INDEX IF NOT EXISTS idx_activities_intervals_icu ON activities(intervals_icu_id);

-- Fitness calculations indexes (for coach analysis)
CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON fitness_calculations(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fitness_date_range ON fitness_calculations(date, user_id);

-- Coach recommendations indexes
CREATE INDEX IF NOT EXISTS idx_coach_user_created ON coach_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_unread ON coach_recommendations(user_id, is_read, is_dismissed);

-- Workouts indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_plan_date ON workouts(training_plan_id, date);

-- Achievements and records indexes
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id, type);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON personal_records(user_id, type);

-- Views for common queries
-- Recent activities view (last 90 days)
CREATE VIEW IF NOT EXISTS recent_activities AS
SELECT * FROM activities 
WHERE date >= date('now', '-90 days')
ORDER BY date DESC;

-- Weekly training load view
CREATE VIEW IF NOT EXISTS weekly_training_load AS
SELECT 
    user_id,
    strftime('%Y-%W', date) as week,
    COUNT(*) as activity_count,
    SUM(distance) as total_distance,
    SUM(duration) as total_duration,
    AVG(avg_pace) as avg_pace,
    SUM(elevation_gain) as total_elevation
FROM activities
GROUP BY user_id, strftime('%Y-%W', date)
ORDER BY week DESC;

-- Current fitness view (latest CTL/ATL/TSB)
CREATE VIEW IF NOT EXISTS current_fitness AS
SELECT 
    user_id,
    ctl,
    atl,
    tsb,
    date,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as rn
FROM fitness_calculations
WHERE rn = 1;