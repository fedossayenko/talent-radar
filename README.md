# TalentRadar

> AI-powered job tracking and application system for IT developers

## Overview

TalentRadar is a comprehensive job tracking application designed to help IT developers find and apply to the best opportunities. It automates job discovery, provides AI-powered insights about companies and positions, and assists with application materials.

## ✨ Key Features

- 🤖 **AI-Powered Job Discovery** - Smart scraping with OpenAI analysis of job posts and company profiles
- 📊 **Intelligent Company Scoring** - Multi-factor evaluation algorithm ranking companies by culture, tech, and growth
- 🔍 **Multi-Source Scraping** - Dev.bg integration + direct company website analysis  
- 📝 **Automated CV & Cover Letters** - AI-powered resume enhancement and personalized application materials
- 🔄 **Real-time Job Tracking** - Live updates with advanced duplicate detection and content merging
- 📱 **Smart Application Management** - Track applications, follow-ups, and interview processes
- ⚡ **Advanced Search & Filtering** - Find jobs by tech stack, salary, location, and company metrics
- 🚀 **Production-Ready Architecture** - NestJS + React with comprehensive testing and Docker support

## 🛠️ Technology Stack

**Backend:** NestJS + TypeScript + PostgreSQL + Redis + Playwright + Prisma  
**Frontend:** React 18 + Vite + React Router + TailwindCSS + React Query  
**AI:** OpenAI API + Direct integration  
**Infrastructure:** Docker + BullMQ + Railway/Fly.io

## 🚀 Quick Start

**Prerequisites:** Node.js 22+, PostgreSQL, Redis  
**Optional:** Docker for easy setup

```bash
# Clone and install
git clone https://github.com/yourusername/talent-radar.git
cd talent-radar && npm install

# Setup environment
cp .env.example .env  # Edit with your database & OpenAI key

# Start development
npm run dev:api  # Backend (3001)
npm run dev:web  # Frontend (3000) - separate terminal
```

📚 **Detailed setup guide**: [Installation Docs](./docs/INSTALLATION.md)

## 🏗️ Architecture

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

## ⚙️ Configuration

Create `.env` file with essential variables:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/talent_radar
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_key
```

📋 **Full configuration options**: See [Configuration Guide](./docs/CONFIGURATION.md)

## 📖 API Documentation

Interactive API docs with all endpoints: **`http://localhost:3001/api/docs`** (when running locally)

## 🚀 Deployment

**Docker:** `docker-compose up -d`  
**Cloud:** Railway, Fly.io, or any Node.js host  

📋 **Full deployment guide**: [Deployment Docs](./docs/DEPLOYMENT.md)

## 🚀 Status: Production Ready

TalentRadar is a **feature-complete application** with comprehensive testing, Docker support, and production deployment capabilities. All core job tracking, AI analysis, and application management features are fully implemented and operational.

**🎯 Ready for:** Personal use, team deployment, production hosting  
**📋 Includes:** Full test coverage, Docker setup, API documentation  
**🔧 Next:** [Planned enhancements](./docs/ROADMAP.md) include multi-user auth and mobile app

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

💬 **Questions**: [GitHub Issues](../../issues)  
📚 **Documentation**: [./docs/](./docs/)  
🔧 **Troubleshooting**: [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)