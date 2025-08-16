import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CvService } from './cv.service';

@ApiTags('cv')
@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  // Placeholder endpoints for CV management
  // Will implement upload, list, improve, and generate cover letters
}