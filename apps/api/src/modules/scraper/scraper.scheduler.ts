import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';
import { AllJobData } from './processors/scraper.processor';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScraperScheduler {
  private readonly logger = new Logger(ScraperScheduler.name);

  constructor(
    @InjectQueue('scraper') private readonly scraperQueue: Bull.Queue<AllJobData>,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleDailyDevBgScraping() {
    const isScrapingEnabled = this.configService.get<boolean>('SCRAPER_ENABLED', true);
    
    if (!isScrapingEnabled) {
      this.logger.log('Scraping is disabled, skipping scheduled dev.bg scraping');
      return;
    }

    this.logger.log('Scheduling daily dev.bg scraping job');

    try {
      const job = await this.scraperQueue.add(
        'scrape-dev-bg',
        {
          source: 'dev.bg',
          triggeredBy: 'scheduled_daily',
          options: {
            includeJobDetails: true,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 second delay
          },
          removeOnComplete: 10, // Keep 10 completed jobs
          removeOnFail: 5, // Keep 5 failed jobs for debugging
        }
      );

      this.logger.log(`Scheduled dev.bg scraping job with ID: ${job.id}`);

    } catch (error) {
      this.logger.error('Failed to schedule dev.bg scraping job:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleHealthCheck() {
    this.logger.log('Scheduling hourly health check');

    try {
      const job = await this.scraperQueue.add(
        'health-check',
        {},
        {
          attempts: 1,
          removeOnComplete: 1,
          removeOnFail: 1,
        }
      );

      this.logger.log(`Scheduled health check job with ID: ${job.id}`);

    } catch (error) {
      this.logger.error('Failed to schedule health check job:', error);
    }
  }

  async manualScrapeDevBg(triggeredBy = 'manual'): Promise<string> {
    this.logger.log(`Manually triggering dev.bg scraping (triggered by: ${triggeredBy})`);

    try {
      const job = await this.scraperQueue.add(
        'scrape-dev-bg',
        {
          source: 'dev.bg',
          triggeredBy,
          options: {
            includeJobDetails: true,
          },
        },
        {
          priority: 10, // Higher priority for manual jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      this.logger.log(`Manually triggered dev.bg scraping job with ID: ${job.id}`);
      return job.id.toString();

    } catch (error) {
      this.logger.error('Failed to manually trigger dev.bg scraping:', error);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.scraperQueue.getWaiting(),
        this.scraperQueue.getActive(),
        this.scraperQueue.getCompleted(),
        this.scraperQueue.getFailed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      };

    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string) {
    try {
      const job = await this.scraperQueue.getJob(jobId);
      
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress();
      
      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
      };

    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.scraperQueue.getJob(jobId);
      
      if (!job) {
        this.logger.warn(`Job ${jobId} not found for cancellation`);
        return false;
      }

      await job.remove();
      this.logger.log(`Cancelled job ${jobId}`);
      
      return true;

    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  async retryFailedJobs(): Promise<number> {
    try {
      const failedJobs = await this.scraperQueue.getFailed();
      
      this.logger.log(`Found ${failedJobs.length} failed jobs to retry`);

      let retriedCount = 0;
      for (const job of failedJobs) {
        try {
          await job.retry();
          retriedCount++;
          this.logger.log(`Retried job ${job.id}`);
        } catch (error) {
          this.logger.error(`Failed to retry job ${job.id}:`, error);
        }
      }

      this.logger.log(`Successfully retried ${retriedCount} out of ${failedJobs.length} failed jobs`);
      return retriedCount;

    } catch (error) {
      this.logger.error('Failed to retry failed jobs:', error);
      throw error;
    }
  }

  async cleanOldJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      await this.scraperQueue.clean(sevenDaysAgo, 'completed');
      await this.scraperQueue.clean(sevenDaysAgo, 'failed');
      
      this.logger.log('Cleaned old jobs from queue');

    } catch (error) {
      this.logger.error('Failed to clean old jobs:', error);
    }
  }
}