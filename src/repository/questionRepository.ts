import { Question, UUID } from '../models';
import { StorageBackend, JsonFileStorage } from './storage';

export class QuestionRepository {
  private backend: StorageBackend;

  constructor(filePath?: string, backend?: StorageBackend) {
    // allow injection of a custom backend for tests or future SQLite implementation
    if (backend) {
      this.backend = backend;
    } else {
      this.backend = new JsonFileStorage(filePath);
    }
  }

  list(): Question[] {
    return this.backend.listQuestions();
  }
  
  search(text: string): Question[] {
    const needle = String(text || '').trim().toLowerCase();
    if (!needle) return [];
    return this.backend.listQuestions().filter((q) => {
      return (q.stem && q.stem.toLowerCase().includes(needle)) ||
        (q.topic && q.topic.toLowerCase().includes(needle)) ||
        (q.tags && q.tags.join(' ').toLowerCase().includes(needle));
    });
  }

  get(id: UUID): Question | undefined {
    return this.backend.getQuestion(id);
  }

  add(question: Question) {
    this.backend.addQuestion(question);
  }

  update(id: UUID, patch: Partial<Question>) {
    this.backend.updateQuestion(id, patch);
  }

  remove(id: UUID) {
    this.backend.removeQuestion(id);
  }
}
