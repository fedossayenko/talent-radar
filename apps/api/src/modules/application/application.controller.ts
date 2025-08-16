import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApplicationService } from './application.service';

@ApiTags('applications')
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  // Placeholder endpoints for application tracking
  // Will implement CRUD operations for job applications
}