# TalentRadar Troubleshooting Guide

## Common Issues and Solutions

### Development Environment

#### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL database
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:
1. **Check if PostgreSQL is running**:
   ```bash
   # Using Docker Compose
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **Verify connection string**:
   ```bash
   # Test connection
   psql postgresql://postgres:password@localhost:5432/talent_radar
   ```

3. **Reset database container**:
   ```bash
   docker-compose down postgres
   docker volume rm talent-radar-postgres-data
   docker-compose up -d postgres
   ```

#### Redis Connection Issues

**Problem**: Cannot connect to Redis
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:
1. **Check Redis status**:
   ```bash
   docker-compose ps redis
   redis-cli ping
   ```

2. **Clear Redis data**:
   ```bash
   docker-compose exec redis redis-cli FLUSHALL
   ```

#### Node.js Memory Issues

**Problem**: JavaScript heap out of memory
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions**:
1. **Increase memory limit**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run dev
   ```

2. **Check for memory leaks**:
   ```bash
   # Monitor memory usage
   node --inspect --max-old-space-size=4096 app.js
   ```

### Web Scraping Issues

#### Playwright/Puppeteer Errors

**Problem**: Browser launch failed
```
Error: Failed to launch browser
```

**Solutions**:
1. **Install browser dependencies**:
   ```bash
   # Linux
   sudo apt-get update
   sudo apt-get install -y chromium-browser
   
   # macOS
   brew install chromium
   
   # Docker - already handled in Dockerfile
   ```

2. **Run in headless mode**:
   ```bash
   export PLAYWRIGHT_HEADLESS=true
   ```

3. **Check browser permissions**:
   ```bash
   # Add to Docker run command
   --cap-add=SYS_ADMIN
   ```

#### Rate Limiting Issues

**Problem**: Getting blocked by target websites
```
Error: 429 Too Many Requests
```

**Solutions**:
1. **Reduce scraping frequency**:
   ```javascript
   // In job source configuration
   {
     "scrapeFrequency": 24, // Increase to 24 hours
     "rateLimitDelay": 5000 // Add 5 second delay
   }
   ```

2. **Add random delays**:
   ```javascript
   const delay = Math.random() * 5000 + 1000; // 1-6 seconds
   await new Promise(resolve => setTimeout(resolve, delay));
   ```

3. **Use different user agents**:
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
   ];
   ```

### AI Service Issues

#### OpenRouter API Errors

**Problem**: AI service unavailable
```
Error: 401 Unauthorized - Invalid API key
```

**Solutions**:
1. **Check API key**:
   ```bash
   # Verify in environment
   echo $OPENROUTER_API_KEY
   
   # Test API directly
   curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
        https://openrouter.ai/api/v1/models
   ```

2. **Check quota and usage**:
   ```bash
   # Monitor API usage in OpenRouter dashboard
   # Implement usage tracking in application
   ```

3. **Implement retry logic**:
   ```javascript
   const maxRetries = 3;
   let attempt = 0;
   
   while (attempt < maxRetries) {
     try {
       const result = await aiService.analyze(data);
       return result;
     } catch (error) {
       attempt++;
       if (attempt >= maxRetries) throw error;
       await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
     }
   }
   ```

#### Model Response Issues

**Problem**: AI returns malformed responses
```
Error: Cannot parse AI response
```

**Solutions**:
1. **Add response validation**:
   ```javascript
   function validateAIResponse(response) {
     if (!response || typeof response !== 'object') {
       throw new Error('Invalid AI response format');
     }
     return response;
   }
   ```

2. **Implement fallback models**:
   ```javascript
   const models = ['claude-3-haiku', 'gpt-3.5-turbo', 'llama-2-70b'];
   
   for (const model of models) {
     try {
       return await callAIService(model, prompt);
     } catch (error) {
       console.warn(`Model ${model} failed, trying next...`);
     }
   }
   ```

### Frontend Issues

#### Next.js Build Errors

**Problem**: Build fails with module resolution errors
```
Error: Module not found: Can't resolve '@/components/ui/button'
```

**Solutions**:
1. **Check TypeScript configuration**:
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"],
         "@/components/*": ["./components/*"]
       }
     }
   }
   ```

2. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run build
   ```

#### Hydration Errors

**Problem**: Hydration mismatch between server and client
```
Warning: Text content did not match. Server: "..." Client: "..."
```

**Solutions**:
1. **Check for client-side only code**:
   ```javascript
   import { useEffect, useState } from 'react';
   
   const [isClient, setIsClient] = useState(false);
   
   useEffect(() => {
     setIsClient(true);
   }, []);
   
   if (!isClient) return null;
   ```

2. **Use dynamic imports**:
   ```javascript
   import dynamic from 'next/dynamic';
   
   const ClientOnlyComponent = dynamic(
     () => import('./ClientOnlyComponent'),
     { ssr: false }
   );
   ```

### Performance Issues

#### Slow Database Queries

**Problem**: Queries taking too long
```
Query took 5000ms to execute
```

**Solutions**:
1. **Add database indexes**:
   ```sql
   -- Check missing indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY n_distinct DESC;
   
   -- Add indexes for common queries
   CREATE INDEX CONCURRENTLY idx_vacancies_search 
   ON vacancies USING GIN(to_tsvector('english', title || ' ' || description));
   ```

2. **Optimize queries**:
   ```sql
   -- Use EXPLAIN ANALYZE to identify bottlenecks
   EXPLAIN ANALYZE SELECT * FROM vacancies 
   WHERE status = 'active' 
   AND tech_stack @> '["JavaScript"]';
   ```

3. **Implement query caching**:
   ```javascript
   const cacheKey = `vacancies:${JSON.stringify(filters)}`;
   let result = await redis.get(cacheKey);
   
   if (!result) {
     result = await database.query(sql, params);
     await redis.setex(cacheKey, 300, JSON.stringify(result));
   }
   ```

#### High Memory Usage

**Problem**: Application consuming too much memory
```
Process memory usage: 2.1 GB
```

**Solutions**:
1. **Profile memory usage**:
   ```bash
   # Use clinic.js for profiling
   npm install -g clinic
   clinic doctor -- node app.js
   ```

2. **Implement memory monitoring**:
   ```javascript
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log({
       rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
       heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
       heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
     });
   }, 60000);
   ```

3. **Fix memory leaks**:
   ```javascript
   // Remove event listeners
   process.removeAllListeners('SIGINT');
   
   // Clear intervals and timeouts
   clearInterval(intervalId);
   clearTimeout(timeoutId);
   
   // Close database connections
   await connection.close();
   ```

### Deployment Issues

#### Docker Build Failures

**Problem**: Docker build fails
```
Error: COPY failed: no source files were specified
```

**Solutions**:
1. **Check Dockerfile paths**:
   ```dockerfile
   # Ensure correct context
   COPY package*.json ./
   COPY apps/api/ ./apps/api/
   ```

2. **Use .dockerignore**:
   ```
   node_modules
   .git
   .env
   .next
   dist
   ```

3. **Debug build process**:
   ```bash
   # Build with verbose output
   docker build --progress=plain --no-cache .
   ```

#### Railway/Fly.io Deployment Issues

**Problem**: Deployment fails on hosting platform
```
Error: Build failed with exit code 1
```

**Solutions**:
1. **Check environment variables**:
   ```bash
   # Railway
   railway variables
   
   # Fly.io
   fly secrets list
   ```

2. **Review deployment logs**:
   ```bash
   # Railway
   railway logs
   
   # Fly.io
   fly logs
   ```

3. **Verify build configuration**:
   ```json
   // package.json
   {
     "engines": {
       "node": "18.x",
       "npm": "9.x"
     },
     "scripts": {
       "build": "npm run build --workspaces",
       "start": "npm run start:prod"
     }
   }
   ```

### API Issues

#### CORS Errors

**Problem**: Cross-origin requests blocked
```
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Solutions**:
1. **Configure CORS properly**:
   ```javascript
   // NestJS
   app.enableCors({
     origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
     allowedHeaders: ['Content-Type', 'Authorization']
   });
   ```

2. **For development**:
   ```javascript
   // Allow all origins in development
   if (process.env.NODE_ENV === 'development') {
     app.enableCors({ origin: true });
   }
   ```

#### Rate Limiting Issues

**Problem**: Too many requests error
```
Error: 429 Too Many Requests
```

**Solutions**:
1. **Adjust rate limits**:
   ```javascript
   // Increase rate limits for development
   if (process.env.NODE_ENV === 'development') {
     rateLimitConfig.max = 1000;
   }
   ```

2. **Implement exponential backoff**:
   ```javascript
   async function apiCall(url, options, retries = 3) {
     try {
       return await fetch(url, options);
     } catch (error) {
       if (retries > 0 && error.status === 429) {
         const delay = Math.pow(2, 4 - retries) * 1000;
         await new Promise(resolve => setTimeout(resolve, delay));
         return apiCall(url, options, retries - 1);
       }
       throw error;
     }
   }
   ```

## Debugging Tools

### Logging

**Enable detailed logging**:
```bash
# Set log level
export LOG_LEVEL=debug

# Enable SQL logging
export DB_LOGGING=true

# Enable API request logging
export API_LOGGING=true
```

**Structured logging example**:
```javascript
const logger = require('winston');

logger.configure({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### Monitoring

**Health check endpoint**:
```javascript
@Get('health')
async getHealth() {
  const dbHealth = await this.checkDatabase();
  const redisHealth = await this.checkRedis();
  const aiHealth = await this.checkAIService();
  
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth ? 'ok' : 'error',
      redis: redisHealth ? 'ok' : 'error',
      ai: aiHealth ? 'ok' : 'error'
    }
  };
}
```

**Performance monitoring**:
```javascript
// Add to main application
const { createPrometheusMetrics } = require('@prometheus-io/client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});
```

### Database Debugging

**Check active connections**:
```sql
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  query
FROM pg_stat_activity
WHERE state = 'active';
```

**Analyze slow queries**:
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Getting Help

1. **Check application logs**:
   ```bash
   # Docker Compose
   docker-compose logs -f api
   
   # Direct logs
   tail -f logs/combined.log
   ```

2. **Review documentation**:
   - [Architecture Guide](./ARCHITECTURE.md)
   - [API Documentation](./API.md)
   - [Deployment Guide](./DEPLOYMENT.md)

3. **Community support**:
   - GitHub Issues: Report bugs and feature requests
   - Discord/Slack: Real-time community help
   - Stack Overflow: Technical questions

4. **Professional support**:
   - Enterprise support plans available
   - Custom development services
   - Training and consulting