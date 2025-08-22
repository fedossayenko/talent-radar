import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../../src/common/database/database.module';
import { RedisService } from '../../src/common/redis/redis.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { DatabaseHelper } from './database.helper';
import { RedisMockService } from './redis-mock.service';

// Import config files
import { appConfig } from '../../src/config/app.config';
import { databaseConfig } from '../../src/config/database.config';
import { redisConfig } from '../../src/config/redis.config';
import { aiConfig } from '../../src/config/ai.config';
import scraperConfig from '../../src/config/scraper.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, aiConfig, scraperConfig],
      envFilePath: ['.env.test', '.env'],
    }),
    DatabaseModule,
  ],
  providers: [
    {
      provide: RedisService,
      useClass: RedisMockService,
    },
  ],
  exports: [RedisService],
})
export class TestModule {
  static async createTestingModule(imports: any[] = [], providers: any[] = []): Promise<TestingModule> {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule, ...imports],
      providers: [...providers],
    }).compile();

    // Initialize test database
    await DatabaseHelper.initializeTestDatabase();
    
    return moduleRef;
  }

  static async clearTestData(): Promise<void> {
    await DatabaseHelper.clearDatabase();
  }

  static async seedTestData(): Promise<void> {
    await DatabaseHelper.seedTestData();
  }

  static async closeTestModule(moduleRef: TestingModule): Promise<void> {
    if (moduleRef) {
      try {
        const prismaService = moduleRef.get<PrismaService>(PrismaService);
        if (prismaService) {
          await prismaService.$disconnect();
        }
        await moduleRef.close();
      } catch (error) {
        // Ignore errors during cleanup
        // eslint-disable-next-line no-console
        console.warn('Error during test module cleanup:', error.message);
      }
    }
    await DatabaseHelper.closeDatabase();
  }
}