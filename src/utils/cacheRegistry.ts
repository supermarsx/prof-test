import { LruCache } from './lruCache';
import { SizeLruCache } from './sizeLruCache';

export interface CacheOptions {
  maxSize: number;
  ttlMs?: number;
}

export class CacheRegistry {
  private caches: Map<string, LruCache<any, any>>;
  private sizedCaches: Map<string, SizeLruCache<any, any>>;

  constructor() {
    this.caches = new Map();
    this.sizedCaches = new Map();
  }

  getCache<K, V>(name: string, options: CacheOptions): LruCache<K, V> {
    const existing = this.caches.get(name);
    if (existing) return existing as LruCache<K, V>;
    const cache = new LruCache<K, V>(options.maxSize, options.ttlMs);
    this.caches.set(name, cache);
    return cache;
  }

  getSizedCache<K, V>(name: string, options: CacheOptions, sizeOf: (value: V) => number): SizeLruCache<K, V> {
    const existing = this.sizedCaches.get(name);
    if (existing) return existing as SizeLruCache<K, V>;
    if (!options.maxSize) {
      throw new Error('maxSize is required for sized caches');
    }
    const cache = new SizeLruCache<K, V>(options.maxSize, sizeOf, options.ttlMs);
    this.sizedCaches.set(name, cache);
    return cache;
  }

  clear(name?: string) {
    if (!name) {
      this.caches.forEach((cache) => cache.clear());
      this.sizedCaches.forEach((cache) => cache.clear());
      return;
    }
    const cache = this.caches.get(name);
    if (cache) cache.clear();
    const sized = this.sizedCaches.get(name);
    if (sized) sized.clear();
  }
}
