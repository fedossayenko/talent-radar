import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import * as Bull from 'bull';
import { ScraperService, ScrapingResult } from '../scraper.service';

export interface ScrapingJobData {
  source: string;
  options?: any;
  triggeredBy?: string;
}

export interface HealthCheckJobData {
  // Empty interface for health check jobs
}

export type AllJobData = ScrapingJobData | HealthCheckJobData;

@Processor('scraper')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Process('scrape-dev-bg')
  async handleDevBgScraping(job: Bull.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { data } = job;
    
    this.logger.log(`Starting dev.bg scraping job ${job.id}`, {
      triggeredBy: data.triggeredBy,
      options: data.options,
    });

    try {
      // Update job progress
      await job.progress(10);

      // Execute scraping
      const result = await this.scraperService.scrapeDevBg();

      // Update job progress
      await job.progress(90);

      this.logger.log(`Dev.bg scraping job ${job.id} completed successfully`, {
        totalJobsFound: result.totalJobsFound,
        newVacancies: result.newVacancies,
        updatedVacancies: result.updatedVacancies,
        newCompanies: result.newCompanies,
        errors: result.errors.length,
        duration: result.duration,
      });

      // Final progress update
      await job.progress(100);

      return result;

    } catch (error) {
      this.logger.error(`Dev.bg scraping job ${job.id} failed:`, error);
      
      // Re-throw to mark job as failed
      throw error;
    }
  }

  @Process('health-check')
  async handleHealthCheck(job: Bull.Job<HealthCheckJobData>): Promise<{ status: string; timestamp: Date }> {
    this.logger.log(`Processing health check job ${job.id}`);
    
    return {
      status: 'healthy',
      timestamp: new Date(),
    };
  }
}