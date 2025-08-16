import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const {
      page = 1,
      limit = 20,
      search,
      industry,
      size,
    } = query;

    this.logger.log(`Finding companies with filters: ${JSON.stringify(query)}`);

    try {
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (industry) {
        where.industry = { contains: industry, mode: 'insensitive' };
      }

      if (size) {
        where.size = size;
      }

      const total = await this.prisma.company.count({ where });

      const companies = await this.prisma.company.findMany({
        where,
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              vacancies: {
                where: { status: 'active' },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        data: companies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to find companies:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    this.logger.log(`Finding company with ID: ${id}`);

    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
          },
          vacancies: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              title: true,
              experienceLevel: true,
              employmentType: true,
              location: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              vacancies: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      return {
        success: true,
        data: company,
      };
    } catch (error) {
      this.logger.error(`Failed to find company ${id}:`, error);
      throw error;
    }
  }

  async update(id: string, updateData: any) {
    this.logger.log(`Updating company ${id} with data:`, updateData);

    try {
      const company = await this.prisma.company.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      return {
        success: true,
        data: company,
        message: 'Company updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update company ${id}:`, error);
      
      if (error.code === 'P2025') {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }
      
      throw error;
    }
  }

  async analyzeCompany(id: string, forceRefresh = false) {
    this.logger.log(`Analyzing company ${id}, forceRefresh: ${forceRefresh}`);

    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          vacancies: {
            where: { status: 'active' },
            select: {
              title: true,
              description: true,
              requirements: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      // Check if recent analysis exists and forceRefresh is false
      const recentAnalysis = company.analyses[0];
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      if (recentAnalysis && recentAnalysis.createdAt > oneDayAgo && !forceRefresh) {
        return {
          success: true,
          data: recentAnalysis,
          message: 'Using existing recent analysis',
        };
      }

      // Placeholder for AI analysis
      // This will be implemented with the AI service
      const mockAnalysis = {
        cultureScore: Math.random() * 10,
        retentionRate: Math.random() * 100,
        hiringProcess: JSON.stringify(['Application Review', 'Technical Interview', 'Cultural Fit Interview', 'Offer']),
        techStack: JSON.stringify(['JavaScript', 'TypeScript', 'React', 'Node.js']),
        workLifeBalance: Math.random() * 10,
        careerGrowth: Math.random() * 10,
        salaryCompetitiveness: Math.random() * 10,
        benefitsScore: Math.random() * 10,
      };

      const analysis = await this.prisma.companyAnalysis.create({
        data: {
          companyId: id,
          ...mockAnalysis,
          analysisSource: 'ai_generated',
          confidenceScore: 0.8,
          rawData: JSON.stringify(mockAnalysis),
        },
      });

      return {
        success: true,
        data: analysis,
        message: 'Company analysis completed',
      };
    } catch (error) {
      this.logger.error(`Failed to analyze company ${id}:`, error);
      throw error;
    }
  }
}