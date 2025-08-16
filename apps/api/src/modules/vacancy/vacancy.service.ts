import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class VacancyService {
  private readonly logger = new Logger(VacancyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const {
      page = 1,
      limit = 20,
      search,
      technologies,
      location,
      experienceLevel,
      salaryMin,
      salaryMax,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;

    this.logger.log(`Finding vacancies with filters: ${JSON.stringify(query)}`);

    try {
      // Build filter conditions
      const where: any = {
        status: 'active',
      };

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (technologies && technologies.length > 0) {
        where.techStack = {
          hasEvery: Array.isArray(technologies) ? technologies : [technologies],
        };
      }

      if (location) {
        where.location = {
          path: ['country'],
          equals: location,
        };
      }

      if (experienceLevel) {
        where.experienceLevel = experienceLevel;
      }

      if (salaryMin || salaryMax) {
        where.salary = {};
        if (salaryMin) {
          where.salary.path = ['min'];
          where.salary.gte = salaryMin;
        }
        if (salaryMax) {
          where.salary.path = ['max'];
          where.salary.lte = salaryMax;
        }
      }

      // Get total count for pagination
      const total = await this.prisma.vacancy.count({ where });

      // Get vacancies with pagination
      const vacancies = await this.prisma.vacancy.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              size: true,
              industry: true,
              logoUrl: true,
            },
          },
          source: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          [sortBy]: order,
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        data: vacancies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to find vacancies:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    this.logger.log(`Finding vacancy with ID: ${id}`);

    try {
      const vacancy = await this.prisma.vacancy.findUnique({
        where: { id },
        include: {
          company: {
            include: {
              analyses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          source: true,
          duplicates: {
            include: {
              duplicateVacancy: {
                select: {
                  id: true,
                  title: true,
                  company: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!vacancy) {
        throw new NotFoundException(`Vacancy with ID ${id} not found`);
      }

      return {
        success: true,
        data: vacancy,
      };
    } catch (error) {
      this.logger.error(`Failed to find vacancy ${id}:`, error);
      throw error;
    }
  }

  async update(id: string, updateData: any) {
    this.logger.log(`Updating vacancy ${id} with data:`, updateData);

    try {
      const vacancy = await this.prisma.vacancy.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          company: true,
          source: true,
        },
      });

      return {
        success: true,
        data: vacancy,
        message: 'Vacancy updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update vacancy ${id}:`, error);
      
      if (error.code === 'P2025') {
        throw new NotFoundException(`Vacancy with ID ${id} not found`);
      }
      
      throw error;
    }
  }

  async scoreVacancy(id: string, preferences: any) {
    this.logger.log(`Scoring vacancy ${id} with preferences:`, preferences);

    try {
      // Placeholder for scoring logic
      // This will be implemented with the AI service
      const mockScore = Math.random() * 100;
      const mockBreakdown = {
        salaryScore: Math.random() * 100,
        techMatchScore: Math.random() * 100,
        companyScore: Math.random() * 100,
        locationScore: Math.random() * 100,
        totalScore: mockScore,
      };

      const updatedVacancy = await this.prisma.vacancy.update({
        where: { id },
        data: {
          score: mockScore,
          scoreBreakdown: mockBreakdown,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          id: updatedVacancy.id,
          score: mockScore,
          scoreBreakdown: mockBreakdown,
        },
        message: 'Vacancy scored successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to score vacancy ${id}:`, error);
      
      if (error.code === 'P2025') {
        throw new NotFoundException(`Vacancy with ID ${id} not found`);
      }
      
      throw error;
    }
  }

  async markDuplicate(duplicateId: string, originalId: string) {
    this.logger.log(`Marking vacancy ${duplicateId} as duplicate of ${originalId}`);

    try {
      // Start a transaction to update both vacancies and create the relationship
      const result = await this.prisma.$transaction(async (tx) => {
        // Mark the duplicate vacancy as duplicate
        const duplicateVacancy = await tx.vacancy.update({
          where: { id: duplicateId },
          data: {
            status: 'duplicate',
            duplicateOf: originalId,
            updatedAt: new Date(),
          },
        });

        // Create the duplicate relationship record
        await tx.vacancyDuplicate.create({
          data: {
            originalVacancyId: originalId,
            duplicateVacancyId: duplicateId,
            similarityScore: 95, // Placeholder - would be calculated by AI
            detectionMethod: 'manual',
          },
        });

        return duplicateVacancy;
      });

      return {
        success: true,
        data: result,
        message: 'Vacancy marked as duplicate successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to mark vacancy ${duplicateId} as duplicate:`, error);
      
      if (error.code === 'P2025') {
        throw new NotFoundException(`Vacancy not found`);
      }
      
      throw error;
    }
  }
}