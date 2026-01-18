export class LruCache<K, V> {
  private maxSize: number;
  private ttlMs: number | null;
  private map: Map<K, { value: V; expiresAt: number | null }>;

  constructor(maxSize: number, ttlMs?: number) {
    this.maxSize = Math.max(1, maxSize);
    this.ttlMs = typeof ttlMs === 'number' ? ttlMs : null;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    const expiresAt = this.ttlMs !== null ? Date.now() + this.ttlMs : null;
    this.map.set(key, { value, expiresAt });
    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}
