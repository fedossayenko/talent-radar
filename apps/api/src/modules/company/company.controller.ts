import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('companies')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all companies with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'industry', required: false, type: String })
  @ApiQuery({ name: 'size', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'overall', 'culture', 'workLife', 'career', 'tech'], description: 'Sort companies by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc for scores, asc for name)' })
  @ApiQuery({ name: 'hasAnalysis', required: false, type: Boolean, description: 'Filter companies with analysis data' })
  @ApiResponse({ status: 200, description: 'List of companies' })
  async findAll(@Query() query: any) {
    return this.companyService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update company information' })
  @ApiResponse({ status: 200, description: 'Company updated successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.companyService.update(id, updateData);
  }

  @Public()
  @Post(':id/analyze')
  @ApiOperation({ summary: 'Analyze company with AI' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force re-scraping bypassing TTL cache' })
  @ApiResponse({ status: 200, description: 'Company analysis completed' })
  async analyzeCompany(
    @Param('id') id: string, 
    @Query('force') force?: boolean,
    @Body() options: { forceRefresh?: boolean } = {}
  ) {
    return this.companyService.analyzeCompany(id, options.forceRefresh, force);
  }

  @Public()
  @Get(':id/analysis')
  @ApiOperation({ summary: 'Get company analysis data' })
  @ApiResponse({ status: 200, description: 'Company analysis data' })
  @ApiResponse({ status: 404, description: 'Company or analysis not found' })
  async getCompanyAnalysis(@Param('id') id: string) {
    return this.companyService.getCompanyAnalysis(id);
  }

  @Public()
  @Get(':id/analysis/latest')
  @ApiOperation({ summary: 'Get latest company analysis' })
  @ApiResponse({ status: 200, description: 'Latest company analysis data' })
  @ApiResponse({ status: 404, description: 'Company or analysis not found' })
  async getLatestAnalysis(@Param('id') id: string) {
    return this.companyService.getLatestAnalysis(id);
  }

  @Public()
  @Get(':id/insights')
  @ApiOperation({ summary: 'Get company insights and key metrics' })
  @ApiResponse({ status: 200, description: 'Company insights summary' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyInsights(@Param('id') id: string) {
    return this.companyService.getCompanyInsights(id);
  }

  @Public()
  @Get('top-rated')
  @ApiOperation({ summary: 'Get top-rated companies based on analysis scores' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of companies to return (default: 20)' })
  @ApiQuery({ name: 'metric', required: false, enum: ['overall', 'culture', 'workLife', 'career', 'tech'], description: 'Metric to sort by (default: overall)' })
  @ApiResponse({ status: 200, description: 'Top-rated companies' })
  async getTopRatedCompanies(@Query() query: { limit?: number; metric?: string }) {
    return this.companyService.getTopRatedCompanies(query.limit, query.metric);
  }
}