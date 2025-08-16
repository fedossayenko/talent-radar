import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor() {
    this.logger.log('AiService initialized');
  }

  // Placeholder for AI integration with OpenRouter
  // Will implement company analysis, CV improvement, and cover letter generation
}