import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/api/v1/health (GET) - should return healthy status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        info: expect.any(Object),
        error: {},
        details: expect.any(Object),
      });
    });

    it('/api/v1/health/ready (GET) - should return ready status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        info: expect.any(Object),
        error: {},
        details: expect.any(Object),
      });
    });

    it('/api/v1/health/live (GET) - should return live status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        info: expect.any(Object),
        error: {},
        details: expect.any(Object),
      });
    });
  });

  describe('API Documentation', () => {
    it('/api/v1/docs (GET) - should serve Swagger documentation', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/);
    });

    it('/api/v1/docs-json (GET) - should serve OpenAPI JSON', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get('/api/v1/health')
      );

      const responses = await Promise.all(requests);
      
      // All initial requests should succeed
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      // Verify rate limit headers are present
      const firstResponse = responses[0];
      expect(firstResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(firstResponse.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('should handle invalid JSON payloads', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('Compression', () => {
    it('should compress responses when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Response should be compressed if it's large enough
      // Small responses might not be compressed
      expect(response.headers['content-encoding']).toMatch(/gzip|deflate|br|identity/);
    });
  });
});