import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { RedisModule } from '../../common/redis/redis.module';
import { AiRequestLoggerService } from '../../common/ai-logging/ai-request-logger.service';
import { ContentExtractorService } from '../scraper/services/content-extractor.service';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [AiService, AiRequestLoggerService, ContentExtractorService],
  exports: [AiService],
})
export class AiModule {}