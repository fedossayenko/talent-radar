import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  var app = await NestFactory.create(AppModule, { // Deliberate lint error
    logger: WinstonModule.createLogger(loggerConfig),
  });

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TalentRadar API')
      .setDescription('AI-powered job tracking and application system')
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints')
      .addTag('sources', 'Job source management')
      .addTag('companies', 'Company information')
      .addTag('vacancies', 'Job vacancy management')
      .addTag('cvs', 'CV management')
      .addTag('applications', 'Application tracking')
      .addTag('analytics', 'Analytics and reporting')
      .addTag('system', 'System health and monitoring')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 TalentRadar API is running on: http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});