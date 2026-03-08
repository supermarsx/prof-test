import { Question, UUID } from '../models';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { StorageBackend } from './storage';
import { SqliteStorage } from './sqliteStorage';
import { validateQuestion } from '../utils/validators';
import { SizeLruCache } from '../utils/sizeLruCache';
import { CacheRegistry } from '../utils/cacheRegistry';

export class QuestionRepository {
  private backend: StorageBackend;
  private cache: SizeLruCache<UUID, Question>;
  private cacheRegistry: CacheRegistry;

  constructor(filePath?: string, backend?: StorageBackend) {
    // allow injection of a custom backend for tests or JSON fallback
    if (backend) {
      this.backend = backend;
    } else {
      this.backend = new SqliteStorage(filePath);
    }
    this.cacheRegistry = new CacheRegistry();
    const namespace = filePath ? `questions:${path.basename(filePath)}` : 'questions:default';
    this.cache = this.cacheRegistry.getSizedCache<UUID, Question>(
      namespace,
      { maxSize: 100 * 1024 * 1024, ttlMs: 5 * 60 * 1000 },
      (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')
    );
  }

  list(): Question[] {
    const list = this.backend.listQuestions();
    for (const question of list) {
      this.cache.set(question.id, question);
    }
    return list;
  }
  
  search(text: string): Question[] {
    const needle = String(text || '').trim().toLowerCase();
    if (!needle) return [];
    return this.backend.listQuestions().filter((q) => {
      return (q.stem && q.stem.toLowerCase().includes(needle)) ||
        (q.subject && q.subject.toLowerCase().includes(needle)) ||
        (q.topic && q.topic.toLowerCase().includes(needle)) ||
        (q.subtopic && q.subtopic.toLowerCase().includes(needle)) ||
        (q.author && q.author.toLowerCase().includes(needle)) ||
        (q.tags && q.tags.join(' ').toLowerCase().includes(needle));
    });
  }

  get(id: UUID): Question | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const found = this.backend.getQuestion(id);
    if (found) this.cache.set(id, found);
    return found;
  }

  add(question: Question) {
    const errors = validateQuestion(question);
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
    const now = new Date().toISOString();
    const next = {
      ...question,
      created_at: question.created_at || now,
      updated_at: question.updated_at || now,
    } as Question;
    this.backend.addQuestion(next);
    this.cache.set(next.id, next);
  }

  update(id: UUID, patch: Partial<Question>) {
    const existing = this.backend.getQuestion(id);
    if (!existing) throw new Error('Question not found');
    const merged = { ...existing, ...patch } as Question;
    const errors = validateQuestion(merged);
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
    const now = new Date().toISOString();
    const next = { ...existing, ...patch, updated_at: now } as Question;
    this.backend.updateQuestion(id, next);
    this.cache.set(id, next);
  }

  remove(id: UUID) {
    this.backend.removeQuestion(id);
    this.cache.delete(id);
  }

  incrementUsage(id: UUID): void {
    const q = this.get(id);
    if (!q) return;
    const updated = {
      ...q,
      usage_count: (q.usage_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    };
    this.update(id, updated);
  }

  exportToJson(filePath: string) {
    const data = this.backend.listQuestions();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  importFromJson(filePath: string, mode: 'append' | 'replace' = 'append') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Question[];
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid JSON format: expected an array of questions');
    }
    if (mode === 'replace') {
      const existing = this.backend.listQuestions();
      for (const q of existing) {
        this.backend.removeQuestion(q.id);
        this.cache.delete(q.id);
      }
    }
    for (const q of parsed) {
      const errors = validateQuestion(q);
      if (errors.length) {
        throw new Error(`Invalid question ${q.id || '(missing id)'}: ${errors.join('; ')}`);
      }
      this.backend.addQuestion(q);
      this.cache.set(q.id, q);
    }
  }

  exportToYaml(filePath: string) {
    const data = this.backend.listQuestions();
    fs.writeFileSync(filePath, YAML.stringify(data), 'utf8');
    return filePath;
  }

  importFromYaml(filePath: string, mode: 'append' | 'replace' = 'append') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(raw) as Question[];
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid YAML format: expected an array of questions');
    }
    if (mode === 'replace') {
      const existing = this.backend.listQuestions();
      for (const q of existing) {
        this.backend.removeQuestion(q.id);
        this.cache.delete(q.id);
      }
    }
    for (const q of parsed) {
      const errors = validateQuestion(q);
      if (errors.length) {
        throw new Error(`Invalid question ${q.id || '(missing id)'}: ${errors.join('; ')}`);
      }
      this.backend.addQuestion(q);
      this.cache.set(q.id, q);
    }
  }
}
