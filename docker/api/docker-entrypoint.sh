#!/bin/sh
# TalentRadar API Docker Entrypoint Script
# This script ensures database migrations are run before starting the application

set -e

echo "Starting TalentRadar API container..."

# Wait for database file directory to exist
echo "Ensuring database directory exists..."
mkdir -p /app/data

# Set proper permissions for SQLite database
chmod -R 755 /app/data

# Change to API directory for Prisma operations
cd /app/apps/api

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed database if in development mode
if [ "$NODE_ENV" = "development" ]; then
    echo "Seeding database for development..."
    npx prisma db seed || echo "Seeding failed or no seed script found"
fi

echo "Database setup complete. Starting application..."

# Execute the main command from the API directory (passed as arguments to this script)
exec "$@"