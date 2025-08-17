import { Injectable } from '@nestjs/common';

/**
 * Service responsible for technology pattern matching and detection
 * Pre-compiles regex patterns for optimal performance
 */
@Injectable()
export class TechPatternService {
  // Pre-compiled regex patterns for performance
  private readonly techPatterns = new Map<string, RegExp>([
    ['java', /java/gi],
    ['spring', /spring/gi],
    ['hibernate', /hibernate/gi],
    ['maven', /maven/gi],
    ['gradle', /gradle/gi],
    ['mysql', /mysql/gi],
    ['postgresql', /postgresql/gi],
    ['docker', /docker/gi],
    ['kubernetes', /kubernetes/gi],
    ['aws', /aws/gi],
    ['git', /git/gi],
    ['jenkins', /jenkins/gi],
    ['junit', /junit/gi],
    ['rest', /rest/gi],
    ['api', /api/gi],
    ['microservices', /microservices/gi],
    ['react', /react/gi],
    ['angular', /angular/gi],
    ['vue', /vue/gi],
    ['node', /node\.?js/gi],
    ['typescript', /typescript|ts/gi],
    ['javascript', /javascript|js/gi],
    ['python', /python/gi],
    ['django', /django/gi],
    ['flask', /flask/gi],
    ['mongodb', /mongodb|mongo/gi],
    ['redis', /redis/gi],
    ['elasticsearch', /elasticsearch|elastic/gi],
    ['kafka', /kafka/gi],
    ['rabbitmq', /rabbitmq|rabbit/gi],
  ]);

  // Technology categories for better organization
  private readonly techCategories = new Map<string, string[]>([
    ['backend', ['java', 'spring', 'hibernate', 'node', 'python', 'django', 'flask']],
    ['frontend', ['react', 'angular', 'vue', 'javascript', 'typescript']],
    ['database', ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch']],
    ['devops', ['docker', 'kubernetes', 'aws', 'jenkins', 'git']],
    ['messaging', ['kafka', 'rabbitmq']],
    ['testing', ['junit']],
    ['build', ['maven', 'gradle']],
  ]);

  /**
   * Extracts technologies from job text using pre-compiled patterns
   */
  extractTechnologiesFromText(jobText: string, existingTechs: string[] = []): string[] {
    const technologies = new Set<string>(existingTechs);

    for (const [techName, pattern] of this.techPatterns) {
      if (pattern.test(jobText)) {
        technologies.add(techName);
      }
    }

    return Array.from(technologies);
  }

  /**
   * Extracts technologies from image titles (from tech icons)
   */
  extractTechnologiesFromImageTitles(imageTitles: string[]): string[] {
    const technologies = new Set<string>();

    for (const title of imageTitles) {
      const normalizedTitle = title.toLowerCase().trim();
      if (normalizedTitle) {
        technologies.add(normalizedTitle);
      }
    }

    return Array.from(technologies);
  }

  /**
   * Combines technologies from multiple sources and deduplicates
   */
  combineTechnologies(textTechs: string[], imageTechs: string[]): string[] {
    const allTechs = new Set<string>();

    // Add technologies from text analysis
    textTechs.forEach(tech => allTechs.add(tech));
    
    // Add technologies from image titles
    imageTechs.forEach(tech => allTechs.add(tech));

    return Array.from(allTechs).sort();
  }

  /**
   * Categorizes technologies by their type (backend, frontend, etc.)
   */
  categorizeTechnologies(technologies: string[]): Record<string, string[]> {
    const categorized: Record<string, string[]> = {};

    for (const [category, techs] of this.techCategories) {
      const matchingTechs = technologies.filter(tech => techs.includes(tech));
      if (matchingTechs.length > 0) {
        categorized[category] = matchingTechs;
      }
    }

    // Add uncategorized technologies
    const categorizedTechs = new Set<string>();
    Object.values(categorized).forEach(techs => 
      techs.forEach(tech => categorizedTechs.add(tech))
    );

    const uncategorized = technologies.filter(tech => !categorizedTechs.has(tech));
    if (uncategorized.length > 0) {
      categorized['other'] = uncategorized;
    }

    return categorized;
  }

  /**
   * Gets all available technology patterns
   */
  getAvailablePatterns(): string[] {
    return Array.from(this.techPatterns.keys()).sort();
  }

  /**
   * Adds or updates a technology pattern
   */
  addTechPattern(name: string, pattern: RegExp): void {
    this.techPatterns.set(name.toLowerCase(), pattern);
  }

  /**
   * Removes a technology pattern
   */
  removeTechPattern(name: string): boolean {
    return this.techPatterns.delete(name.toLowerCase());
  }
}