import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanySourceService } from './company-source.service';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [CompanyController],
  providers: [CompanyService, CompanySourceService],
  exports: [CompanyService, CompanySourceService],
})
export class CompanyModule {}