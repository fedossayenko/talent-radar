# TalentRadar Docker Development Guide

## Quick Start

### 1. Initial Setup (One-time)
```bash
# Make scripts executable (already done)
chmod +x scripts/*.sh

# Copy environment variables (if needed)
cp apps/api/.env .env.docker
```

### 2. Start Everything
```bash
./scripts/docker-dev.sh
```

### 3. Trigger AI Scraping
```bash
./scripts/trigger-scraping.sh
```

### 4. Monitor Results
```bash
./scripts/monitor-database.sh
```

## What Gets Started

- **Redis**: Cache for AI extractions (port 6379)
- **API**: TalentRadar API with AI processing (port 3000)
- **SQLite**: Database for storing vacancy data
- **Prisma Studio**: Database GUI (port 5555 - on demand)
- **Redis Commander**: Cache GUI (port 8081 - on demand)

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | Main API |
| Swagger | http://localhost:3000/api/docs | API documentation |
| Health Check | http://localhost:3000/api/v1/health | API health status |
| Prisma Studio | http://localhost:5555 | Database GUI |
| Redis Commander | http://localhost:8081 | Cache GUI |

## Available Commands

### Start Services
```bash
./scripts/docker-dev.sh
```

### Trigger AI Scraping
```bash
./scripts/trigger-scraping.sh
```

### Monitor Database
```bash
./scripts/monitor-database.sh
```

### Manual Commands
```bash
# Trigger scraping via API
curl -X POST http://localhost:3000/api/v1/scraper/dev-bg/manual

# Check API health
curl http://localhost:3000/api/v1/health

# Get scraping statistics
curl http://localhost:3000/api/v1/scraper/stats

# View live logs
docker-compose -f docker-compose.dev.yml logs -f api

# Filter for AI processing logs
docker-compose -f docker-compose.dev.yml logs -f api | grep -E "AI|GPT|extraction"

# Start database GUI
docker-compose -f docker-compose.dev.yml --profile tools up prisma-studio

# Start cache GUI
docker-compose -f docker-compose.dev.yml --profile tools up redis-commander
```

### Stop Services
```bash
# Stop services (keeps data)
docker-compose -f docker-compose.dev.yml down

# Stop and remove all data
docker-compose -f docker-compose.dev.yml down -v
```

## AI Processing Workflow

1. **Scraping**: Dev.bg job listings are scraped (5 vacancies max for testing)
2. **AI Extraction**: GPT-5 Nano processes job content and extracts structured data
3. **Database Storage**: Results saved to SQLite with confidence scores
4. **Caching**: AI extractions cached in Redis to avoid reprocessing

## Monitoring AI Results

### Database Queries (via Prisma Studio)
- Navigate to `Vacancy` table
- Filter by `extractionConfidence > 0` for AI-processed jobs
- Check `qualityScore > 70` for high-quality extractions
- View `aiExtractedData` JSON field for full extraction details

### Redis Cache
- Use Redis Commander to view cached extractions
- Cache keys: `vacancy_extraction:{hash}`
- TTL: 24 hours by default

### Logs
```bash
# All API logs
docker-compose -f docker-compose.dev.yml logs -f api

# AI-specific logs
docker-compose -f docker-compose.dev.yml logs -f api | grep -E "AI|GPT|extraction|confidence"

# Scraping logs
docker-compose -f docker-compose.dev.yml logs -f api | grep -E "scraping|dev.bg|vacancy"
```

## Configuration

### Environment Variables (.env.docker)
```env
# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here
AI_MODEL_DEFAULT=gpt-5-nano
AI_SERVICE_ENABLED=true

# Scraper Configuration  
SCRAPER_ENABLED=true
DEVBG_MAX_PAGES=10

# Cache Configuration
AI_ENABLE_CACHING=true
AI_CACHE_EXPIRY_HOURS=24
```

### Customizing Limits
To process more or fewer vacancies, modify the scraper limits in `.env.docker`:
```env
DEVBG_MAX_PAGES=5  # Pages to scrape (each page ~10-20 jobs)
```

## Troubleshooting

### Services Not Starting
```bash
# Check Docker status
docker --version
docker-compose --version

# View service status
docker-compose -f docker-compose.dev.yml ps

# Restart specific service
docker-compose -f docker-compose.dev.yml restart api
```

### API Not Responding
```bash
# Check API logs
docker-compose -f docker-compose.dev.yml logs api

# Check health endpoint
curl http://localhost:3000/api/v1/health

# Restart API
docker-compose -f docker-compose.dev.yml restart api
```

### AI Processing Issues
```bash
# Check AI configuration
docker exec -it talent-radar-api env | grep AI

# Check OpenAI API key
docker exec -it talent-radar-api env | grep OPENAI

# View AI processing logs
docker-compose -f docker-compose.dev.yml logs api | grep -E "AI|extraction|GPT"
```

### Database Issues
```bash
# Check if database file exists
docker exec -it talent-radar-api ls -la /app/apps/api/dev.db

# Run database migrations
docker exec -it talent-radar-api sh -c "cd apps/api && bunx prisma migrate dev"

# Reset database (CAUTION: deletes all data)
docker exec -it talent-radar-api sh -c "cd apps/api && rm -f dev.db && bunx prisma migrate dev"
```

## Data Export

Export AI-processed vacancy data:
```bash
./scripts/monitor-database.sh 4
```

This creates `exports/ai_vacancies.csv` with all AI-extracted vacancy data.

## Development Tips

1. **Hot Reload**: Code changes in `apps/api/src` automatically restart the API
2. **Database Persistence**: SQLite database persists between container restarts
3. **Cache Persistence**: Redis data persists between container restarts
4. **Log Monitoring**: Use `docker-compose logs -f api` for real-time debugging
5. **Clean Restart**: Use `down -v` to completely reset all data

## Performance Notes

- **First Run**: Initial AI processing may take longer due to model initialization
- **Caching**: Subsequent processing of the same content will be faster due to Redis caching
- **Limits**: Default configuration processes ~5-10 vacancies for quick testing
- **Resource Usage**: Monitor Docker resource usage if processing large numbers of vacancies