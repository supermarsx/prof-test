import { describe, test, expect, beforeEach } from 'vitest';
import { CacheRegistry } from '../utils/cacheRegistry';

describe('CacheRegistry', () => {
  let registry: CacheRegistry;

  beforeEach(() => {
    registry = new CacheRegistry();
  });

  /* ---------------------------------------------------------------- */
  /*  getCache — LRU cache registration & retrieval                    */
  /* ---------------------------------------------------------------- */

  describe('getCache', () => {
    test('creates and returns a new LruCache', () => {
      const cache = registry.getCache<string, number>('counter', { maxSize: 10 });
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    test('returns the same cache instance on repeated calls with the same name', () => {
      const first = registry.getCache<string, number>('c1', { maxSize: 5 });
      const second = registry.getCache<string, number>('c1', { maxSize: 100 });
      expect(first).toBe(second);
    });

    test('returns different caches for different names', () => {
      const a = registry.getCache<string, number>('a', { maxSize: 5 });
      const b = registry.getCache<string, number>('b', { maxSize: 5 });
      expect(a).not.toBe(b);
    });

    test('cache supports basic get/set operations', () => {
      const cache = registry.getCache<string, string>('kv', { maxSize: 10 });
      cache.set('hello', 'world');
      expect(cache.get('hello')).toBe('world');
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('cache with TTL expires entries', async () => {
      const cache = registry.getCache<string, string>('ttl', { maxSize: 10, ttlMs: 50 });
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
      await new Promise((r) => setTimeout(r, 80));
      expect(cache.get('key')).toBeUndefined();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getSizedCache — size-aware LRU cache                             */
  /* ---------------------------------------------------------------- */

  describe('getSizedCache', () => {
    const sizeOf = (v: string) => v.length;

    test('creates and returns a new SizeLruCache', () => {
      const cache = registry.getSizedCache<string, string>('sized', { maxSize: 100 }, sizeOf);
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    test('returns the same cache instance on repeated calls with the same name', () => {
      const first = registry.getSizedCache<string, string>('s1', { maxSize: 100 }, sizeOf);
      const second = registry.getSizedCache<string, string>('s1', { maxSize: 200 }, sizeOf);
      expect(first).toBe(second);
    });

    test('returns different caches for different names', () => {
      const a = registry.getSizedCache<string, string>('sa', { maxSize: 100 }, sizeOf);
      const b = registry.getSizedCache<string, string>('sb', { maxSize: 100 }, sizeOf);
      expect(a).not.toBe(b);
    });

    test('sized cache supports basic get/set operations', () => {
      const cache = registry.getSizedCache<string, string>('kv-sized', { maxSize: 100 }, sizeOf);
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
      expect(cache.get('missing')).toBeUndefined();
    });

    test('throws when maxSize is 0', () => {
      // maxSize 0 is falsy, so getSizedCache should throw
      expect(() =>
        registry.getSizedCache<string, string>('bad', { maxSize: 0 }, sizeOf),
      ).toThrow('maxSize is required');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  clear                                                            */
  /* ---------------------------------------------------------------- */

  describe('clear', () => {
    test('clears a specific named LRU cache', () => {
      const cache = registry.getCache<string, string>('c1', { maxSize: 10 });
      cache.set('a', '1');
      cache.set('b', '2');
      registry.clear('c1');
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });

    test('clears a specific named sized cache', () => {
      const sizeOf = (v: string) => v.length;
      const cache = registry.getSizedCache<string, string>('sc1', { maxSize: 100 }, sizeOf);
      cache.set('x', 'hello');
      registry.clear('sc1');
      expect(cache.get('x')).toBeUndefined();
    });

    test('clearing a nonexistent name does not throw', () => {
      expect(() => registry.clear('nonexistent')).not.toThrow();
    });

    test('clears all caches when no name is provided', () => {
      const c1 = registry.getCache<string, string>('c1', { maxSize: 10 });
      const c2 = registry.getCache<string, string>('c2', { maxSize: 10 });
      const sizeOf = (v: string) => v.length;
      const sc1 = registry.getSizedCache<string, string>('sc1', { maxSize: 100 }, sizeOf);

      c1.set('a', '1');
      c2.set('b', '2');
      sc1.set('c', 'three');

      registry.clear(); // no name → clear all

      expect(c1.get('a')).toBeUndefined();
      expect(c2.get('b')).toBeUndefined();
      expect(sc1.get('c')).toBeUndefined();
    });

    test('clearing one cache does not affect others', () => {
      const c1 = registry.getCache<string, string>('c1', { maxSize: 10 });
      const c2 = registry.getCache<string, string>('c2', { maxSize: 10 });
      c1.set('a', '1');
      c2.set('b', '2');

      registry.clear('c1');

      expect(c1.get('a')).toBeUndefined();
      expect(c2.get('b')).toBe('2'); // untouched
    });
  });
});
