import { TranslationService } from '../../../src/modules/scraper/services/translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
  });

  describe('translateLocation', () => {
    it('should translate Bulgarian cities to English', () => {
      expect(service.translateLocation('София')).toBe('Sofia');
      expect(service.translateLocation('Пловдив')).toBe('Plovdiv');
      expect(service.translateLocation('Варна')).toBe('Varna');
    });

    it('should return original location for unknown cities', () => {
      expect(service.translateLocation('Unknown City')).toBe('Unknown City');
    });

    it('should handle work model locations', () => {
      expect(service.translateLocation('Дистанционно')).toBe('Remote');
      expect(service.translateLocation('Хибридно')).toBe('Hybrid');
    });
  });

  describe('translateWorkModel', () => {
    it('should translate Bulgarian work models to English', () => {
      expect(service.translateWorkModel('Дистанционно')).toBe('remote');
      expect(service.translateWorkModel('Хибридно')).toBe('hybrid');
      expect(service.translateWorkModel('В офиса')).toBe('on-site');
    });

    it('should translate English work models to standardized terms', () => {
      expect(service.translateWorkModel('Remote')).toBe('remote');
      expect(service.translateWorkModel('Hybrid')).toBe('hybrid');
      expect(service.translateWorkModel('On-site')).toBe('on-site');
    });

    it('should return default for unknown work models', () => {
      expect(service.translateWorkModel('Unknown')).toBe('on-site');
    });
  });

  describe('translateJobTerms', () => {
    it('should translate job titles from Bulgarian to English', () => {
      expect(service.translateJobTerms('Старши Разработчик')).toBe('Senior Developer');
      expect(service.translateJobTerms('Младши Програмист')).toBe('Junior Programmer');
    });

    it('should handle multiple translations in one text', () => {
      const result = service.translateJobTerms('Старши Бекенд Разработчик');
      expect(result).toContain('Senior');
      expect(result).toContain('Backend');
      expect(result).toContain('Developer');
    });

    it('should be case insensitive', () => {
      expect(service.translateJobTerms('старши разработчик')).toBe('Senior Developer');
    });
  });

  describe('parseBulgarianDate', () => {
    it('should parse Bulgarian date format correctly', () => {
      const result = service.parseBulgarianDate('15 януари');
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0); // January = 0
      expect(result.getFullYear()).toBe(new Date().getFullYear());
    });

    it('should handle different months', () => {
      const march = service.parseBulgarianDate('10 март');
      expect(march.getMonth()).toBe(2); // March = 2

      const december = service.parseBulgarianDate('25 декември');
      expect(december.getMonth()).toBe(11); // December = 11
    });

    it('should return current date for invalid format', () => {
      const result = service.parseBulgarianDate('invalid date');
      const now = new Date();
      expect(result.getDate()).toBe(now.getDate());
    });
  });

  describe('parseWorkModelFromBadge', () => {
    it('should detect remote work from badge text', () => {
      expect(service.parseWorkModelFromBadge('Sofia Remote')).toBe('remote');
      expect(service.parseWorkModelFromBadge('Дистанционно работа')).toBe('remote');
    });

    it('should detect hybrid work from badge text', () => {
      expect(service.parseWorkModelFromBadge('Sofia Hybrid')).toBe('hybrid');
      expect(service.parseWorkModelFromBadge('Хибридно работа')).toBe('hybrid');
    });

    it('should default to on-site', () => {
      expect(service.parseWorkModelFromBadge('Sofia Office')).toBe('on-site');
      expect(service.parseWorkModelFromBadge('Just Sofia')).toBe('on-site');
    });
  });

  describe('parseLocationFromBadge', () => {
    it('should extract location from first line of badge text', () => {
      const badgeText = 'София\nДистанционно\nДруга информация';
      expect(service.parseLocationFromBadge(badgeText)).toBe('Sofia');
    });

    it('should handle single line badge text', () => {
      expect(service.parseLocationFromBadge('Пловдив')).toBe('Plovdiv');
    });

    it('should return default for empty badge text', () => {
      expect(service.parseLocationFromBadge('')).toBe('Bulgaria');
      expect(service.parseLocationFromBadge('   ')).toBe('Bulgaria');
    });

    it('should trim whitespace from location', () => {
      expect(service.parseLocationFromBadge('  София  ')).toBe('Sofia');
    });
  });
});