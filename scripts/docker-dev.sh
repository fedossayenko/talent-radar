#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 TalentRadar Docker Development Setup${NC}"

# Function to check if service is ready
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $service on port $port...${NC}"
    while ! nc -z localhost $port 2>/dev/null; do
        if [ $attempt -eq $max_attempts ]; then
            echo -e "${RED}❌ $service failed to start${NC}"
            return 1
        fi
        sleep 1
        ((attempt++))
    done
    echo -e "${GREEN}✅ $service is ready${NC}"
    return 0
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required commands
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

if ! command_exists nc; then
    echo -e "${YELLOW}⚠️ netcat (nc) is not available, service readiness checks will be skipped${NC}"
fi

# Check for .env.docker file
if [ ! -f .env.docker ]; then
    echo -e "${RED}❌ .env.docker file not found${NC}"
    echo "Creating template .env.docker file..."
    cat > .env.docker << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here

# AI Configuration
AI_MODEL_DEFAULT=gpt-5-nano
AI_SERVICE_ENABLED=true
AI_TIMEOUT=60000
AI_MAX_RETRIES=3
AI_ENABLE_CACHING=true
AI_CACHE_EXPIRY_HOURS=24
AI_MAX_CONTENT_LENGTH=10000

# Scraper Configuration
SCRAPER_ENABLED=true
DEVBG_BASE_URL=https://dev.bg
DEVBG_API_URL=https://dev.bg/company/jobs/java/
DEVBG_REQUEST_TIMEOUT=30000
DEVBG_REQUEST_DELAY=2000
DEVBG_MAX_PAGES=10
DEVBG_USER_AGENT="TalentRadar/1.0 (Job Aggregator)"

# Scraper Queue Settings
SCRAPER_QUEUE_ATTEMPTS=3
SCRAPER_QUEUE_BACKOFF_DELAY=5000
SCRAPER_QUEUE_KEEP_COMPLETED=100
SCRAPER_QUEUE_KEEP_FAILED=50

# Scraper Filters
SCRAPER_TECH_FILTER=java,spring,hibernate,maven,gradle,mysql,postgresql,docker,kubernetes,aws
SCRAPER_LOCATION_FILTER=bulgaria,sofia,plovdiv,varna,burgas,remote
SCRAPER_JOB_TYPE_FILTER=backend,full-stack,java-developer

# Monitoring & Metrics
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
EOF
    echo -e "${YELLOW}Please update .env.docker with your OpenAI API key${NC}"
    exit 1
fi

# Check if OpenAI API key is set
if grep -q "your-api-key-here" .env.docker; then
    echo -e "${RED}❌ Please update .env.docker with your actual OpenAI API key${NC}"
    exit 1
fi

# Clean up any existing containers
echo -e "${YELLOW}🧹 Cleaning up existing containers...${NC}"
docker-compose down --remove-orphans

# Build images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker-compose --env-file .env.docker build

# Start services
echo -e "${YELLOW}🚀 Starting Docker services...${NC}"
docker-compose --env-file .env.docker up -d redis

# Wait for Redis if netcat is available
if command_exists nc; then
    wait_for_service "Redis" 6379
else
    echo -e "${YELLOW}⏳ Waiting 10 seconds for Redis to start...${NC}"
    sleep 10
fi

# Start API and Web
echo -e "${YELLOW}🎯 Starting API and Web services...${NC}"
docker-compose --env-file .env.docker up -d api web

# Wait for API if netcat is available
if command_exists nc; then
    wait_for_service "API" 3001
    wait_for_service "Web" 3000
else
    echo -e "${YELLOW}⏳ Waiting 30 seconds for services to start...${NC}"
    sleep 30
fi

echo -e "${GREEN}✨ Services are running!${NC}"
echo ""
echo -e "${BLUE}📍 Access points:${NC}"
echo "  - API: http://localhost:3001"
echo "  - Web UI: http://localhost:3000"
echo "  - Swagger: http://localhost:3001/api/docs"
echo "  - Health: http://localhost:3001/api/v1/health"
echo ""
echo -e "${BLUE}🛠 Available commands:${NC}"
echo "  - Trigger AI scraping: ./scripts/trigger-scraping.sh"
echo "  - View API logs: docker-compose logs -f api"
echo "  - View Web logs: docker-compose logs -f web"
echo "  - Start Redis Commander: docker-compose --profile tools up redis-commander"
echo "  - Quick test: curl http://localhost:3001/api/v1/health"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "  1. Test API health: curl http://localhost:3001/api/v1/health"
echo "  2. Open Web UI: http://localhost:3000"
echo "  3. Trigger AI scraping: ./scripts/trigger-scraping.sh"
echo "  4. Monitor database: ./scripts/monitor-database.sh"
echo ""
echo -e "${RED}🛑 To stop: docker-compose down${NC}"
echo -e "${RED}🗑 To stop and remove all data: docker-compose down -v${NC}"