import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export class DatabaseHelper {
  private static prisma: PrismaClient;

  static async initializeTestDatabase(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'file:./test.db',
          },
        },
      });

      await this.prisma.$connect();
      
      // Simple approach: use db push to ensure schema is up to date
      try {
        execSync('bunx prisma db push --force-reset --skip-generate', { 
          stdio: 'inherit',
          timeout: 30000
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Database migration warning:', error.message);
        // Continue anyway - tables might already exist
      }
    }

    return this.prisma;
  }

  static async clearDatabase(): Promise<void> {
    if (!this.prisma) return;

    try {
      // Clear all tables in the correct order for SQLite (respecting foreign key constraints)
      // Use try-catch for each table to handle missing tables gracefully
      try {
        await this.prisma.application.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }

      try {
        await this.prisma.vacancyScore.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }

      try {
        await this.prisma.vacancy.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }

      try {
        await this.prisma.companyAnalysis.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }

      try {
        await this.prisma.company.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }

      try {
        await this.prisma.cV.deleteMany();
      } catch (error) {
        // Table might not exist yet, ignore
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Database clearing warning:', error.message);
    }
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
      this.prisma = null;
    }
  }

  static getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}