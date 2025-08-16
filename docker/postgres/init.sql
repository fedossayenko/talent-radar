-- TalentRadar Database Initialization Script

-- Create database if not exists (handled by Docker environment)
-- CREATE DATABASE talent_radar;

-- Connect to the database
\c talent_radar;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE job_source_type AS ENUM (
    'linkedin', 'company', 'jobboard', 'rss'
);

CREATE TYPE job_source_status AS ENUM (
    'active', 'paused', 'error'
);

CREATE TYPE company_size AS ENUM (
    'startup', 'scale-up', 'enterprise'
);

CREATE TYPE experience_level AS ENUM (
    'junior', 'mid', 'senior', 'lead'
);

CREATE TYPE employment_type AS ENUM (
    'full-time', 'part-time', 'contract', 'freelance'
);

CREATE TYPE vacancy_status AS ENUM (
    'active', 'expired', 'filled', 'duplicate'
);

CREATE TYPE application_status AS ENUM (
    'draft', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'
);

CREATE TYPE application_event_type AS ENUM (
    'applied', 'response', 'interview', 'offer', 'rejection', 'follow_up', 'withdrawn'
);

CREATE TYPE scraping_status AS ENUM (
    'running', 'completed', 'failed', 'cancelled'
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create development user (for local development only)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'talent_radar_dev') THEN
        CREATE USER talent_radar_dev WITH PASSWORD 'dev_password';
        GRANT ALL PRIVILEGES ON DATABASE talent_radar TO talent_radar_dev;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO talent_radar_dev;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO talent_radar_dev;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO talent_radar_dev;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO talent_radar_dev;
    END IF;
END $$;

-- Insert some development data
-- This will be replaced by proper seeding scripts