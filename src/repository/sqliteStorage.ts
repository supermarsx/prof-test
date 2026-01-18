import fs from 'fs';
import path from 'path';
import { Question } from '../models';
import { StorageBackend } from './storage';

export class SqliteStorage implements StorageBackend {
  private dbPath: string;
  private db: any;
  private static readonly LATEST_SCHEMA_VERSION = 3;

  constructor(dbPath?: string) {
    const DATA_DIR = path.join(__dirname, '..', '..', 'data');
    this.dbPath = dbPath || path.join(DATA_DIR, 'questions.db');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // dynamic require to avoid ESM/static loader issues in test environments
    let Database: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Database = require('better-sqlite3');
    } catch (e) {
      throw new Error('better-sqlite3 is not available. Install it to use SqliteStorage.');
    }

    this.db = new Database(this.dbPath);
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const migrations: Array<{ version: number; up: () => void }> = [
      {
        version: 1,
        up: () => {
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS questions (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
          `);
        },
      },
      {
        version: 2,
        up: () => {
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS header_presets (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS layout_presets (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS test_templates (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS test_instances (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS export_profiles (
              id TEXT PRIMARY KEY,
              json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
          `);
        },
      },
      {
        version: 3,
        up: () => {
          const defaultHeaderPreset = {
            id: 'default-header',
            name: 'Default Header',
            scope: 'global',
            fields_config: {
              show_course: true,
              show_instructor: true,
              show_date: true,
              show_duration: true,
              student_name_line: true,
              student_id_line: true,
            },
          };

          const defaultLayoutPreset = {
            id: 'default-layout',
            name: 'Default Layout',
            page_margins: { top: 1, bottom: 1, left: 1, right: 1 },
            base_font_size: 12,
            line_spacing: 1.2,
            numbering_style: 'numeric',
            show_points_inline: true,
          };

          this.db
            .prepare('INSERT OR IGNORE INTO header_presets (id, json) VALUES (?, ?)')
            .run(defaultHeaderPreset.id, JSON.stringify(defaultHeaderPreset));
          this.db
            .prepare('INSERT OR IGNORE INTO layout_presets (id, json) VALUES (?, ?)')
            .run(defaultLayoutPreset.id, JSON.stringify(defaultLayoutPreset));

          const settings = [
            ['language', 'en'],
            ['use_embedded_latex', 'true'],
          ];
          const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
          for (const [key, value] of settings) {
            stmt.run(key, value);
          }
        },
      },
    ];

    let currentVersion = this.getSchemaVersion();
    for (const migration of migrations) {
      if (currentVersion < migration.version) {
        migration.up();
        this.setSchemaVersion(migration.version);
        currentVersion = migration.version;
      }
    }
  }

  private getSchemaVersion(): number {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
    if (!row) return 0;
    const parsed = Number(row.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private setSchemaVersion(version: number) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    stmt.run('schema_version', String(version));
  }

  listQuestions(): Question[] {
    const stmt = this.db.prepare('SELECT json FROM questions');
    return stmt.all().map((r: any) => JSON.parse(r.json) as Question);
  }

  getQuestion(id: string): Question | undefined {
    const stmt = this.db.prepare('SELECT json FROM questions WHERE id = ?');
    const row = stmt.get(id);
    return row ? (JSON.parse(row.json) as Question) : undefined;
  }

  addQuestion(q: Question) {
    const stmt = this.db.prepare('INSERT INTO questions (id, json) VALUES (?, ?)');
    stmt.run(q.id, JSON.stringify(q));
  }

  updateQuestion(id: string, patch: Partial<Question>) {
    const existing = this.getQuestion(id);
    if (!existing) throw new Error('Question not found');
    const merged = { ...existing, ...patch, updated_at: new Date().toISOString() } as Question;
    const stmt = this.db.prepare('UPDATE questions SET json = ? WHERE id = ?');
    stmt.run(JSON.stringify(merged), id);
  }

  removeQuestion(id: string) {
    const stmt = this.db.prepare('DELETE FROM questions WHERE id = ?');
    stmt.run(id);
  }
}
