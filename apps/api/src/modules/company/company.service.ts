import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseJsonField(field: any): any {
    if (!field || typeof field !== 'string') {
      return field;
    }
    
    try {
      return JSON.parse(field);
    } catch (error) {
      this.logger.warn(`Failed to parse JSON field: ${field}`);
      return field;
    }
  }

  async findAll(query: any) {
    const {
      page: pageParam = 1,
      limit: limitParam = 20,
      search,
      industry,
      size,
      sortBy = 'name',
      sortOrder,
      hasAnalysis,
    } = query;

    // Convert string parameters to numbers
    const page = parseInt(pageParam.toString(), 10) || 1;
    const limit = parseInt(limitParam.toString(), 10) || 20;

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

      if (hasAnalysis === true) {
        where.analyses = {
          some: {},
        };
      } else if (hasAnalysis === false) {
        where.analyses = {
          none: {},
        };
      }

      const total = await this.prisma.company.count({ where });

      // Determine sort order based on field
      const defaultSortOrder = sortBy === 'name' ? 'asc' : 'desc';
      const finalSortOrder = sortOrder || defaultSortOrder;

      let orderBy: any = { name: 'asc' };
      if (sortBy === 'name') {
        orderBy = { name: finalSortOrder };
      } else {
        // For score-based sorting, we'll sort in memory after fetching
        orderBy = { name: 'asc' };
      }

      const companies = await this.prisma.company.findMany({
        where,
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              recommendationScore: true,
              cultureScore: true,
              workLifeBalance: true,
              careerGrowth: true,
              techCulture: true,
              confidenceScore: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              vacancies: {
                where: { status: 'active' },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      // Process companies with analysis summary
      const processedCompanies = companies.map(company => {
        const latestAnalysis = company.analyses?.[0];
        return {
          ...company,
          analyses: undefined, // Remove full analyses from list view
          analysisScore: latestAnalysis?.recommendationScore || null,
          hasAnalysis: !!latestAnalysis,
          analysisAge: latestAnalysis ? Math.floor((Date.now() - latestAnalysis.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : null,
          recommendation: latestAnalysis ? this.getRecommendationLevel(latestAnalysis.recommendationScore) : null,
          scores: latestAnalysis ? {
            overall: latestAnalysis.recommendationScore,
            culture: latestAnalysis.cultureScore,
            workLife: latestAnalysis.workLifeBalance,
            career: latestAnalysis.careerGrowth,
            tech: latestAnalysis.techCulture,
          } : null,
        };
      });

      // Apply score-based sorting if needed
      if (sortBy !== 'name') {
        processedCompanies.sort((a, b) => {
          const aScore = this.getScoreByMetric(a.scores, sortBy);
          const bScore = this.getScoreByMetric(b.scores, sortBy);
          
          // Handle null scores (companies without analysis)
          if (aScore === null && bScore === null) return 0;
          if (aScore === null) return 1; // null scores go to end
          if (bScore === null) return -1;
          
          return finalSortOrder === 'desc' ? (bScore - aScore) : (aScore - bScore);
        });
      }

      // Apply pagination after sorting
      const startIndex = (page - 1) * limit;
      const paginatedCompanies = processedCompanies.slice(startIndex, startIndex + limit);

      return {
        success: true,
        data: paginatedCompanies,
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
          sources: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              sourceSite: true,
              sourceUrl: true,
              lastScrapedAt: true,
              isValid: true,
              createdAt: true,
            },
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
              salaryMin: true,
              salaryMax: true,
              currency: true,
              benefits: true,
              requirements: true,
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

      // Transform data to match frontend expectations
      const latestAnalysis = company.analyses?.[0] || null;
      const activeVacanciesCount = company._count?.vacancies || 0;
      const hasAnalysis = (company.analyses?.length || 0) > 0;

      // Parse JSON string fields in analysis if they exist
      let transformedAnalysis = latestAnalysis;
      let contactInfo = null;
      let companyDetails = null;

      if (latestAnalysis) {
        // Parse JSON fields
        transformedAnalysis = {
          ...latestAnalysis,
          techStack: this.parseJsonField(latestAnalysis.techStack),
          benefits: this.parseJsonField(latestAnalysis.benefits),
          hiringProcess: this.parseJsonField(latestAnalysis.hiringProcess),
          pros: this.parseJsonField(latestAnalysis.pros),
          cons: this.parseJsonField(latestAnalysis.cons),
          growthOpportunities: this.parseJsonField(latestAnalysis.growthOpportunities),
          companyValues: this.parseJsonField(latestAnalysis.companyValues),
        };

        // Extract contact info from rawData if available
        const rawData = this.parseJsonField(latestAnalysis.rawData);
        if (rawData) {
          contactInfo = {
            email: rawData.contactEmail || null,
            phone: rawData.contactPhone || null,
            address: rawData.address || null,
          };

          companyDetails = {
            services: rawData.services || null,
            companyType: rawData.companyType || null,
            businessLicense: rawData.businessLicense || null,
            clientProjects: rawData.clientProjects || null,
          };
        }
      }

      // Parse JSON fields in vacancies
      const processedVacancies = company.vacancies?.map(vacancy => ({
        ...vacancy,
        benefits: this.parseJsonField(vacancy.benefits),
        requirements: this.parseJsonField(vacancy.requirements),
      }));

      // Calculate salary range from all vacancies
      const salaryRanges = processedVacancies
        ?.filter(v => v.salaryMin || v.salaryMax)
        .map(v => ({ min: v.salaryMin, max: v.salaryMax, currency: v.currency }));
      
      const companySalaryRange = salaryRanges && salaryRanges.length > 0 ? {
        min: Math.min(...salaryRanges.map(r => r.min).filter(Boolean)),
        max: Math.max(...salaryRanges.map(r => r.max).filter(Boolean)),
        currency: salaryRanges[0]?.currency || 'BGN',
      } : null;

      const transformedCompany = {
        ...company,
        latestAnalysis: transformedAnalysis,
        activeVacanciesCount,
        hasAnalysis,
        vacancies: processedVacancies,
        salaryRange: companySalaryRange,
        contactInfo,
        companyDetails,
        // Remove analyses array since frontend expects latestAnalysis
        analyses: undefined,
        _count: undefined,
      };

      return {
        success: true,
        data: transformedCompany,
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

  async findOrCreate(companyData: {
    name: string;
    website?: string;
    description?: string;
    industry?: string;
    location?: string;
  }) {
    this.logger.log(`Finding or creating company: ${companyData.name}`);

    try {
      // First try to find existing company
      const existingCompany = await this.prisma.company.findFirst({
        where: {
          name: {
            equals: companyData.name,
          },
        },
      });

      if (existingCompany) {
        this.logger.log(`Found existing company: ${existingCompany.name} (ID: ${existingCompany.id})`);
        return existingCompany;
      }

      // Create new company if not found
      const newCompany = await this.prisma.company.create({
        data: {
          name: companyData.name,
          website: companyData.website,
          description: companyData.description,
          industry: companyData.industry || 'Technology',
          location: companyData.location,
        },
      });

      this.logger.log(`Created new company: ${newCompany.name} (ID: ${newCompany.id})`);
      return newCompany;

    } catch (error) {
      this.logger.error(`Failed to find or create company ${companyData.name}:`, error);
      throw error;
    }
  }

  async analyzeCompany(id: string, forceRefresh = false, force = false) {
    this.logger.log(`Analyzing company ${id}, forceRefresh: ${forceRefresh}, force: ${force}`);

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

  /**
   * Create or update company analysis from scraped and AI-analyzed data
   */
  async createOrUpdateAnalysis(analysisData: {
    companyId: string;
    analysisSource: string;
    recommendationScore?: number;
    pros?: string;
    cons?: string;
    cultureScore?: number;
    workLifeBalance?: number;
    careerGrowth?: number;
    salaryCompetitiveness?: number;
    benefitsScore?: number;
    techCulture?: number;
    retentionRate?: number;
    workEnvironment?: string;
    interviewProcess?: string;
    growthOpportunities?: string;
    benefits?: string;
    techStack?: string;
    companyValues?: string;
    confidenceScore?: number;
    rawData?: string;
    dataCompleteness?: number;
    name?: string;
    industry?: string;
    location?: string;
    size?: string;
    description?: string;
    technologies?: string[];
  }) {
    this.logger.log(`Creating/updating company analysis for company ${analysisData.companyId} from ${analysisData.analysisSource}`);

    try {
      // Check if analysis already exists for this company and source
      const existingAnalysis = await this.prisma.companyAnalysis.findFirst({
        where: {
          companyId: analysisData.companyId,
          analysisSource: analysisData.analysisSource,
        },
      });

      let analysis;
      let message;
      if (existingAnalysis) {
        // Update existing analysis
        const { technologies, ...dbData } = analysisData;
        analysis = await this.prisma.companyAnalysis.update({
          where: { id: existingAnalysis.id },
          data: {
            ...dbData,
            techStack: technologies ? JSON.stringify(technologies) : dbData.techStack,
            updatedAt: new Date(),
          },
        });
        message = 'Company analysis updated successfully';
        this.logger.log(`Updated existing company analysis for ${analysisData.companyId}`);
      } else {
        // Create new analysis
        const { technologies, ...dbData } = analysisData;
        analysis = await this.prisma.companyAnalysis.create({
          data: {
            ...dbData,
            techStack: technologies ? JSON.stringify(technologies) : dbData.techStack,
            createdAt: new Date(),
          },
        });
        message = 'Company analysis created successfully';
        this.logger.log(`Created new company analysis for ${analysisData.companyId}`);
      }

      return {
        success: true,
        data: analysis,
        message,
      };

    } catch (error) {
      this.logger.error(`Failed to create/update company analysis for ${analysisData.companyId}:`, error);
      throw error;
    }
  }

  async getCompanyAnalysis(companyId: string) {
    this.logger.log(`Getting all analysis data for company ${companyId}`);

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              analysisSource: true,
              recommendationScore: true,
              pros: true,
              cons: true,
              cultureScore: true,
              workLifeBalance: true,
              careerGrowth: true,
              salaryCompetitiveness: true,
              benefitsScore: true,
              techCulture: true,
              retentionRate: true,
              workEnvironment: true,
              interviewProcess: true,
              growthOpportunities: true,
              benefits: true,
              techStack: true,
              companyValues: true,
              confidenceScore: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${companyId} not found`);
      }

      // Parse JSON fields for better API response
      const processedAnalyses = company.analyses.map(analysis => ({
        ...analysis,
        pros: analysis.pros ? (typeof analysis.pros === 'string' ? JSON.parse(analysis.pros) : analysis.pros) : [],
        cons: analysis.cons ? (typeof analysis.cons === 'string' ? JSON.parse(analysis.cons) : analysis.cons) : [],
        growthOpportunities: analysis.growthOpportunities ? (typeof analysis.growthOpportunities === 'string' ? JSON.parse(analysis.growthOpportunities) : analysis.growthOpportunities) : [],
        benefits: analysis.benefits ? (typeof analysis.benefits === 'string' ? JSON.parse(analysis.benefits) : analysis.benefits) : [],
        technologies: analysis.techStack ? (typeof analysis.techStack === 'string' ? JSON.parse(analysis.techStack) : analysis.techStack) : [],
        values: analysis.companyValues ? (typeof analysis.companyValues === 'string' ? JSON.parse(analysis.companyValues) : analysis.companyValues) : [],
      }));

      return {
        success: true,
        data: {
          company: {
            id: company.id,
            name: company.name,
            description: company.description,
            industry: company.industry,
            size: company.size,
            location: company.location,
            website: company.website,
          },
          analyses: processedAnalyses,
          analysisCount: processedAnalyses.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get company analysis for ${companyId}:`, error);
      throw error;
    }
  }

  async getLatestAnalysis(companyId: string) {
    this.logger.log(`Getting latest analysis for company ${companyId}`);

    try {
      const latestAnalysis = await this.prisma.companyAnalysis.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              description: true,
              industry: true,
              size: true,
              location: true,
              website: true,
            },
          },
        },
      });

      if (!latestAnalysis) {
        throw new NotFoundException(`No analysis found for company ${companyId}`);
      }

      // Parse JSON fields
      const processedAnalysis = {
        ...latestAnalysis,
        pros: latestAnalysis.pros ? (typeof latestAnalysis.pros === 'string' ? JSON.parse(latestAnalysis.pros) : latestAnalysis.pros) : [],
        cons: latestAnalysis.cons ? (typeof latestAnalysis.cons === 'string' ? JSON.parse(latestAnalysis.cons) : latestAnalysis.cons) : [],
        growthOpportunities: latestAnalysis.growthOpportunities ? (typeof latestAnalysis.growthOpportunities === 'string' ? JSON.parse(latestAnalysis.growthOpportunities) : latestAnalysis.growthOpportunities) : [],
        benefits: latestAnalysis.benefits ? (typeof latestAnalysis.benefits === 'string' ? JSON.parse(latestAnalysis.benefits) : latestAnalysis.benefits) : [],
        technologies: latestAnalysis.techStack ? (typeof latestAnalysis.techStack === 'string' ? JSON.parse(latestAnalysis.techStack) : latestAnalysis.techStack) : [],
        values: latestAnalysis.companyValues ? (typeof latestAnalysis.companyValues === 'string' ? JSON.parse(latestAnalysis.companyValues) : latestAnalysis.companyValues) : [],
        rawData: undefined, // Don't expose raw data in API
      };

      return {
        success: true,
        data: processedAnalysis,
      };
    } catch (error) {
      this.logger.error(`Failed to get latest analysis for company ${companyId}:`, error);
      throw error;
    }
  }

  async getCompanyInsights(companyId: string) {
    this.logger.log(`Getting company insights for ${companyId}`);

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
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
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${companyId} not found`);
      }

      const latestAnalysis = company.analyses[0];
      const insights: any = {
        company: {
          id: company.id,
          name: company.name,
          description: company.description,
          industry: company.industry,
          size: company.size,
          location: company.location,
          website: company.website,
          activeVacancies: company._count.vacancies,
        },
        hasAnalysis: !!latestAnalysis,
        analysisAge: latestAnalysis ? Math.floor((Date.now() - latestAnalysis.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : null,
      };

      if (latestAnalysis) {
        insights.scores = {
          overall: latestAnalysis.recommendationScore,
          culture: latestAnalysis.cultureScore,
          workLifeBalance: latestAnalysis.workLifeBalance,
          careerGrowth: latestAnalysis.careerGrowth,
          salaryCompetitiveness: latestAnalysis.salaryCompetitiveness,
          benefits: latestAnalysis.benefitsScore,
          techCulture: latestAnalysis.techCulture,
          retention: latestAnalysis.retentionRate,
          confidence: latestAnalysis.confidenceScore,
        };

        insights.highlights = {
          topPros: latestAnalysis.pros ? (typeof latestAnalysis.pros === 'string' ? JSON.parse(latestAnalysis.pros) : latestAnalysis.pros).slice(0, 3) : [],
          mainConcerns: latestAnalysis.cons ? (typeof latestAnalysis.cons === 'string' ? JSON.parse(latestAnalysis.cons) : latestAnalysis.cons).slice(0, 2) : [],
          keyTechnologies: latestAnalysis.techStack ? (typeof latestAnalysis.techStack === 'string' ? JSON.parse(latestAnalysis.techStack) : latestAnalysis.techStack).slice(0, 5) : [],
          coreValues: latestAnalysis.companyValues ? (typeof latestAnalysis.companyValues === 'string' ? JSON.parse(latestAnalysis.companyValues) : latestAnalysis.companyValues).slice(0, 3) : [],
        };

        insights.recommendation = this.getRecommendationLevel(latestAnalysis.recommendationScore);
      }

      return {
        success: true,
        data: insights,
      };
    } catch (error) {
      this.logger.error(`Failed to get company insights for ${companyId}:`, error);
      throw error;
    }
  }

  async getTopRatedCompanies(limit = 20, metric = 'overall') {
    this.logger.log(`Getting top-rated companies (limit: ${limit}, metric: ${metric})`);

    try {
      const orderByField = this.getMetricField(metric);
      
      const companies = await this.prisma.company.findMany({
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            where: {
              [orderByField]: {
                not: null,
              },
            },
          },
          _count: {
            select: {
              vacancies: {
                where: { status: 'active' },
              },
            },
          },
        },
        take: limit,
      });

      // Filter companies that have analyses and sort by the selected metric
      const companiesWithAnalysis = companies
        .filter(company => company.analyses.length > 0)
        .map(company => {
          const analysis = company.analyses[0];
          return {
            id: company.id,
            name: company.name,
            description: company.description,
            industry: company.industry,
            size: company.size,
            location: company.location,
            website: company.website,
            activeVacancies: company._count.vacancies,
            scores: {
              overall: analysis.recommendationScore,
              culture: analysis.cultureScore,
              workLifeBalance: analysis.workLifeBalance,
              careerGrowth: analysis.careerGrowth,
              salaryCompetitiveness: analysis.salaryCompetitiveness,
              benefits: analysis.benefitsScore,
              techCulture: analysis.techCulture,
              retention: analysis.retentionRate,
              confidence: analysis.confidenceScore,
            },
            analysisAge: Math.floor((Date.now() - analysis.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
            recommendation: this.getRecommendationLevel(analysis.recommendationScore),
          };
        })
        .sort((a, b) => {
          const aScore = this.getScoreByMetric(a.scores, metric);
          const bScore = this.getScoreByMetric(b.scores, metric);
          return (bScore || 0) - (aScore || 0);
        })
        .slice(0, limit);

      return {
        success: true,
        data: {
          companies: companiesWithAnalysis,
          total: companiesWithAnalysis.length,
          sortedBy: metric,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get top-rated companies:`, error);
      throw error;
    }
  }

  private getMetricField(metric: string): string {
    const fieldMap: Record<string, string> = {
      overall: 'recommendationScore',
      culture: 'cultureScore',
      workLife: 'workLifeBalance',
      career: 'careerGrowth',
      tech: 'techCulture',
    };
    return fieldMap[metric] || 'recommendationScore';
  }

  private getScoreByMetric(scores: any, metric: string): number | null {
    if (!scores) return null;
    
    const scoreMap: Record<string, string> = {
      overall: 'overall',
      culture: 'culture',
      workLife: 'workLifeBalance',
      career: 'careerGrowth',
      tech: 'techCulture',
    };
    const scoreKey = scoreMap[metric] || 'overall';
    return scores[scoreKey] || null;
  }

  private getRecommendationLevel(recommendationScore: number | null): string {
    if (!recommendationScore) return 'No rating';
    if (recommendationScore >= 8.5) return 'Highly Recommended';
    if (recommendationScore >= 7.5) return 'Recommended';
    if (recommendationScore >= 6.5) return 'Good Option';
    if (recommendationScore >= 5.5) return 'Consider Carefully';
    return 'Proceed with Caution';
  }
}