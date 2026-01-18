import fs from 'fs';
import path from 'path';
import { HeaderPreset, LayoutPreset } from '../models';

export class PresetRepository {
  private db: any;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS header_presets (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS layout_presets (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
    `);
  }

  listHeaderPresets(): HeaderPreset[] {
    const stmt = this.db.prepare('SELECT json FROM header_presets');
    return stmt.all().map((r: any) => JSON.parse(r.json) as HeaderPreset);
  }

  upsertHeaderPreset(preset: HeaderPreset) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO header_presets (id, json) VALUES (?, ?)');
    stmt.run(preset.id, JSON.stringify(preset));
  }

  removeHeaderPreset(id: string) {
    const stmt = this.db.prepare('DELETE FROM header_presets WHERE id = ?');
    stmt.run(id);
  }

  listLayoutPresets(): LayoutPreset[] {
    const stmt = this.db.prepare('SELECT json FROM layout_presets');
    return stmt.all().map((r: any) => JSON.parse(r.json) as LayoutPreset);
  }

  upsertLayoutPreset(preset: LayoutPreset) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO layout_presets (id, json) VALUES (?, ?)');
    stmt.run(preset.id, JSON.stringify(preset));
  }

  removeLayoutPreset(id: string) {
    const stmt = this.db.prepare('DELETE FROM layout_presets WHERE id = ?');
    stmt.run(id);
  }
}
