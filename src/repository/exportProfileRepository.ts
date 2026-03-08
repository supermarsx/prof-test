import { ExportProfile } from '../models';
import { getDb } from './dbManager';

export class ExportProfileRepository {
  private db: any;

  constructor(dbPath: string) {
    this.db = getDb(dbPath);
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
