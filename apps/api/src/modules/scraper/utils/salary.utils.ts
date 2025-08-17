import { Injectable } from '@nestjs/common';

export interface SalaryRange {
  min: number | null;
  max: number | null;
  currency?: string;
  isRange: boolean;
}

/**
 * Utility service for salary parsing and processing
 * Parses salary ranges efficiently in a single pass
 */
@Injectable()
export class SalaryUtils {
  // Common currency patterns for future international support
  private readonly currencyPatterns = new Map<string, string>([
    ['лв', 'BGN'],
    ['лева', 'BGN'],
    ['bgn', 'BGN'],
    ['BGN', 'BGN'],
    ['€', 'EUR'],
    ['EUR', 'EUR'],
    ['$', 'USD'],
    ['USD', 'USD'],
    ['£', 'GBP'],
    ['GBP', 'GBP'],
  ]);

  /**
   * Parses salary range string and returns structured salary data
   * Handles various formats: "1000", "1000-2000", "1000 - 2000 лв", etc.
   */
  parseSalaryRange(salaryRange?: string): SalaryRange {
    if (!salaryRange || salaryRange.trim() === '') {
      return { min: null, max: null, isRange: false };
    }

    // Extract all numbers from the salary string
    const numbers = salaryRange.match(/(\d+)/g);
    
    if (!numbers || numbers.length === 0) {
      return { min: null, max: null, isRange: false };
    }

    // Detect currency
    const currency = this.detectCurrency(salaryRange);

    // Convert numbers to integers and multiply by 100 (convert to cents)
    const amounts = numbers.map(num => parseInt(num, 10) * 100);

    if (amounts.length === 1) {
      // Single salary value
      return {
        min: amounts[0],
        max: amounts[0],
        currency,
        isRange: false,
      };
    } else {
      // Multiple values - assume first is min, second is max
      return {
        min: Math.min(amounts[0], amounts[1]),
        max: Math.max(amounts[0], amounts[1]),
        currency,
        isRange: true,
      };
    }
  }

  /**
   * Parses salary range and returns only the minimum value (for backward compatibility)
   */
  parseSalaryMin(salaryRange?: string): number | null {
    const parsed = this.parseSalaryRange(salaryRange);
    return parsed.min;
  }

  /**
   * Parses salary range and returns only the maximum value (for backward compatibility)
   */
  parseSalaryMax(salaryRange?: string): number | null {
    const parsed = this.parseSalaryRange(salaryRange);
    return parsed.max;
  }

  /**
   * Detects currency from salary string
   */
  private detectCurrency(salaryText: string): string | undefined {
    const lowerText = salaryText.toLowerCase();
    
    for (const [symbol, code] of this.currencyPatterns) {
      if (lowerText.includes(symbol.toLowerCase())) {
        return code;
      }
    }
    
    return undefined;
  }

  /**
   * Formats salary range for display
   */
  formatSalaryRange(salaryRange: SalaryRange): string {
    if (!salaryRange.min && !salaryRange.max) {
      return 'Not specified';
    }

    const formatAmount = (amount: number | null): string => {
      if (!amount) return '0';
      return (amount / 100).toLocaleString(); // Convert from cents back to main units
    };

    const currency = salaryRange.currency ? ` ${salaryRange.currency}` : '';

    if (salaryRange.isRange && salaryRange.min !== salaryRange.max) {
      return `${formatAmount(salaryRange.min)} - ${formatAmount(salaryRange.max)}${currency}`;
    } else {
      return `${formatAmount(salaryRange.min)}${currency}`;
    }
  }

  /**
   * Validates if a salary range is reasonable
   */
  isValidSalaryRange(salaryRange: SalaryRange): boolean {
    if (!salaryRange.min) return false;
    
    // Basic validation: minimum salary should be positive and not unreasonably high
    const minInMainUnits = salaryRange.min / 100;
    const maxInMainUnits = salaryRange.max ? salaryRange.max / 100 : minInMainUnits;
    
    return minInMainUnits > 0 && 
           minInMainUnits <= 100000 && // Reasonable upper bound
           maxInMainUnits >= minInMainUnits;
  }

  /**
   * Gets available currency codes
   */
  getSupportedCurrencies(): string[] {
    return Array.from(new Set(this.currencyPatterns.values())).sort();
  }
}