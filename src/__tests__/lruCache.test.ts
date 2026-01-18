import { test, expect } from 'vitest';
import { LruCache } from '../utils/lruCache';

test('LruCache evicts oldest when over capacity', () => {
  const cache = new LruCache<string, number>(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  expect(cache.get('a')).toBeUndefined();
  expect(cache.get('b')).toBe(2);
  expect(cache.get('c')).toBe(3);
});

test('LruCache honors TTL', async () => {
  const cache = new LruCache<string, number>(2, 10);
  cache.set('a', 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(cache.get('a')).toBeUndefined();
});
