import { SalaryUtils } from '../../../src/modules/scraper/utils/salary.utils';

describe('SalaryUtils', () => {
  let salaryUtils: SalaryUtils;

  beforeEach(() => {
    salaryUtils = new SalaryUtils();
  });

  describe('parseSalaryRange', () => {
    it('should parse single salary value', () => {
      const result = salaryUtils.parseSalaryRange('2000');
      
      expect(result).toEqual({
        min: 200000, // 2000 * 100 (cents)
        max: 200000,
        currency: undefined,
        isRange: false,
      });
    });

    it('should parse salary range with two values', () => {
      const result = salaryUtils.parseSalaryRange('1500-2500');
      
      expect(result).toEqual({
        min: 150000, // 1500 * 100
        max: 250000, // 2500 * 100
        currency: undefined,
        isRange: true,
      });
    });

    it('should parse salary range with spaces and currency', () => {
      const result = salaryUtils.parseSalaryRange('1000 - 2000 лв');
      
      expect(result).toEqual({
        min: 100000,
        max: 200000,
        currency: 'BGN',
        isRange: true,
      });
    });

    it('should handle reversed order (max-min)', () => {
      const result = salaryUtils.parseSalaryRange('3000-2000');
      
      expect(result).toEqual({
        min: 200000, // Should be corrected to min
        max: 300000, // Should be corrected to max
        currency: undefined,
        isRange: true,
      });
    });

    it('should detect different currencies', () => {
      expect(salaryUtils.parseSalaryRange('1000€').currency).toBe('EUR');
      expect(salaryUtils.parseSalaryRange('1000 USD').currency).toBe('USD');
      expect(salaryUtils.parseSalaryRange('1000$').currency).toBe('USD');
      expect(salaryUtils.parseSalaryRange('1000£').currency).toBe('GBP');
    });

    it('should return null values for empty or invalid input', () => {
      expect(salaryUtils.parseSalaryRange('')).toEqual({
        min: null,
        max: null,
        isRange: false,
      });
      
      expect(salaryUtils.parseSalaryRange('No numbers here')).toEqual({
        min: null,
        max: null,
        isRange: false,
      });
      
      expect(salaryUtils.parseSalaryRange(undefined)).toEqual({
        min: null,
        max: null,
        isRange: false,
      });
    });

    it('should handle complex salary text', () => {
      const result = salaryUtils.parseSalaryRange('Заплата: 1200 - 1800 лева месечно');
      
      expect(result).toEqual({
        min: 120000,
        max: 180000,
        currency: 'BGN',
        isRange: true,
      });
    });
  });

  describe('parseSalaryMin', () => {
    it('should return minimum salary from range', () => {
      expect(salaryUtils.parseSalaryMin('1000-2000')).toBe(100000);
      expect(salaryUtils.parseSalaryMin('2500')).toBe(250000);
      expect(salaryUtils.parseSalaryMin('')).toBeNull();
    });
  });

  describe('parseSalaryMax', () => {
    it('should return maximum salary from range', () => {
      expect(salaryUtils.parseSalaryMax('1000-2000')).toBe(200000);
      expect(salaryUtils.parseSalaryMax('2500')).toBe(250000);
      expect(salaryUtils.parseSalaryMax('')).toBeNull();
    });
  });

  describe('formatSalaryRange', () => {
    it('should format single salary value', () => {
      const salaryRange = {
        min: 200000,
        max: 200000,
        currency: 'BGN',
        isRange: false,
      };
      
      expect(salaryUtils.formatSalaryRange(salaryRange)).toBe('2,000 BGN');
    });

    it('should format salary range', () => {
      const salaryRange = {
        min: 150000,
        max: 250000,
        currency: 'EUR',
        isRange: true,
      };
      
      expect(salaryUtils.formatSalaryRange(salaryRange)).toBe('1,500 - 2,500 EUR');
    });

    it('should handle no salary data', () => {
      const salaryRange = {
        min: null,
        max: null,
        isRange: false,
      };
      
      expect(salaryUtils.formatSalaryRange(salaryRange)).toBe('Not specified');
    });
  });

  describe('isValidSalaryRange', () => {
    it('should validate reasonable salary ranges', () => {
      const validRange = {
        min: 100000, // 1000 main units
        max: 200000, // 2000 main units
        isRange: true,
      };
      
      expect(salaryUtils.isValidSalaryRange(validRange)).toBe(true);
    });

    it('should reject invalid salary ranges', () => {
      const invalidRange = {
        min: null,
        max: null,
        isRange: false,
      };
      
      expect(salaryUtils.isValidSalaryRange(invalidRange)).toBe(false);
    });

    it('should reject unreasonably high salaries', () => {
      const tooHighRange = {
        min: 10000000000, // 100,000,000 main units
        max: 10000000000,
        isRange: false,
      };
      
      expect(salaryUtils.isValidSalaryRange(tooHighRange)).toBe(false);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of supported currencies', () => {
      const currencies = salaryUtils.getSupportedCurrencies();
      
      expect(currencies).toContain('BGN');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('USD');
      expect(currencies).toContain('GBP');
      expect(currencies.length).toBeGreaterThan(0);
    });
  });
});