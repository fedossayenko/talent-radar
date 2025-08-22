import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CompanyValidationService } from './company-validation.service';

describe('CompanyValidationService', () => {
  let service: CompanyValidationService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanyValidationService],
    }).compile();

    service = module.get<CompanyValidationService>(CompanyValidationService);
    loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidCompanyName', () => {
    it('should reject job board names', () => {
      const jobBoardNames = [
        'DEV.BG',
        'dev.bg',
        'Indeed',
        'LinkedIn',
        'Glassdoor',
        'Jobs.bg',
        'AngelList',
        'Stack Overflow',
        'JobBoardFinder'
      ];

      for (const name of jobBoardNames) {
        expect(service.isValidCompanyName(name)).toBe(false);
        expect(service.isValidCompanyName(name.toLowerCase())).toBe(false);
        expect(service.isValidCompanyName(name.toUpperCase())).toBe(false);
      }
    });

    it('should reject partial matches of job board names', () => {
      expect(service.isValidCompanyName('dev.bg jobs')).toBe(false);
      expect(service.isValidCompanyName('Indeed Company')).toBe(false);
      expect(service.isValidCompanyName('LinkedIn Corp')).toBe(false);
      expect(service.isValidCompanyName('Jobs.bg Bulgaria')).toBe(false);
    });

    it('should accept valid company names', () => {
      const validNames = [
        'TechnoLogica',
        'Recruitment.bg',
        'Gamito',
        'Google',
        'Microsoft',
        'Apple',
        'Tesla',
        'Uber',
        'Netflix'
      ];

      for (const name of validNames) {
        expect(service.isValidCompanyName(name)).toBe(true);
      }
    });

    it('should reject empty or null names', () => {
      expect(service.isValidCompanyName('')).toBe(false);
      expect(service.isValidCompanyName('   ')).toBe(false);
      expect(service.isValidCompanyName(null)).toBe(false);
      expect(service.isValidCompanyName(undefined)).toBe(false);
    });

    it('should log warnings when rejecting job board names', () => {
      service.isValidCompanyName('DEV.BG');
      expect(loggerSpy).toHaveBeenCalledWith('Rejected job board name as company: DEV.BG');
    });
  });

  describe('isValidCompanyUrl', () => {
    it('should reject job board URLs', () => {
      const jobBoardUrls = [
        'https://dev.bg/company/',
        'https://indeed.com/company/test',
        'https://linkedin.com/company/test',
        'https://glassdoor.com/company/test',
        'https://jobboardfinder.com/jobboard-devbg-bulgaria'
      ];

      for (const url of jobBoardUrls) {
        expect(service.isValidCompanyUrl(url)).toBe(false);
      }
    });

    it('should reject generic dev.bg company URLs without specific company identifier', () => {
      expect(service.isValidCompanyUrl('https://dev.bg/company/')).toBe(false);
      expect(service.isValidCompanyUrl('https://dev.bg/company')).toBe(false);
    });

    it('should accept specific dev.bg company URLs', () => {
      expect(service.isValidCompanyUrl('https://dev.bg/company/technologica/')).toBe(true);
      expect(service.isValidCompanyUrl('https://dev.bg/company/recruitment-bg/')).toBe(true);
    });

    it('should accept valid company websites', () => {
      const validUrls = [
        'https://google.com',
        'https://www.microsoft.com',
        'https://apple.com/about',
        'https://technologica.com',
        'http://www.technologica.com'
      ];

      for (const url of validUrls) {
        expect(service.isValidCompanyUrl(url)).toBe(true);
      }
    });

    it('should reject invalid URL formats', () => {
      expect(service.isValidCompanyUrl('not-a-url')).toBe(false);
      expect(service.isValidCompanyUrl('ftp://example.com')).toBe(false);
      expect(service.isValidCompanyUrl('')).toBe(false);
      expect(service.isValidCompanyUrl(null)).toBe(false);
      expect(service.isValidCompanyUrl(undefined)).toBe(false);
    });

    it('should log warnings when rejecting URLs', () => {
      service.isValidCompanyUrl('https://dev.bg/company/');
      expect(loggerSpy).toHaveBeenCalledWith('Rejected generic dev.bg company URL: https://dev.bg/company/');

      service.isValidCompanyUrl('https://indeed.com/company/test');
      expect(loggerSpy).toHaveBeenCalledWith('Rejected job board URL as company website: https://indeed.com/company/test');

      service.isValidCompanyUrl('not-a-url');
      expect(loggerSpy).toHaveBeenCalledWith('Invalid URL format: not-a-url');
    });
  });

  describe('shouldUpdateCompanyName', () => {
    it('should not update when new name is invalid', () => {
      expect(service.shouldUpdateCompanyName('TechnoLogica', 'DEV.BG')).toBe(false);
      expect(service.shouldUpdateCompanyName('', 'Indeed')).toBe(false);
      expect(service.shouldUpdateCompanyName(null, 'LinkedIn')).toBe(false);
    });

    it('should update when existing name is empty and new name is valid', () => {
      expect(service.shouldUpdateCompanyName('', 'TechnoLogica')).toBe(true);
      expect(service.shouldUpdateCompanyName(null, 'Google')).toBe(true);
      expect(service.shouldUpdateCompanyName(undefined, 'Microsoft')).toBe(true);
      expect(service.shouldUpdateCompanyName('   ', 'Apple')).toBe(true);
    });

    it('should update when existing name is invalid and new name is valid', () => {
      expect(service.shouldUpdateCompanyName('DEV.BG', 'TechnoLogica')).toBe(true);
      expect(service.shouldUpdateCompanyName('Indeed', 'Google')).toBe(true);
      expect(service.shouldUpdateCompanyName('LinkedIn', 'Microsoft')).toBe(true);
    });

    it('should not update when both names are valid', () => {
      expect(service.shouldUpdateCompanyName('TechnoLogica', 'Google')).toBe(false);
      expect(service.shouldUpdateCompanyName('Microsoft', 'Apple')).toBe(false);
      expect(service.shouldUpdateCompanyName('Existing Company', 'New Company')).toBe(false);
    });

    it('should log appropriate messages', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      service.shouldUpdateCompanyName('DEV.BG', 'TechnoLogica');
      expect(logSpy).toHaveBeenCalledWith('Replacing invalid company name "DEV.BG" with "TechnoLogica"');

      service.shouldUpdateCompanyName('TechnoLogica', 'Google');
      expect(logSpy).toHaveBeenCalledWith('Keeping existing company name "TechnoLogica" instead of "Google"');

      logSpy.mockRestore();
    });
  });

  describe('sanitizeCompanyData', () => {
    it('should remove invalid company names', () => {
      const data = {
        name: 'DEV.BG',
        description: 'A tech company',
        industry: 'Technology'
      };

      const sanitized = service.sanitizeCompanyData(data);

      expect(sanitized).toEqual({
        description: 'A tech company',
        industry: 'Technology'
      });
      expect(sanitized.name).toBeUndefined();
    });

    it('should remove invalid website URLs', () => {
      const data = {
        name: 'TechnoLogica',
        website: 'https://jobboardfinder.com/jobboard-devbg-bulgaria',
        description: 'A tech company'
      };

      const sanitized = service.sanitizeCompanyData(data);

      expect(sanitized).toEqual({
        name: 'TechnoLogica',
        description: 'A tech company'
      });
      expect(sanitized.website).toBeUndefined();
    });

    it('should preserve valid data', () => {
      const data = {
        name: 'TechnoLogica',
        website: 'https://technologica.com',
        description: 'A tech company',
        industry: 'Technology'
      };

      const sanitized = service.sanitizeCompanyData(data);

      expect(sanitized).toEqual(data);
    });

    it('should handle empty data', () => {
      const data = {};
      const sanitized = service.sanitizeCompanyData(data);
      expect(sanitized).toEqual({});
    });
  });

  describe('addJobBoardName and addJobBoardDomain', () => {
    it('should add new job board names to blacklist', () => {
      const testName = 'TestJobBoard';
      service.addJobBoardName(testName);

      expect(service.isValidCompanyName(testName)).toBe(false);
    });

    it('should add new job board domains to blacklist', () => {
      const testDomain = 'testjobboard.com';
      service.addJobBoardDomain(testDomain);

      expect(service.isValidCompanyUrl(`https://${testDomain}/company/test`)).toBe(false);
    });

    it('should not add duplicate job board names', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      
      service.addJobBoardName('DEV.BG');
      expect(logSpy).not.toHaveBeenCalled();

      service.addJobBoardName('NewJobBoard');
      expect(logSpy).toHaveBeenCalledWith('Added job board name to blacklist: NewJobBoard');

      logSpy.mockRestore();
    });

    it('should not add duplicate job board domains', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      
      service.addJobBoardDomain('dev.bg');
      expect(logSpy).not.toHaveBeenCalled();

      service.addJobBoardDomain('newjobboard.com');
      expect(logSpy).toHaveBeenCalledWith('Added job board domain to blacklist: newjobboard.com');

      logSpy.mockRestore();
    });
  });
});