import fs from 'fs';
import path from 'path';
import { Question } from '../models';

export interface StorageBackend {
  listQuestions(): Question[];
  getQuestion(id: string): Question | undefined;
  addQuestion(q: Question): void;
  updateQuestion(id: string, patch: Partial<Question>): void;
  removeQuestion(id: string): void;
}

// Simple JSON file-based storage backend (default)
export class JsonFileStorage implements StorageBackend {
  private filePath: string;

  constructor(filePath?: string) {
    const DATA_DIR = path.join(__dirname, '..', '..', 'data');
    const QUESTIONS_FILE = filePath || path.join(DATA_DIR, 'questions.json');
    this.filePath = QUESTIONS_FILE;
    this.ensureFile();
  }

  private ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '[]', 'utf8');
  }

  private readAll(): Question[] {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    try {
      const parsed = JSON.parse(raw) as Question[];
      return parsed;
    } catch (e) {
      throw new Error('Failed to parse questions.json: ' + String(e));
    }
  }

  private writeAll(questions: Question[]) {
    fs.writeFileSync(this.filePath, JSON.stringify(questions, null, 2), 'utf8');
  }

  listQuestions(): Question[] {
    return this.readAll();
  }

  getQuestion(id: string): Question | undefined {
    return this.readAll().find((q) => q.id === id);
  }

  addQuestion(q: Question) {
    const all = this.readAll();
    all.push(q);
    this.writeAll(all);
  }

  updateQuestion(id: string, patch: Partial<Question>) {
    const all = this.readAll();
    const idx = all.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Question not found');
    all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() } as Question;
    this.writeAll(all);
  }

  removeQuestion(id: string) {
    const all = this.readAll();
    const filtered = all.filter((q) => q.id !== id);
    this.writeAll(filtered);
  }
}
