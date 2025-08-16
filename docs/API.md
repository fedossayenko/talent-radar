# TalentRadar API Documentation

## Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://api.talentradar.app/api/v1`

## Authentication

Currently, the API is designed for single-user mode and does not require authentication. Future versions will include JWT-based authentication.

## Common Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Data Models

### JobSource

```typescript
interface JobSource {
  id: string;
  name: string;
  url: string;
  type: 'linkedin' | 'company' | 'jobboard' | 'rss';
  countries: string[];
  technologies: string[];
  scrapeFrequency: number; // hours
  lastScraped?: Date;
  status: 'active' | 'paused' | 'error';
  selectors?: {
    jobContainer: string;
    title: string;
    company: string;
    location: string;
    description: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Company

```typescript
interface Company {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  size: 'startup' | 'scale-up' | 'enterprise';
  industry: string;
  location: string;
  description?: string;
  aiAnalysis?: {
    cultureScore: number;
    retentionRate?: number;
    hiringProcess: string[];
    techStack: string[];
    workLifeBalance: number;
    careerGrowth: number;
    analysisDate: Date;
  };
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Vacancy

```typescript
interface Vacancy {
  id: string;
  sourceId: string;
  companyId: string;
  externalId?: string; // ID from source site
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  location: {
    country: string;
    city: string;
    remote: boolean;
    hybrid: boolean;
  };
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  techStack: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  employmentType: 'full-time' | 'part-time' | 'contract' | 'freelance';
  score?: number;
  scoreBreakdown?: {
    salaryScore: number;
    techMatchScore: number;
    companyScore: number;
    locationScore: number;
    totalScore: number;
  };
  status: 'active' | 'expired' | 'filled' | 'duplicate';
  duplicateOf?: string; // Reference to original vacancy
  url: string;
  scrapedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### CV

```typescript
interface CV {
  id: string;
  name: string;
  content: {
    personalInfo: {
      fullName: string;
      email: string;
      phone?: string;
      location: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
    summary: string;
    experience: Experience[];
    education: Education[];
    skills: {
      technical: string[];
      soft: string[];
      languages: Language[];
    };
    projects: Project[];
    certifications: Certification[];
  };
  aiSuggestions?: {
    improvements: string[];
    missingSkills: string[];
    strengthAreas: string[];
    generatedAt: Date;
  };
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string;
  achievements: string[];
  technologies: string[];
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  gpa?: number;
  description?: string;
}

interface Language {
  name: string;
  level: 'basic' | 'intermediate' | 'fluent' | 'native';
}

interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  githubUrl?: string;
  startDate: Date;
  endDate?: Date;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  url?: string;
}
```

### Application

```typescript
interface Application {
  id: string;
  vacancyId: string;
  cvId: string;
  coverLetter: string;
  status: 'draft' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
  appliedAt?: Date;
  followUpDate?: Date;
  notes?: string;
  timeline: ApplicationEvent[];
  aiGenerated: {
    coverLetterGenerated: boolean;
    personalizations: string[];
    generatedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationEvent {
  id: string;
  type: 'applied' | 'response' | 'interview' | 'offer' | 'rejection' | 'follow_up';
  description: string;
  date: Date;
  notes?: string;
}
```

## API Endpoints

### Job Sources

#### List Job Sources
```http
GET /sources
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status

**Response:**
```typescript
ApiResponse<JobSource[]>
```

#### Create Job Source
```http
POST /sources
```

**Request Body:**
```typescript
{
  name: string;
  url: string;
  type: 'linkedin' | 'company' | 'jobboard' | 'rss';
  countries: string[];
  technologies: string[];
  scrapeFrequency: number;
  selectors?: {
    jobContainer: string;
    title: string;
    company: string;
    location: string;
    description: string;
  };
}
```

#### Get Job Source
```http
GET /sources/:id
```

#### Update Job Source
```http
PUT /sources/:id
```

#### Delete Job Source
```http
DELETE /sources/:id
```

#### Trigger Manual Scrape
```http
POST /sources/:id/scrape
```

### Companies

#### List Companies
```http
GET /companies
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `search` (string): Search by name
- `industry` (string): Filter by industry
- `size` (string): Filter by company size

#### Get Company
```http
GET /companies/:id
```

#### Update Company
```http
PUT /companies/:id
```

#### Analyze Company with AI
```http
POST /companies/:id/analyze
```

**Request Body:**
```typescript
{
  forceRefresh?: boolean; // Re-analyze even if recent analysis exists
}
```

### Vacancies

#### List Vacancies
```http
GET /vacancies
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `search` (string): Search in title/description
- `technologies` (string[]): Filter by tech stack
- `location` (string): Filter by location
- `experienceLevel` (string): Filter by experience level
- `salaryMin`, `salaryMax` (number): Salary range filter
- `sortBy` (string): 'score' | 'salary' | 'date' | 'company'
- `order` (string): 'asc' | 'desc'

#### Get Vacancy
```http
GET /vacancies/:id
```

#### Update Vacancy
```http
PUT /vacancies/:id
```

#### Score Vacancy
```http
POST /vacancies/:id/score
```

**Request Body:**
```typescript
{
  preferences: {
    salaryWeight: number;      // 0-1
    techMatchWeight: number;   // 0-1
    companyWeight: number;     // 0-1
    locationWeight: number;    // 0-1
  };
}
```

#### Mark as Duplicate
```http
POST /vacancies/:id/mark-duplicate
```

**Request Body:**
```typescript
{
  originalVacancyId: string;
}
```

### CVs

#### List CVs
```http
GET /cvs
```

#### Create CV
```http
POST /cvs
```

#### Get CV
```http
GET /cvs/:id
```

#### Update CV
```http
PUT /cvs/:id
```

#### Delete CV
```http
DELETE /cvs/:id
```

#### Improve CV with AI
```http
POST /cvs/:id/improve
```

**Request Body:**
```typescript
{
  targetRole?: string;
  targetCompany?: string;
  focusAreas?: string[]; // Areas to focus improvement on
}
```

#### Export CV
```http
GET /cvs/:id/export
```

**Query Parameters:**
- `format` (string): 'pdf' | 'docx' | 'json'

### Applications

#### List Applications
```http
GET /applications
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `status` (string): Filter by status
- `vacancyId` (string): Filter by vacancy

#### Create Application
```http
POST /applications
```

**Request Body:**
```typescript
{
  vacancyId: string;
  cvId: string;
  generateCoverLetter?: boolean;
  customizations?: string[];
}
```

#### Get Application
```http
GET /applications/:id
```

#### Update Application
```http
PUT /applications/:id
```

#### Generate Cover Letter
```http
POST /applications/:id/cover-letter
```

**Request Body:**
```typescript
{
  customizations?: string[];
  tone?: 'professional' | 'casual' | 'enthusiastic';
  length?: 'short' | 'medium' | 'long';
}
```

#### Update Application Status
```http
PATCH /applications/:id/status
```

**Request Body:**
```typescript
{
  status: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
  notes?: string;
  followUpDate?: Date;
}
```

### Analytics

#### Dashboard Statistics
```http
GET /analytics/dashboard
```

**Response:**
```typescript
{
  totalVacancies: number;
  newVacanciesThisWeek: number;
  totalApplications: number;
  applicationsByStatus: Record<string, number>;
  topTechnologies: { name: string; count: number }[];
  topCompanies: { name: string; count: number }[];
  salaryTrends: { period: string; average: number }[];
  scrapingStats: {
    totalSources: number;
    activeSources: number;
    lastScrapeSuccess: Date;
    failedScrapes: number;
  };
}
```

#### Vacancy Trends
```http
GET /analytics/trends
```

**Query Parameters:**
- `period` (string): 'week' | 'month' | 'quarter'
- `technology` (string): Filter by specific technology

### System

#### Health Check
```http
GET /health
```

**Response:**
```typescript
{
  status: 'ok' | 'error';
  timestamp: Date;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    ai: 'ok' | 'error';
  };
  version: string;
}
```

#### System Statistics
```http
GET /system/stats
```

**Response:**
```typescript
{
  queues: {
    scraping: { waiting: number; active: number; completed: number };
    ai: { waiting: number; active: number; completed: number };
  };
  database: {
    connections: number;
    queries: number;
  };
  memory: {
    used: number;
    total: number;
  };
}
```

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `VALIDATION_ERROR` | Validation failed | Request data validation error |
| `NOT_FOUND` | Resource not found | Requested resource doesn't exist |
| `DUPLICATE_ERROR` | Resource already exists | Attempting to create duplicate resource |
| `SCRAPING_ERROR` | Scraping failed | Error during web scraping |
| `AI_SERVICE_ERROR` | AI service unavailable | Error communicating with AI service |
| `RATE_LIMIT_ERROR` | Rate limit exceeded | Too many requests |
| `INTERNAL_ERROR` | Internal server error | Unexpected server error |

## Rate Limiting

- **General API**: 100 requests per minute per IP
- **AI Endpoints**: 10 requests per minute per IP
- **Scraping Endpoints**: 5 requests per minute per IP

## WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3001');
```

### Events

#### New Vacancy
```javascript
socket.on('vacancy:new', (vacancy: Vacancy) => {
  // Handle new vacancy
});
```

#### Scraping Progress
```javascript
socket.on('scraping:progress', (progress: {
  sourceId: string;
  status: 'started' | 'progress' | 'completed' | 'error';
  processed: number;
  total: number;
  message?: string;
}) => {
  // Handle scraping progress
});
```

#### AI Analysis Complete
```javascript
socket.on('ai:analysis:complete', (analysis: {
  type: 'company' | 'cv' | 'cover-letter';
  entityId: string;
  result: any;
}) => {
  // Handle AI analysis completion
});
```