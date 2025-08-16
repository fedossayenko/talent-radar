import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  // OpenRouter configuration
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: process.env.AI_MODEL_DEFAULT || 'anthropic/claude-3-haiku',
    timeout: parseInt(process.env.AI_TIMEOUT || '30000', 10),
  },
  
  // Rate limiting
  rateLimit: parseInt(process.env.AI_RATE_LIMIT || '10', 10), // requests per minute
  
  // Model configurations
  models: {
    analysis: {
      company: process.env.AI_MODEL_COMPANY || 'anthropic/claude-3-haiku',
      vacancy: process.env.AI_MODEL_VACANCY || 'anthropic/claude-3-haiku',
      cv: process.env.AI_MODEL_CV || 'anthropic/claude-3-haiku',
    },
    generation: {
      coverLetter: process.env.AI_MODEL_COVER_LETTER || 'anthropic/claude-3-haiku',
      cvImprovement: process.env.AI_MODEL_CV_IMPROVEMENT || 'anthropic/claude-3-haiku',
    },
    scoring: {
      default: process.env.AI_MODEL_SCORING || 'anthropic/claude-3-haiku',
    },
  },
  
  // Prompt templates
  prompts: {
    companyAnalysis: {
      temperature: 0.3,
      maxTokens: 1000,
      template: `Analyze the following company and provide insights about:
1. Company size and growth stage
2. Engineering culture and practices
3. Technology stack and tools
4. Work-life balance indicators
5. Career growth opportunities
6. Compensation competitiveness

Company: {companyName}
Website: {companyWebsite}
Description: {companyDescription}
Job postings: {jobPostings}

Provide a structured JSON response with scores (1-10) for each category.`,
    },
    
    vacancyScoring: {
      temperature: 0.2,
      maxTokens: 500,
      template: `Score this job vacancy based on the candidate's preferences and profile:

Vacancy: {vacancyTitle}
Company: {companyName}
Description: {vacancyDescription}
Requirements: {vacancyRequirements}
Salary: {vacancySalary}
Location: {vacancyLocation}

Candidate Profile:
- Skills: {candidateSkills}
- Experience: {candidateExperience}
- Preferences: {candidatePreferences}

Provide scores (0-100) for:
1. Skill match
2. Experience fit
3. Salary alignment
4. Location preference
5. Career growth potential

Return as JSON with explanation for each score.`,
    },
    
    cvImprovement: {
      temperature: 0.4,
      maxTokens: 1500,
      template: `Analyze and suggest improvements for this CV targeting {targetRole} positions:

Current CV:
{cvContent}

Target Role: {targetRole}
Target Company: {targetCompany}

Provide specific suggestions for:
1. Skills to highlight or add
2. Experience description improvements
3. Missing sections or information
4. Overall structure and presentation
5. Keywords to include for ATS systems

Return as JSON with categorized suggestions and priority levels.`,
    },
    
    coverLetterGeneration: {
      temperature: 0.6,
      maxTokens: 800,
      template: `Generate a personalized cover letter for this job application:

Job Details:
- Position: {vacancyTitle}
- Company: {companyName}
- Description: {vacancyDescription}
- Requirements: {vacancyRequirements}

Candidate Details:
- Name: {candidateName}
- Background: {candidateBackground}
- Key Skills: {candidateSkills}
- Notable Achievements: {candidateAchievements}

Company Information:
- About: {companyDescription}
- Culture: {companyCulture}
- Recent News: {companyNews}

Tone: {tone} (professional/enthusiastic/casual)
Length: {length} (short/medium/long)

Generate a compelling cover letter that:
1. Shows genuine interest in the company
2. Highlights relevant experience and skills
3. Demonstrates knowledge of the company
4. Explains why the candidate is a good fit
5. Includes a strong call to action`,
    },
  },
  
  // Caching
  enableCaching: process.env.AI_ENABLE_CACHING !== 'false',
  cacheExpiryHours: parseInt(process.env.AI_CACHE_EXPIRY_HOURS || '24', 10),
  
  // Fallback and retry
  retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.AI_RETRY_DELAY || '1000', 10),
  
  // Usage tracking
  trackUsage: process.env.AI_TRACK_USAGE !== 'false',
  usageLogging: process.env.AI_USAGE_LOGGING === 'true',
}));