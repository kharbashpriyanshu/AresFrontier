-- ====================================================================
-- Martian Map — PostgreSQL & PostGIS Planetary Schema
-- Coordinates stored in Planetocentric/Planetographic decimal degrees
-- ====================================================================

-- Enable PostGIS extension if available
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Planetary Locations
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 360.0),
    elevation_m INTEGER NOT NULL,
    terrain_type TEXT NOT NULL,
    geological_unit TEXT NOT NULL,
    eva_rating VARCHAR(32) NOT NULL,
    slope_index DOUBLE PRECISION DEFAULT 0.0,
    dust_hazard VARCHAR(32) DEFAULT 'moderate',
    nasa_observations JSONB DEFAULT '[]'::jsonb,
    is_mock BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Science Targets
CREATE TABLE IF NOT EXISTS science_targets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 360.0),
    category VARCHAR(64) NOT NULL,
    scientific_value VARCHAR(16) NOT NULL CHECK (scientific_value IN ('low', 'medium', 'high')),
    description TEXT NOT NULL,
    data_source VARCHAR(255) NOT NULL,
    potential_samples TEXT[] DEFAULT ARRAY[]::TEXT[],
    associated_formation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Planned Mars Routes
CREATE TABLE IF NOT EXISTS routes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_distance_km DOUBLE PRECISION NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    elevation_gain_m INTEGER DEFAULT 0,
    elevation_loss_m INTEGER DEFAULT 0,
    max_slope_degrees DOUBLE PRECISION DEFAULT 0.0,
    overall_difficulty VARCHAR(16) DEFAULT 'low',
    elevation_profile JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Route Points & Waypoints
CREATE TABLE IF NOT EXISTS route_points (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) REFERENCES routes(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    point_type VARCHAR(32) NOT NULL CHECK (point_type IN ('start', 'waypoint', 'science', 'destination')),
    label VARCHAR(255),
    elevation_m INTEGER,
    target_id VARCHAR(64)
);

-- 5. Route Segments
CREATE TABLE IF NOT EXISTS route_segments (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) REFERENCES routes(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lon DOUBLE PRECISION NOT NULL,
    end_lat DOUBLE PRECISION NOT NULL,
    end_lon DOUBLE PRECISION NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    elevation_gain_m INTEGER DEFAULT 0,
    elevation_loss_m INTEGER DEFAULT 0,
    slope_degrees DOUBLE PRECISION DEFAULT 0.0,
    difficulty VARCHAR(16) DEFAULT 'low',
    estimated_minutes INTEGER NOT NULL,
    hazards TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- 6. Missions & EVA Executions
CREATE TABLE IF NOT EXISTS missions (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) REFERENCES routes(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    max_duration_minutes INTEGER NOT NULL,
    return_required BOOLEAN DEFAULT true,
    status VARCHAR(32) DEFAULT 'planned',
    assessment JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. NASA Data Sources
CREATE TABLE IF NOT EXISTS data_sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mission VARCHAR(128) NOT NULL,
    data_type VARCHAR(64) NOT NULL,
    url TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'operational',
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attribution TEXT NOT NULL,
    coverage TEXT NOT NULL
);

-- Indexes for rapid spatial bounding queries
CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_science_targets_coords ON science_targets(latitude, longitude);
