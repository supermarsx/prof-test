import fs from 'fs';
import path from 'path';

// Shared DB connection manager to avoid multiple connections to same file
const connections = new Map<string, any>();

export function getDb(dbPath: string): any {
  const normalized = path.resolve(dbPath);
  const existing = connections.get(normalized);
  if (existing) return existing;
  
  const dir = path.dirname(normalized);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  let Database: any;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    throw new Error('better-sqlite3 is not available.');
  }
  
  const db = new Database(normalized);
  connections.set(normalized, db);
  return db;
}

export function closeDb(dbPath: string): void {
  const normalized = path.resolve(dbPath);
  const db = connections.get(normalized);
  if (db) {
    try { db.close(); } catch {}
    connections.delete(normalized);
  }
}

export function closeAll(): void {
  for (const [key, db] of connections) {
    try { db.close(); } catch {}
  }
  connections.clear();
}
