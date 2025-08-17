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
  // Adding a second comment to re-trigger the AI reviewer workflow
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  await app.listen(port);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});