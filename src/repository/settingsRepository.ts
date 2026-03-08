import { Settings } from '../models';
import { getDb } from './dbManager';

export class SettingsRepository {
  private db: any;

  constructor(dbPath: string) {
    this.db = getDb(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  get(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : undefined;
  }

  set(key: string, value: string) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  remove(key: string) {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const result: Record<string, string> = {};
    for (const row of rows as any[]) {
      result[row.key] = row.value;
    }
    return result;
  }

  getSettings(): Settings {
    const all = this.getAll();
    return {
      latex_path: all['latex_path'],
      use_embedded_latex: all['use_embedded_latex'] === 'true',
      ai_provider: all['ai_provider'],
      ai_api_key_encrypted: all['ai_api_key_encrypted'],
      language: all['language'] || 'en',
    };
  }

  saveSettings(settings: Settings) {
    if (settings.latex_path !== undefined) this.set('latex_path', settings.latex_path || '');
    if (settings.use_embedded_latex !== undefined) this.set('use_embedded_latex', String(settings.use_embedded_latex));
    if (settings.ai_provider !== undefined) this.set('ai_provider', settings.ai_provider || '');
    if (settings.ai_api_key_encrypted !== undefined) this.set('ai_api_key_encrypted', settings.ai_api_key_encrypted || '');
    if (settings.language !== undefined) this.set('language', settings.language || 'en');
  }
}
