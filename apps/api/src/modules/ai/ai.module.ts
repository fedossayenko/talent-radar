import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}