import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export class DatabaseHelper {
  private static prisma: PrismaClient;

  static async initializeTestDatabase(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'file:./test/tmp/test.db',
          },
        },
      });

      await this.prisma.$connect();
      
      // Run migrations if needed
      try {
        execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
      } catch (error) {
        console.warn('Migration warning:', error);
      }
    }

    return this.prisma;
  }

  static async clearDatabase(): Promise<void> {
    if (!this.prisma) return;

    // Clear all tables in the correct order for SQLite (respecting foreign key constraints)
    await this.prisma.application.deleteMany();
    await this.prisma.vacancyScore.deleteMany();
    await this.prisma.vacancy.deleteMany();
    await this.prisma.companyAnalysis.deleteMany();
    await this.prisma.company.deleteMany();
    await this.prisma.cV.deleteMany();
  }

  static async seedTestData(): Promise<void> {
    if (!this.prisma) return;

    // Create test companies
    const testCompany = await this.prisma.company.create({
      data: {
        name: 'Test Tech Company',
        website: 'https://test-tech.com',
        description: 'A test technology company',
        industry: 'Technology',
        size: '100-500',
        location: 'San Francisco, CA',
      },
    });

    // Create test vacancies
    await this.prisma.vacancy.create({
      data: {
        title: 'Senior Frontend Developer',
        description: 'Looking for a senior frontend developer with React experience',
        requirements: JSON.stringify(['React', 'TypeScript', '3+ years experience']),
        location: 'Remote',
        salaryMin: 80000,
        salaryMax: 120000,
        experienceLevel: 'senior',
        employmentType: 'full-time',
        companyId: testCompany.id,
        sourceUrl: 'https://example.com/job/1',
        sourceSite: 'example.com',
        status: 'active',
      },
    });

    await this.prisma.vacancy.create({
      data: {
        title: 'Backend Engineer',
        description: 'Backend engineer position for Node.js development',
        requirements: JSON.stringify(['Node.js', 'PostgreSQL', '2+ years experience']),
        location: 'New York, NY',
        salaryMin: 90000,
        salaryMax: 140000,
        experienceLevel: 'mid',
        employmentType: 'full-time',
        companyId: testCompany.id,
        sourceUrl: 'https://example.com/job/2',
        sourceSite: 'example.com',
        status: 'active',
      },
    });
  }

  static async closeDatabase(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  static getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}