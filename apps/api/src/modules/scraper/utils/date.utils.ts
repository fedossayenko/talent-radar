import { Injectable } from '@nestjs/common';

export interface BulgarianDateMatch {
  day: number;
  month: number;
  monthName: string;
  fullMatch: string;
}

/**
 * Utility service for Bulgarian date parsing and processing
 * Consolidates all date-related logic in one place
 */
@Injectable()
export class DateUtils {
  private readonly monthMap = new Map<string, number>([
    ['януари', 0],
    ['февруари', 1],
    ['март', 2],
    ['април', 3],
    ['май', 4],
    ['юни', 5],
    ['юли', 6],
    ['август', 7],
    ['септември', 8],
    ['октомври', 9],
    ['ноември', 10],
    ['декември', 11],
  ]);

  private readonly bulgarianDatePattern = /(\d{1,2})\s+(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)/i;

  /**
   * Finds Bulgarian date pattern in text and returns structured match data
   */
  findBulgarianDateInText(text: string): BulgarianDateMatch | null {
    const match = text.match(this.bulgarianDatePattern);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const month = this.monthMap.get(monthName);
      
      if (month !== undefined) {
        return {
          day,
          month,
          monthName,
          fullMatch: match[0],
        };
      }
    }
    
    return null;
  }

  /**
   * Parses Bulgarian date string into Date object
   * Falls back to current date if parsing fails
   */
  parseBulgarianDate(dateStr: string): Date {
    const dateMatch = this.findBulgarianDateInText(dateStr);
    
    if (dateMatch) {
      const year = new Date().getFullYear();
      return new Date(year, dateMatch.month, dateMatch.day);
    }
    
    return new Date(); // fallback to current date
  }

  /**
   * Searches for Bulgarian date patterns in text and returns the matched string
   * Legacy method for backward compatibility
   */
  findBulgarianDateString(text: string): string | null {
    const dateMatch = this.findBulgarianDateInText(text);
    return dateMatch ? dateMatch.fullMatch : null;
  }

  /**
   * Gets the month number (0-11) for a Bulgarian month name
   */
  getMonthNumber(bulgarianMonthName: string): number | undefined {
    return this.monthMap.get(bulgarianMonthName.toLowerCase());
  }

  /**
   * Gets all available Bulgarian month names
   */
  getBulgarianMonthNames(): string[] {
    return Array.from(this.monthMap.keys());
  }
}