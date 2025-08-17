import { ExperienceUtils } from '../../../src/modules/scraper/utils/experience.utils';

describe('ExperienceUtils', () => {
  let experienceUtils: ExperienceUtils;

  beforeEach(() => {
    experienceUtils = new ExperienceUtils();
  });

  describe('extractExperienceLevel', () => {
    describe('Senior level detection', () => {
      it('should detect senior level patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Senior Java Developer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Lead Frontend Engineer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Principal Software Architect')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Software Architect')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Expert Java Developer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Java Specialist')).toBe('senior');
      });

      it('should detect senior level with additional titles', () => {
        expect(experienceUtils.extractExperienceLevel('Head of Engineering')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Chief Technology Officer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Engineering Director')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Staff Software Engineer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Distinguished Engineer')).toBe('senior');
      });

      it('should be case insensitive', () => {
        expect(experienceUtils.extractExperienceLevel('SENIOR JAVA DEVELOPER')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('senior java developer')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Senior Java Developer')).toBe('senior');
      });
    });

    describe('Junior level detection', () => {
      it('should detect junior level patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Junior Java Developer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Graduate Software Engineer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Entry Level Developer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Software Engineering Intern')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Trainee Developer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Associate Developer')).toBe('junior');
      });

      it('should detect junior level with additional patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Starter Java Developer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Beginner Programmer')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Новак разработчик')).toBe('junior'); // Bulgarian
      });
    });

    describe('Mid level detection', () => {
      it('should detect mid level patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Mid-level Java Developer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Intermediate Software Engineer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Regular Developer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Standard Java Engineer')).toBe('mid');
      });

      it('should detect level indicators', () => {
        expect(experienceUtils.extractExperienceLevel('Software Engineer II')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Java Developer 2')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Level2 Engineer')).toBe('mid');
      });

      it('should default to mid level for unclear titles', () => {
        expect(experienceUtils.extractExperienceLevel('Java Developer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Software Engineer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Backend Developer')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Unclear Title')).toBe('mid');
      });
    });

    describe('Year-based experience detection', () => {
      it('should detect junior level from year patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Java Developer 0-2 years')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Software Engineer 1-3 years experience')).toBe('junior');
        expect(experienceUtils.extractExperienceLevel('Developer with 2 years')).toBe('junior');
      });

      it('should detect mid level from year patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Java Developer 3-5 years')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Software Engineer 4-6 years experience')).toBe('mid');
        expect(experienceUtils.extractExperienceLevel('Developer with 5 years')).toBe('mid');
      });

      it('should detect senior level from year patterns', () => {
        expect(experienceUtils.extractExperienceLevel('Java Developer 7+ years')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Software Engineer 8+ years experience')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Developer with 10+ years')).toBe('senior');
      });
    });

    describe('Priority handling', () => {
      it('should prioritize explicit titles over years', () => {
        expect(experienceUtils.extractExperienceLevel('Senior Java Developer 2 years')).toBe('senior');
        expect(experienceUtils.extractExperienceLevel('Junior Developer 8+ years')).toBe('junior');
      });
    });
  });

  describe('utility methods', () => {
    it('should get experience patterns', () => {
      const patterns = experienceUtils.getExperiencePatterns();
      
      expect(patterns.senior).toContain('senior');
      expect(patterns.senior).toContain('lead');
      expect(patterns.senior).toContain('architect');
      expect(patterns.junior).toContain('junior');
      expect(patterns.junior).toContain('graduate');
      expect(patterns.mid).toContain('mid');
      expect(patterns.mid).toContain('intermediate');
    });

    it('should validate experience levels', () => {
      expect(experienceUtils.isValidExperienceLevel('junior')).toBe(true);
      expect(experienceUtils.isValidExperienceLevel('mid')).toBe(true);
      expect(experienceUtils.isValidExperienceLevel('senior')).toBe(true);
      expect(experienceUtils.isValidExperienceLevel('invalid')).toBe(false);
      expect(experienceUtils.isValidExperienceLevel('')).toBe(false);
    });

    it('should get display names', () => {
      expect(experienceUtils.getExperienceLevelDisplayName('junior')).toBe('Junior Level');
      expect(experienceUtils.getExperienceLevelDisplayName('mid')).toBe('Mid Level');
      expect(experienceUtils.getExperienceLevelDisplayName('senior')).toBe('Senior Level');
    });

    it('should get numeric values for sorting', () => {
      expect(experienceUtils.getExperienceLevelValue('junior')).toBe(1);
      expect(experienceUtils.getExperienceLevelValue('mid')).toBe(2);
      expect(experienceUtils.getExperienceLevelValue('senior')).toBe(3);
    });

    it('should get pattern statistics', () => {
      const stats = experienceUtils.getPatternStats();
      
      expect(stats.junior).toBeGreaterThan(0);
      expect(stats.mid).toBeGreaterThan(0);
      expect(stats.senior).toBeGreaterThan(0);
      expect(typeof stats.junior).toBe('number');
      expect(typeof stats.mid).toBe('number');
      expect(typeof stats.senior).toBe('number');
    });
  });

  describe('pattern management', () => {
    it('should add custom patterns', () => {
      experienceUtils.addExperiencePattern('rockstar', 'senior');
      expect(experienceUtils.extractExperienceLevel('Rockstar Developer')).toBe('senior');
    });

    it('should remove patterns', () => {
      const removed = experienceUtils.removeExperiencePattern('senior');
      expect(removed).toBe(true);
      
      const removedAgain = experienceUtils.removeExperiencePattern('non-existent');
      expect(removedAgain).toBe(false);
    });
  });
});