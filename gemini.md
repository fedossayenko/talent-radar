# Gemini Onboarding Guide for TalentRadar

Welcome to the TalentRadar project! This guide is designed to help new developers quickly understand the project's architecture, key components, and development workflow.

## Project Overview

TalentRadar is a comprehensive platform for job seekers to discover, analyze, and apply for job opportunities. It automates the process of finding relevant job postings, provides AI-powered insights into companies and job descriptions, and helps users manage their CVs and applications.

### Core Features

*   **Job Aggregation:** Scrapes job postings from various sources like LinkedIn, company career pages, and job boards.
*   **AI-Powered Analysis:**
    *   Analyzes company culture, tech stack, and hiring processes.
    *   Improves and tailors CVs for specific job applications.
    *   Generates personalized cover letters.
*   **Vacancy Scoring:** Scores job vacancies based on user-defined preferences (e.g., salary, tech stack, company culture).
*   **Application Tracking:** Manages the entire job application lifecycle, from drafting applications to tracking interview progress.
*   **Analytics Dashboard:** Provides insights into job market trends, top technologies, and application statistics.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
*   [Git](https://git-scm.com/)

### Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/talent-radar.git
    cd talent-radar
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    ```bash
    cp .env.example .env
    ```

    *You can leave the default values for local development.*

4.  **Start the development environment:**

    ```bash
    docker-compose up -d
    ```

    This will start the following services:
    *   `postgres`: PostgreSQL database
    *   `redis`: Redis server
    *   `api`: NestJS backend API
    *   `web`: Next.js frontend

5.  **Access the applications:**

    *   **Frontend:** [http://localhost:3000](http://localhost:3000)
    *   **API:** [http://localhost:3001](http://localhost:3001)

## Project Structure

TalentRadar is a monorepo managed with npm workspaces. The main components are:

*   `apps/api`: The NestJS backend application.
*   `apps/web`: The Next.js frontend application.
*   `packages/database`: Shared database utilities and Prisma schema.
*   `packages/shared`: Shared types and interfaces.

### Backend (`apps/api`)

*   **Framework:** [NestJS](https://nestjs.com/)
*   **Language:** TypeScript
*   **Database ORM:** [Prisma](https://www.prisma.io/)
*   **Key Modules:**
    *   `VacancyModule`: Manages job vacancies.
    *   `CompanyModule`: Manages company information.
    *   `ScraperModule`: Handles web scraping logic.
    *   `AiModule`: Integrates with AI services.
    *   `CvModule`: Manages CVs and related operations.
    *   `ApplicationModule`: Manages job applications.

### Frontend (`apps/web`)

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [shadcn/ui](https://ui.shadcn.com/)

## Architecture

TalentRadar follows a modular, event-driven architecture.

### System Components

*   **Frontend (Next.js):** The user interface for interacting with the platform.
*   **Backend API (NestJS):** The core of the application, providing a RESTful API for the frontend and managing business logic.
*   **Background Workers (BullMQ):** A queue-based system for handling long-running tasks like web scraping and AI analysis.
*   **Database (PostgreSQL):** The primary data store for the application.
*   **Cache (Redis):** Used for caching frequently accessed data and managing background job queues.

### Data Flow

1.  **Job Scraping:**
    *   A scheduled job triggers the `ScraperModule`.
    *   The scraper fetches job postings from configured sources.
    *   New and updated vacancies are stored in the PostgreSQL database.
    *   An event is published to the `AI Analysis Queue`.

2.  **AI Analysis:**
    *   A worker process picks up the job from the `AI Analysis Queue`.
    *   The `AiModule` sends the job description and company information to an AI service (e.g., OpenRouter).
    *   The AI service returns an analysis of the company, tech stack, and other relevant details.
    *   The analysis is stored in the database.

3.  **User Interaction:**
    *   The user browses and searches for jobs on the frontend.
    *   The frontend communicates with the backend API to fetch data.
    *   The user can create and manage CVs, generate cover letters, and track applications.

## Key Concepts

### Domain-Driven Design (DDD)

The backend is organized into modules that represent different domains of the application (e.g., `Vacancy`, `Company`, `Application`). This promotes a clear separation of concerns and makes the codebase easier to understand and maintain.

### Event-Driven Architecture

The use of message queues (BullMQ) for background tasks decouples the different parts of the system. This makes the application more resilient and scalable. For example, if the AI service is temporarily unavailable, the analysis jobs will remain in the queue and be processed later.

### Monorepo

All the code for the project is located in a single repository. This simplifies dependency management and makes it easier to share code between the frontend and backend.

## Development Workflow

1.  **Create a new branch:**

    ```bash
    git checkout -b feature/my-new-feature
    ```

2.  **Make your changes** in the `apps/api` or `apps/web` directories.

3.  **Write tests** for your changes.

4.  **Run tests:**

    ```bash
    npm test
    ```

5.  **Commit your changes:**

    ```bash
    git commit -m "feat: add my new feature"
    ```

6.  **Push your changes and create a pull request.**

## Further Reading

*   [API Documentation](./docs/API.md)
*   [Architecture Overview](./docs/ARCHITECTURE.md)
*   [Data Models](./docs/DATA_MODELS.md)
*   [Deployment Guide](./docs/DEPLOYMENT.md)
*   [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
