import { createHash } from 'crypto';

export interface ContentHashingOptions {
  url: string;
  content: string;
  useUrlHashing?: boolean;
  useContentHashing?: boolean;
  cleanBeforeHash?: boolean;
}

/**
 * Unified content hashing utility
 * 
 * Provides consistent SHA-256 hashing across the application using Node.js native crypto.
 * Replaces the inconsistent usage of crypto-js and native crypto in different services.
 */
export class HashingUtil {
  /**
   * Generate consistent SHA-256 hash for content caching
   * 
   * @param options Hashing configuration options
   * @returns SHA-256 hash as hex string
   */
  static generateContentHash(options: ContentHashingOptions): string {
    const { url, content, useUrlHashing = true, useContentHashing = true, cleanBeforeHash = true } = options;
    
    let hashInput = '';
    
    if (useUrlHashing) {
      // Extract meaningful parts of URL (remove query params, fragments)
      const cleanUrl = url.split('?')[0].split('#')[0];
      hashInput += cleanUrl;
    }
    
    if (useContentHashing) {
      let contentToHash = content;
      
      if (cleanBeforeHash) {
        // Basic content cleaning for hashing consistency
        contentToHash = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
          .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }
      
      hashInput += contentToHash;
    }
    
    // Use Node.js native crypto for consistent hashing
    return createHash('sha256').update(hashInput, 'utf8').digest('hex');
  }

  /**
   * Generate hash from content only (for simple content hashing)
   * 
   * @param content Content to hash
   * @param clean Whether to clean content before hashing
   * @returns SHA-256 hash as hex string
   */
  static generateSimpleContentHash(content: string, clean: boolean = false): string {
    let contentToHash = content;
    
    if (clean) {
      contentToHash = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return createHash('sha256').update(contentToHash, 'utf8').digest('hex');
  }

  /**
   * Generate hash from URL + content (for hybrid caching)
   * 
   * @param url Source URL
   * @param content Content to hash
   * @param cleanContent Whether to clean content before hashing
   * @returns SHA-256 hash as hex string
   */
  static generateHybridHash(url: string, content: string, cleanContent: boolean = true): string {
    return this.generateContentHash({
      url,
      content,
      useUrlHashing: true,
      useContentHashing: true,
      cleanBeforeHash: cleanContent,
    });
  }

  /**
   * Validate if a hash is a valid SHA-256 hex string
   * 
   * @param hash Hash string to validate
   * @returns True if valid SHA-256 hex string
   */
  static isValidSha256Hash(hash: string): boolean {
    return /^[a-f0-9]{64}$/i.test(hash);
  }

  /**
   * Generate cache key with prefix
   * 
   * @param prefix Cache key prefix
   * @param hash Content hash
   * @returns Formatted cache key
   */
  static generateCacheKey(prefix: string, hash: string): string {
    if (!this.isValidSha256Hash(hash)) {
      throw new Error(`Invalid SHA-256 hash: ${hash}`);
    }
    return `${prefix}:${hash}`;
  }
}