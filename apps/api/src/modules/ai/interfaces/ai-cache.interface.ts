export interface IAiCacheService {
  getCachedResult(contentHash: string): Promise<any | null>;
  setCachedResult(contentHash: string, result: any, expiryHours?: number): Promise<void>;
  invalidateCache(pattern?: string): Promise<void>;
  getCacheStats(): Promise<{
    totalKeys: number;
    hitRate: number;
    memoryUsage: number;
  }>;
}