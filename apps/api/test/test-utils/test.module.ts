import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../../src/common/database/database.module';
import { RedisModule } from '../../src/common/redis/redis.module';
import { PrismaService } from '../../src/common/database/prisma.service';
import { DatabaseHelper } from './database.helper';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
    }),
    DatabaseModule,
    RedisModule,
  ],
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
    const prismaService = moduleRef.get<PrismaService>(PrismaService);
    await prismaService.$disconnect();
    await moduleRef.close();
    await DatabaseHelper.closeDatabase();
  }
}