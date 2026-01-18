export class SizeLruCache<K, V> {
  private maxBytes: number;
  private ttlMs: number | null;
  private sizeOf: (value: V) => number;
  private map: Map<K, { value: V; bytes: number; expiresAt: number | null }>;
  private currentBytes: number;

  constructor(maxBytes: number, sizeOf: (value: V) => number, ttlMs?: number) {
    this.maxBytes = Math.max(1, maxBytes);
    this.sizeOf = sizeOf;
    this.ttlMs = typeof ttlMs === 'number' ? ttlMs : null;
    this.map = new Map();
    this.currentBytes = 0;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V) {
    const bytes = this.sizeOf(value);
    if (bytes > this.maxBytes) {
      return;
    }
    if (this.map.has(key)) {
      this.delete(key);
    }
    while (this.currentBytes + bytes > this.maxBytes) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.delete(oldestKey);
    }
    const expiresAt = this.ttlMs !== null ? Date.now() + this.ttlMs : null;
    this.map.set(key, { value, bytes, expiresAt });
    this.currentBytes += bytes;
  }

  delete(key: K) {
    const entry = this.map.get(key);
    if (!entry) return;
    this.currentBytes -= entry.bytes;
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
    this.currentBytes = 0;
  }
}
