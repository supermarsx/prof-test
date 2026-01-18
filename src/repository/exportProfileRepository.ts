import fs from 'fs';
import path from 'path';
import { ExportProfile } from '../models';

export class ExportProfileRepository {
  private dbPath: string;
  private db: any;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS export_profiles (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
    `);
  }

  list(): ExportProfile[] {
    const stmt = this.db.prepare('SELECT json FROM export_profiles');
    return stmt.all().map((r: any) => JSON.parse(r.json) as ExportProfile);
  }

  get(id: string): ExportProfile | undefined {
    const stmt = this.db.prepare('SELECT json FROM export_profiles WHERE id = ?');
    const row = stmt.get(id);
    return row ? (JSON.parse(row.json) as ExportProfile) : undefined;
  }

  upsert(profile: ExportProfile) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO export_profiles (id, json) VALUES (?, ?)');
    stmt.run(profile.id, JSON.stringify(profile));
  }

  remove(id: string) {
    const stmt = this.db.prepare('DELETE FROM export_profiles WHERE id = ?');
    stmt.run(id);
  }
}
