import { TestTemplate, TestInstance } from '../models';
import { getDb } from './dbManager';

export class TestRepository {
  private db: any;

  constructor(dbPath: string) {
    this.db = getDb(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_templates (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS test_instances (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
    `);
  }

  listTemplates(): TestTemplate[] {
    return this.db.prepare('SELECT json FROM test_templates').all()
      .map((r: any) => JSON.parse(r.json) as TestTemplate);
  }

  getTemplate(id: string): TestTemplate | undefined {
    const row = this.db.prepare('SELECT json FROM test_templates WHERE id = ?').get(id);
    return row ? (JSON.parse(row.json) as TestTemplate) : undefined;
  }

  upsertTemplate(template: TestTemplate) {
    this.db.prepare('INSERT OR REPLACE INTO test_templates (id, json) VALUES (?, ?)')
      .run(template.id, JSON.stringify(template));
  }

  removeTemplate(id: string) {
    this.db.prepare('DELETE FROM test_templates WHERE id = ?').run(id);
    // Also remove associated instances
    const instances = this.listInstances().filter((i: TestInstance) => i.test_template_id === id);
    for (const inst of instances) {
      this.removeInstance(inst.id);
    }
  }

  listInstances(templateId?: string): TestInstance[] {
    const all: TestInstance[] = this.db.prepare('SELECT json FROM test_instances').all()
      .map((r: any) => JSON.parse(r.json) as TestInstance);
    if (templateId) return all.filter((i: TestInstance) => i.test_template_id === templateId);
    return all;
  }

  getInstance(id: string): TestInstance | undefined {
    const row = this.db.prepare('SELECT json FROM test_instances WHERE id = ?').get(id);
    return row ? (JSON.parse(row.json) as TestInstance) : undefined;
  }

  upsertInstance(instance: TestInstance) {
    this.db.prepare('INSERT OR REPLACE INTO test_instances (id, json) VALUES (?, ?)')
      .run(instance.id, JSON.stringify(instance));
  }

  removeInstance(id: string) {
    this.db.prepare('DELETE FROM test_instances WHERE id = ?').run(id);
  }
}
