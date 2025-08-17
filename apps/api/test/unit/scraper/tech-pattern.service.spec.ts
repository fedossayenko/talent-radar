import { TechPatternService } from '../../../src/modules/scraper/services/tech-pattern.service';

describe('TechPatternService', () => {
  let service: TechPatternService;

  beforeEach(() => {
    service = new TechPatternService();
  });

  describe('extractTechnologiesFromText', () => {
    it('should extract Java technologies from job text', () => {
      const jobText = 'We are looking for a Java developer with Spring Boot and Maven experience';
      const technologies = service.extractTechnologiesFromText(jobText);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring');
      expect(technologies).toContain('maven');
    });

    it('should extract database technologies', () => {
      const jobText = 'Experience with MySQL, PostgreSQL and MongoDB required';
      const technologies = service.extractTechnologiesFromText(jobText);
      
      expect(technologies).toContain('mysql');
      expect(technologies).toContain('postgresql');
      expect(technologies).toContain('mongodb');
    });

    it('should extract DevOps tools', () => {
      const jobText = 'Knowledge of Docker, Kubernetes and AWS is preferred';
      const technologies = service.extractTechnologiesFromText(jobText);
      
      expect(technologies).toContain('docker');
      expect(technologies).toContain('kubernetes');
      expect(technologies).toContain('aws');
    });

    it('should be case insensitive', () => {
      const jobText = 'JAVA, Spring, REACT experience needed';
      const technologies = service.extractTechnologiesFromText(jobText);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring');
      expect(technologies).toContain('react');
    });

    it('should merge with existing technologies', () => {
      const jobText = 'Java and Spring experience';
      const existingTechs = ['python', 'django'];
      const technologies = service.extractTechnologiesFromText(jobText, existingTechs);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring');
      expect(technologies).toContain('python');
      expect(technologies).toContain('django');
    });

    it('should handle special patterns like node.js', () => {
      const jobText = 'Experience with Node.js and TypeScript';
      const technologies = service.extractTechnologiesFromText(jobText);
      
      expect(technologies).toContain('node');
      expect(technologies).toContain('typescript');
    });
  });

  describe('extractTechnologiesFromImageTitles', () => {
    it('should extract and normalize technology names from image titles', () => {
      const imageTitles = ['Java', 'Spring Boot', 'MySQL'];
      const technologies = service.extractTechnologiesFromImageTitles(imageTitles);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring boot');
      expect(technologies).toContain('mysql');
    });

    it('should handle empty and whitespace titles', () => {
      const imageTitles = ['Java', '', '  ', 'Spring'];
      const technologies = service.extractTechnologiesFromImageTitles(imageTitles);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring');
      expect(technologies).not.toContain('');
      expect(technologies).not.toContain('  ');
    });

    it('should trim whitespace from titles', () => {
      const imageTitles = ['  Java  ', ' Spring Boot '];
      const technologies = service.extractTechnologiesFromImageTitles(imageTitles);
      
      expect(technologies).toContain('java');
      expect(technologies).toContain('spring boot');
    });
  });

  describe('combineTechnologies', () => {
    it('should combine technologies from multiple sources', () => {
      const textTechs = ['java', 'spring'];
      const imageTechs = ['mysql', 'docker'];
      const combined = service.combineTechnologies(textTechs, imageTechs);
      
      expect(combined).toContain('java');
      expect(combined).toContain('spring');
      expect(combined).toContain('mysql');
      expect(combined).toContain('docker');
    });

    it('should deduplicate technologies', () => {
      const textTechs = ['java', 'spring', 'mysql'];
      const imageTechs = ['spring', 'mysql', 'docker'];
      const combined = service.combineTechnologies(textTechs, imageTechs);
      
      expect(combined.filter(tech => tech === 'spring')).toHaveLength(1);
      expect(combined.filter(tech => tech === 'mysql')).toHaveLength(1);
    });

    it('should return sorted array', () => {
      const textTechs = ['spring', 'java'];
      const imageTechs = ['docker', 'aws'];
      const combined = service.combineTechnologies(textTechs, imageTechs);
      
      expect(combined).toEqual(combined.slice().sort());
    });
  });

  describe('categorizeTechnologies', () => {
    it('should categorize technologies correctly', () => {
      const technologies = ['java', 'spring', 'react', 'mysql', 'docker'];
      const categorized = service.categorizeTechnologies(technologies);
      
      expect(categorized.backend).toContain('java');
      expect(categorized.backend).toContain('spring');
      expect(categorized.frontend).toContain('react');
      expect(categorized.database).toContain('mysql');
      expect(categorized.devops).toContain('docker');
    });

    it('should handle uncategorized technologies', () => {
      const technologies = ['java', 'unknowntech', 'customtool'];
      const categorized = service.categorizeTechnologies(technologies);
      
      expect(categorized.backend).toContain('java');
      expect(categorized.other).toContain('unknowntech');
      expect(categorized.other).toContain('customtool');
    });

    it('should not include empty categories', () => {
      const technologies = ['java', 'spring'];
      const categorized = service.categorizeTechnologies(technologies);
      
      expect(categorized.backend).toBeDefined();
      expect(categorized.frontend).toBeUndefined();
      expect(categorized.messaging).toBeUndefined();
    });
  });

  describe('pattern management', () => {
    it('should return available patterns', () => {
      const patterns = service.getAvailablePatterns();
      
      expect(patterns).toContain('java');
      expect(patterns).toContain('spring');
      expect(patterns).toContain('react');
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should add new tech patterns', () => {
      const newPattern = /kotlin/gi;
      service.addTechPattern('kotlin', newPattern);
      
      const patterns = service.getAvailablePatterns();
      expect(patterns).toContain('kotlin');
      
      // Test that new pattern works
      const jobText = 'Kotlin experience required';
      const technologies = service.extractTechnologiesFromText(jobText);
      expect(technologies).toContain('kotlin');
    });

    it('should remove tech patterns', () => {
      const removed = service.removeTechPattern('java');
      expect(removed).toBe(true);
      
      const patterns = service.getAvailablePatterns();
      expect(patterns).not.toContain('java');
      
      // Test that removed pattern no longer works
      const jobText = 'Java experience required';
      const technologies = service.extractTechnologiesFromText(jobText);
      expect(technologies).not.toContain('java');
    });

    it('should return false when removing non-existent pattern', () => {
      const removed = service.removeTechPattern('nonexistent');
      expect(removed).toBe(false);
    });
  });
});