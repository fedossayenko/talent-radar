import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VacancyService } from './vacancy.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('vacancies')
@Controller('vacancies')
export class VacancyController {
  constructor(private readonly vacancyService: VacancyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all vacancies with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'technologies', required: false, type: [String] })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'experienceLevel', required: false, type: String })
  @ApiQuery({ name: 'salaryMin', required: false, type: Number })
  @ApiQuery({ name: 'salaryMax', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of vacancies' })
  async findAll(@Query() query: any) {
    return this.vacancyService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get vacancy by ID' })
  @ApiResponse({ status: 200, description: 'Vacancy details' })
  @ApiResponse({ status: 404, description: 'Vacancy not found' })
  async findOne(@Param('id') id: string) {
    return this.vacancyService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update vacancy' })
  @ApiResponse({ status: 200, description: 'Vacancy updated successfully' })
  @ApiResponse({ status: 404, description: 'Vacancy not found' })
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.vacancyService.update(id, updateData);
  }

  @Post(':id/score')
  @ApiOperation({ summary: 'Calculate vacancy score based on preferences' })
  @ApiResponse({ status: 200, description: 'Vacancy scored successfully' })
  async scoreVacancy(@Param('id') id: string, @Body() preferences: any) {
    return this.vacancyService.scoreVacancy(id, preferences);
  }

  @Post(':id/mark-duplicate')
  @ApiOperation({ summary: 'Mark vacancy as duplicate of another' })
  @ApiResponse({ status: 200, description: 'Vacancy marked as duplicate' })
  async markDuplicate(@Param('id') id: string, @Body() body: { originalVacancyId: string }) {
    return this.vacancyService.markDuplicate(id, body.originalVacancyId);
  }
}