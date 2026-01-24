import { test, expect } from 'vitest';
import { SizeLruCache } from '../utils/sizeLruCache';

test('SizeLruCache evicts when exceeding max bytes', () => {
  const cache = new SizeLruCache<string, string>(9, (v) => v.length);
  cache.set('a', '12345');
  cache.set('b', '67890');
  expect(cache.get('a')).toBeUndefined();
  expect(cache.get('b')).toBe('67890');
});

test('SizeLruCache respects TTL', async () => {
  const cache = new SizeLruCache<string, string>(100, (v) => v.length, 10);
  cache.set('a', '123');
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(cache.get('a')).toBeUndefined();
});
