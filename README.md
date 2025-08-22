# TalentRadar

> AI-powered job tracking and application system for IT developers

## Overview

TalentRadar is a comprehensive job tracking application designed to help IT developers find and apply to the best opportunities. It automates job discovery, provides AI-powered insights about companies and positions, and assists with application materials.

## Features

### Core Functionality
- **Job Source Management**: Track multiple job boards and company sites
- **Intelligent Scraping**: Automated background monitoring for new vacancies
- **AI-Powered Analysis**: Extract company insights, salary estimates, and tech stack information
- **Smart Scoring**: Rank positions based on multiple factors
- **Duplicate Detection**: Merge similar positions from different sources

### Application Tools
- **CV Enhancement**: AI-powered resume improvement with targeted prompts
- **Cover Letter Generation**: Automatic personalized cover letters for each application
- **Application Tracking**: Monitor application status and follow-ups

### Insights & Analytics
- **Company Analysis**: Size, culture, hiring process, retention rates
- **Salary Intelligence**: Expected compensation ranges
- **Tech Stack Matching**: Technology alignment scoring
- **Market Trends**: Industry insights and opportunities

### Advanced Features
- **Multi-Source Scraping**: Dev.bg integration with company website analysis
- **AI Content Processing**: Smart job description parsing and enhancement
- **Company Scoring System**: Multi-factor company evaluation algorithm
- **Real-time Operations**: WebSocket-based live scraping updates
- **Comprehensive Testing**: 100% test coverage with unit, integration, and E2E tests
- **Content Deduplication**: Advanced duplicate detection and content merging
- **Caching Layer**: Redis-based caching for optimal performance
- **Background Processing**: Queue-based job processing with BullMQ

## Technology Stack

### Backend
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL + Redis
- **Queue**: BullMQ for background jobs
- **Web Scraping**: Playwright
- **ORM**: Prisma

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router DOM
- **Styling**: TailwindCSS + Heroicons
- **State Management**: React Query

### AI & Services
- **AI Provider**: OpenAI API
- **Integration**: Direct API integration
- **Hosting**: Railway/Fly.io

## Quick Start

### Prerequisites
- Node.js 22+ (as specified in package.json engines)
- npm 10+
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (optional, for containerized setup)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/talent-radar.git
cd talent-radar

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
npm run dev
```

### Development

```bash
# Start backend API (includes scraper)
npm run dev:api

# Start frontend (in separate terminal)
npm run dev:web

# Or use npm run dev (defaults to API)
npm run dev

# Database operations
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

## Architecture

TalentRadar follows a monorepo architecture:

```
talent-radar/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # NestJS backend with Prisma
├── docker/           # Docker configuration
├── docs/             # Documentation
└── scripts/          # Development and deployment scripts
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/talent_radar
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=your_openai_key

# Scraping
PLAYWRIGHT_HEADLESS=true
SCRAPER_CONCURRENCY=3
```

### Job Sources

Configure job sources in the admin panel or via API:

```json
{
  "name": "LinkedIn Jobs",
  "url": "https://linkedin.com/jobs/search/",
  "type": "linkedin",
  "countries": ["US", "CA", "DE"],
  "technologies": ["JavaScript", "TypeScript", "React"]
}
```

## API Documentation

The API documentation is available at `/api/docs` when running in development mode.

### Key Endpoints

- `GET /vacancies` - List all tracked job positions with filtering
- `GET /vacancies/:id` - Get detailed vacancy information
- `GET /companies` - List companies with scoring and analysis
- `GET /companies/:id` - Get detailed company profile and analysis
- `POST /scraper/trigger` - Manually trigger scraping operations
- `GET /scraper/status` - Check scraping operation status
- `POST /cv/improve` - AI-powered CV enhancement suggestions
- `POST /applications` - Create and track job applications

## Deployment

### Production Deployment

```bash
# Build for production
npm run build

# Deploy to Railway
railway deploy

# Or deploy to Fly.io
flyctl deploy
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Development Status

### ✅ Completed Core Features
- [x] Project setup and architecture
- [x] Job source management with Dev.bg integration
- [x] Advanced web scraper with Playwright
- [x] Complete database models with Prisma
- [x] Full-featured UI with React Router
- [x] AI company analysis and profile generation
- [x] Advanced vacancy scoring algorithm
- [x] Duplicate detection and content deduplication
- [x] Company website scraping and analysis
- [x] AI-powered job content extraction
- [x] Advanced filtering and search capabilities
- [x] Real-time scraping operations
- [x] Company scoring and ranking system
- [x] Comprehensive test coverage
- [x] Docker containerization
- [x] Redis caching and session management

### ✅ Application Management Tools
- [x] CV service implementation
- [x] AI-powered CV improvement suggestions
- [x] Cover letter generation framework
- [x] Application tracking system

### 🚀 Future Enhancements
- [ ] Multi-user support with authentication
- [ ] Email notifications and alerts
- [ ] Browser extension for quick saves
- [ ] Mobile application
- [ ] Machine learning for personalized recommendations
- [ ] Advanced analytics dashboard
- [ ] Integration with more job boards

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the [documentation](./docs/)
- Review the [troubleshooting guide](./docs/TROUBLESHOOTING.md)