import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => {
  // Simplified configuration with backward compatibility
  const config = {
    // Core settings
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL_DEFAULT || 'gpt-5-nano',
    timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    rateLimit: parseInt(process.env.AI_RATE_LIMIT || '10', 10),
    
    // Content processing
    maxContentLength: parseInt(process.env.AI_MAX_CONTENT_LENGTH || '10000', 10),
    
    // Caching
    enableCaching: process.env.AI_ENABLE_CACHING !== 'false',
    cacheExpiryHours: parseInt(process.env.AI_CACHE_EXPIRY_HOURS || '24', 10),
    
    // Main prompt template for vacancy extraction
    vacancyPrompt: `Extract structured job vacancy data from this content:

{content}

Source: {sourceUrl}

Return JSON with: title, company, location, salaryMin, salaryMax, currency, experienceLevel, employmentType, workModel, description, requirements, responsibilities, technologies, benefits, confidenceScore, qualityScore.

RESPOND ONLY WITH JSON.`,
  };
  
  // Backward compatibility - map old nested structure to new flat structure
  return {
    ...config,
    // Legacy support for nested openai config
    openai: {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      defaultModel: config.model,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    },
    // Legacy support for models config
    models: {
      scraping: {
        vacancy: config.model,
        contentCleaning: config.model,
        qualityAssessment: config.model,
      },
    },
    // Legacy support for prompts config
    prompts: {
      vacancyExtraction: {
        temperature: 0.1,
        maxTokens: 2000,
        template: config.vacancyPrompt,
      },
    },
  };
});