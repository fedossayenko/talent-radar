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

## Technology Stack

### Backend
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL + Redis
- **Queue**: BullMQ for background jobs
- **Web Scraping**: Playwright
- **ORM**: Prisma

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS + shadcn/ui
- **State Management**: React Query

### AI & Services
- **AI Provider**: OpenRouter API
- **Orchestration**: LangChain
- **Hosting**: Railway/Fly.io

## Quick Start

### Prerequisites
- Node.js 22+
- npm 10+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Clone the repository
git clone <repository-url>
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
# Start all services
npm run dev

# Start individual services
npm run dev:api      # Backend API
npm run dev:web      # Frontend
npm run dev:scraper  # Background scraper
```

## Architecture

TalentRadar follows a modular monorepo architecture:

```
talent-radar/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── shared/       # Shared types and utilities
│   └── database/     # Prisma schema and migrations
└── docs/            # Documentation
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/talent_radar
REDIS_URL=redis://localhost:6379

# AI Services
OPENROUTER_API_KEY=your_openrouter_key

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

- `GET /api/v1/vacancies` - List all tracked positions
- `POST /api/v1/sources` - Add new job source
- `GET /api/v1/companies/:id` - Company details and analysis
- `POST /api/v1/cv/improve` - AI-powered CV enhancement
- `POST /api/v1/applications` - Generate cover letter and apply

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

## Development Roadmap

### Phase 1 (MVP) - Weeks 1-2
- [x] Project setup and architecture
- [ ] Basic job source management
- [ ] Web scraper implementation
- [ ] Core database models
- [ ] Simple UI for job listings

### Phase 2 (AI Enhancement) - Weeks 3-4
- [ ] AI company analysis integration
- [ ] Vacancy scoring algorithm
- [ ] Duplicate detection and merging
- [ ] Advanced filtering and search

### Phase 3 (Application Tools) - Weeks 5-6
- [ ] CV upload and parsing
- [ ] AI-powered CV improvement
- [ ] Cover letter generation
- [ ] Application tracking

### Future Enhancements
- [ ] Multi-user support with authentication
- [ ] Email notifications and alerts
- [ ] Browser extension for quick saves
- [ ] Mobile application
- [ ] Machine learning for personalized recommendations

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