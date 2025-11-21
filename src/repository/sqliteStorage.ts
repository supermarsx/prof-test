import fs from 'fs';
import path from 'path';
import { Question } from '../models';
import { StorageBackend } from './storage';

export class SqliteStorage implements StorageBackend {
  private dbPath: string;
  private db: any;

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
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
    `);
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
