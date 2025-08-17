import { Injectable } from '@nestjs/common';
import { DateUtils } from '../utils/date.utils';

/**
 * Service responsible for translating scraped data from Bulgarian to English
 * Uses Map data structures for O(1) lookup performance
 */
@Injectable()
export class TranslationService {
  constructor(private readonly dateUtils: DateUtils) {}
  private readonly locationMap = new Map<string, string>([
    ['София', 'Sofia'],
    ['Пловдив', 'Plovdiv'],
    ['Варна', 'Varna'],
    ['Бургас', 'Burgas'],
    ['Русе', 'Ruse'],
    ['Стара Загора', 'Stara Zagora'],
    ['Плевен', 'Pleven'],
    ['Дистанционно', 'Remote'],
    ['Хибридно', 'Hybrid'],
    ['Fully Remote', 'Remote'],
  ]);

  private readonly workModelMap = new Map<string, string>([
    ['Дистанционно', 'remote'],
    ['Хибридно', 'hybrid'],
    ['В офиса', 'on-site'],
    ['Remote', 'remote'],
    ['Hybrid', 'hybrid'],
    ['On-site', 'on-site'],
  ]);

  private readonly jobTermsMap = new Map<string, string>([
    ['Разработчик', 'Developer'],
    ['Програмист', 'Programmer'],
    ['Инженер', 'Engineer'],
    ['Старши', 'Senior'],
    ['Младши', 'Junior'],
    ['Лидер', 'Lead'],
    ['Архитект', 'Architect'],
    ['Бекенд', 'Backend'],
    ['Фронтенд', 'Frontend'],
    ['Фулстак', 'Full-stack'],
  ]);


  /**
   * Translates Bulgarian location names to English
   */
  translateLocation(location: string): string {
    return this.locationMap.get(location) || location;
  }

  /**
   * Translates work model from Bulgarian to standardized English terms
   */
  translateWorkModel(workModel: string): string {
    return this.workModelMap.get(workModel) || 'on-site';
  }

  /**
   * Translates common job-related terms from Bulgarian to English
   */
  translateJobTerms(text: string): string {
    let translatedText = text;
    
    for (const [bulgarian, english] of this.jobTermsMap) {
      translatedText = translatedText.replace(new RegExp(bulgarian, 'gi'), english);
    }
    
    return translatedText;
  }

  /**
   * Parses Bulgarian date strings to Date objects
   */
  parseBulgarianDate(dateStr: string): Date {
    return this.dateUtils.parseBulgarianDate(dateStr);
  }

  /**
   * Determines work model from badge text containing location and work type info
   */
  parseWorkModelFromBadge(badgeText: string): string {
    const badgeTextLower = badgeText.toLowerCase();
    
    if (badgeTextLower.includes('remote') || badgeTextLower.includes('дистанционно')) {
      return 'remote';
    } else if (badgeTextLower.includes('hybrid') || badgeTextLower.includes('хибридно')) {
      return 'hybrid';
    }
    
    return 'on-site';
  }

  /**
   * Extracts location from badge text (first line before work model indicators)
   */
  parseLocationFromBadge(badgeText: string): string {
    const lines = badgeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length > 0) {
      const location = lines[0];
      return this.translateLocation(location);
    }
    
    return 'Bulgaria'; // default fallback
  }
}