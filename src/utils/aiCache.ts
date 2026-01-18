import { CacheRegistry } from './cacheRegistry';

const registry = new CacheRegistry();

export const aiCache = registry.getCache<string, any>('ai', {
  maxSize: 500,
  ttlMs: 10 * 60 * 1000,
});

export function clearAiCache() {
  registry.clear('ai');
}
