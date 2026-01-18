import { Question, UUID } from '../models';
import { StorageBackend } from './storage';
import { SqliteStorage } from './sqliteStorage';
import { validateQuestion } from '../utils/validators';
import { LruCache } from '../utils/lruCache';

export class QuestionRepository {
  private backend: StorageBackend;
  private cache: LruCache<UUID, Question>;

  constructor(filePath?: string, backend?: StorageBackend) {
    // allow injection of a custom backend for tests or JSON fallback
    if (backend) {
      this.backend = backend;
    } else {
      this.backend = new SqliteStorage(filePath);
    }
    this.cache = new LruCache<UUID, Question>(1000, 5 * 60 * 1000);
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
    this.backend.addQuestion(question);
    this.cache.set(question.id, question);
  }

  update(id: UUID, patch: Partial<Question>) {
    const existing = this.backend.getQuestion(id);
    if (!existing) throw new Error('Question not found');
    const merged = { ...existing, ...patch } as Question;
    const errors = validateQuestion(merged);
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
    this.backend.updateQuestion(id, patch);
    this.cache.set(id, { ...existing, ...patch } as Question);
  }

  remove(id: UUID) {
    this.backend.removeQuestion(id);
    this.cache.delete(id);
  }
}
