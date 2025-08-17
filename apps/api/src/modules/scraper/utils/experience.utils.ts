import { Injectable } from '@nestjs/common';

export type ExperienceLevel = 'junior' | 'mid' | 'senior';

/**
 * Utility service for experience level detection and categorization
 * Uses efficient Map-based lookups instead of string operations
 */
@Injectable()
export class ExperienceUtils {
  // Experience level patterns organized by category for O(1) lookup
  private readonly experiencePatterns = new Map<string, ExperienceLevel>([
    // Senior level indicators
    ['senior', 'senior'],
    ['lead', 'senior'],
    ['principal', 'senior'],
    ['architect', 'senior'],
    ['expert', 'senior'],
    ['specialist', 'senior'],
    ['head', 'senior'],
    ['chief', 'senior'],
    ['director', 'senior'],
    ['staff', 'senior'],
    ['distinguished', 'senior'],
    
    // Junior level indicators
    ['junior', 'junior'],
    ['graduate', 'junior'],
    ['entry', 'junior'],
    ['intern', 'junior'],
    ['trainee', 'junior'],
    ['associate', 'junior'],
    ['starter', 'junior'],
    ['beginner', 'junior'],
    ['новак', 'junior'], // Bulgarian for beginner
    
    // Mid level indicators
    ['mid', 'mid'],
    ['intermediate', 'mid'],
    ['regular', 'mid'],
    ['standard', 'mid'],
    ['level2', 'mid'],
    ['ii', 'mid'], // Roman numeral 2
    ['2', 'mid'],
  ]);

  // Additional seniority indicators by years pattern (order matters - more specific patterns first)
  private readonly yearPatterns = new Map<RegExp, ExperienceLevel>([
    // Range patterns first (more specific)
    [/0[-\s]*2\s*years?/i, 'junior'],
    [/1[-\s]*3\s*years?/i, 'junior'],
    [/3[-\s]*5\s*years?/i, 'mid'],
    [/4[-\s]*6\s*years?/i, 'mid'],
    [/5[-\s]*7\s*years?/i, 'mid'],
    [/7\+\s*years?/i, 'senior'],
    [/8\+\s*years?/i, 'senior'],
    [/10\+\s*years?/i, 'senior'],
    // Single number patterns last (less specific)
    [/(?<!\d)[012]\s*years?(?!\d)/i, 'junior'],
    [/(?<!\d)[3456]\s*years?(?!\d)/i, 'mid'],
    [/(?<!\d)[789]\s*years?(?!\d)/i, 'senior'],
  ]);

  /**
   * Extracts experience level from job title using efficient Map lookup
   */
  extractExperienceLevel(title: string): ExperienceLevel {
    if (!title) {
      return 'mid'; // Default fallback
    }

    const titleLower = title.toLowerCase();
    
    // First, check for explicit experience patterns
    for (const [pattern, level] of this.experiencePatterns) {
      if (titleLower.includes(pattern)) {
        return level;
      }
    }

    // Then check for year-based patterns
    for (const [yearPattern, level] of this.yearPatterns) {
      if (yearPattern.test(titleLower)) {
        return level;
      }
    }

    // Default to mid-level if no specific indicators found
    return 'mid';
  }

  /**
   * Gets all available experience level patterns
   */
  getExperiencePatterns(): Record<ExperienceLevel, string[]> {
    const patterns: Record<ExperienceLevel, string[]> = {
      junior: [],
      mid: [],
      senior: [],
    };

    for (const [pattern, level] of this.experiencePatterns) {
      patterns[level].push(pattern);
    }

    return patterns;
  }

  /**
   * Validates if an experience level is valid
   */
  isValidExperienceLevel(level: string): level is ExperienceLevel {
    return ['junior', 'mid', 'senior'].includes(level);
  }

  /**
   * Gets experience level display name
   */
  getExperienceLevelDisplayName(level: ExperienceLevel): string {
    const displayNames: Record<ExperienceLevel, string> = {
      junior: 'Junior Level',
      mid: 'Mid Level',
      senior: 'Senior Level',
    };

    return displayNames[level];
  }

  /**
   * Gets experience level numeric value for sorting/comparison
   */
  getExperienceLevelValue(level: ExperienceLevel): number {
    const values: Record<ExperienceLevel, number> = {
      junior: 1,
      mid: 2,
      senior: 3,
    };

    return values[level];
  }

  /**
   * Adds a custom experience pattern
   */
  addExperiencePattern(pattern: string, level: ExperienceLevel): void {
    this.experiencePatterns.set(pattern.toLowerCase(), level);
  }

  /**
   * Removes an experience pattern
   */
  removeExperiencePattern(pattern: string): boolean {
    return this.experiencePatterns.delete(pattern.toLowerCase());
  }

  /**
   * Gets statistics about detected patterns
   */
  getPatternStats(): Record<ExperienceLevel, number> {
    const stats: Record<ExperienceLevel, number> = {
      junior: 0,
      mid: 0,
      senior: 0,
    };

    for (const level of this.experiencePatterns.values()) {
      stats[level]++;
    }

    return stats;
  }
}