import fs from 'fs';
import path from 'path';
import { Question, UUID } from '../models';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(QUESTIONS_FILE)) fs.writeFileSync(QUESTIONS_FILE, '[]', 'utf8');
}

export class QuestionRepository {
  private filePath: string;

  constructor(filePath = QUESTIONS_FILE) {
    this.filePath = filePath;
    ensureDataDir();
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

  list(): Question[] {
    return this.readAll();
  }
  
  search(text: string): Question[] {
    const needle = text.trim().toLowerCase();
    if (!needle) return [];
    return this.readAll().filter((q) => {
      return (q.stem && q.stem.toLowerCase().includes(needle)) ||
        (q.topic && q.topic.toLowerCase().includes(needle)) ||
        (q.tags && q.tags.join(' ').toLowerCase().includes(needle));
    });
  }

  get(id: UUID): Question | undefined {
    return this.readAll().find((q) => q.id === id);
  }

  add(question: Question) {
    const all = this.readAll();
    all.push(question);
    this.writeAll(all);
  }

  update(id: UUID, patch: Partial<Question>) {
    const all = this.readAll();
    const idx = all.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Question not found');
    all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() };
    this.writeAll(all);
  }

  remove(id: UUID) {
    const all = this.readAll();
    const filtered = all.filter((q) => q.id !== id);
    this.writeAll(filtered);
  }
}
