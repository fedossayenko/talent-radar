import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Placeholder for CV management functionality
  // Will implement upload, storage, and AI-powered improvement
}