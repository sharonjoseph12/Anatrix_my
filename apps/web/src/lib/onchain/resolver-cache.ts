// ─── Resolver Cache ─────────────────────────────────────────────────────────
// 5-minute in-memory LRU cache for resolver responses

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get a cached resolver response.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Set a resolver response in cache with TTL.
 */
export function setCached<T>(key: string, value: T): void {
  // LRU eviction: if at capacity, remove oldest
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidateCached(key: string): void {
  cache.delete(key);
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  cache.clear();
}
