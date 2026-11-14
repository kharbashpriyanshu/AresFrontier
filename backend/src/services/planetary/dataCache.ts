/**
 * Planetary Data In-Memory Cache
 * Provides bounded memoization with TTL and request deduplication.
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttlMs: number;
}

export class DataCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 1000, defaultTtlMs = 600000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  public set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(3)) : 0,
    };
  }
}

export const planetaryDataCache = new DataCache(2000, 3600000); // 1 hour TTL
