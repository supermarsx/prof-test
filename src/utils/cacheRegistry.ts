import { LruCache } from './lruCache';

export interface CacheOptions {
  maxSize: number;
  ttlMs?: number;
}

export class CacheRegistry {
  private caches: Map<string, LruCache<any, any>>;

  constructor() {
    this.caches = new Map();
  }

  getCache<K, V>(name: string, options: CacheOptions): LruCache<K, V> {
    const existing = this.caches.get(name);
    if (existing) return existing as LruCache<K, V>;
    const cache = new LruCache<K, V>(options.maxSize, options.ttlMs);
    this.caches.set(name, cache);
    return cache;
  }

  clear(name?: string) {
    if (!name) {
      this.caches.forEach((cache) => cache.clear());
      return;
    }
    const cache = this.caches.get(name);
    if (cache) cache.clear();
  }
}
