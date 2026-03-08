import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';

let hasBetter = true;
let TestRepository: any;
let closeDb: any;

try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.close();
  TestRepository = require('../repository/testRepository').TestRepository;
  closeDb = require('../repository/dbManager').closeDb;
} catch {
  hasBetter = false;
}

const TMP_DB = path.join(__dirname, 'tmp_testrepo_test.db');

function makeTemplate(id: string) {
  return { id, title: `Test ${id}`, course: 'CS101', description: `Description for ${id}` };
}

function makeInstance(id: string, templateId: string) {
  return { id, test_template_id: templateId, version_label: `v${id}`, random_seed: 42 };
}

afterEach(() => {
  if (hasBetter && closeDb) closeDb(TMP_DB);
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  test('upsert and list templates', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertTemplate(makeTemplate('t1'));
    repo.upsertTemplate(makeTemplate('t2'));

    const list = repo.listTemplates();
    expect(list.length).toBe(2);
    expect(list.map((t: any) => t.id).sort()).toEqual(['t1', 't2']);
  });

  test('getTemplate returns correct template', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertTemplate(makeTemplate('t1'));

    const t = repo.getTemplate('t1');
    expect(t).toBeDefined();
    expect(t!.title).toBe('Test t1');
    expect(t!.course).toBe('CS101');
  });

  test('getTemplate returns undefined for non-existent id', () => {
    const repo = new TestRepository(TMP_DB);
    expect(repo.getTemplate('nonexistent')).toBeUndefined();
  });

  test('upsertTemplate updates existing template', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertTemplate(makeTemplate('t1'));
    repo.upsertTemplate({ ...makeTemplate('t1'), title: 'Updated Title' });

    const t = repo.getTemplate('t1');
    expect(t!.title).toBe('Updated Title');
    expect(repo.listTemplates().length).toBe(1);
  });

  test('removeTemplate deletes template and its instances', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertTemplate(makeTemplate('t1'));
    repo.upsertInstance(makeInstance('i1', 't1'));
    repo.upsertInstance(makeInstance('i2', 't1'));

    repo.removeTemplate('t1');
    expect(repo.getTemplate('t1')).toBeUndefined();
    expect(repo.listInstances('t1').length).toBe(0);
  });

  test('upsert and list instances', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertInstance(makeInstance('i1', 't1'));
    repo.upsertInstance(makeInstance('i2', 't1'));

    const all = repo.listInstances();
    expect(all.length).toBe(2);
  });

  test('listInstances filters by templateId', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertInstance(makeInstance('i1', 't1'));
    repo.upsertInstance(makeInstance('i2', 't2'));

    expect(repo.listInstances('t1').length).toBe(1);
    expect(repo.listInstances('t1')[0].id).toBe('i1');
    expect(repo.listInstances('t2').length).toBe(1);
  });

  test('getInstance returns correct instance', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertInstance(makeInstance('i1', 't1'));

    const inst = repo.getInstance('i1');
    expect(inst).toBeDefined();
    expect(inst!.version_label).toBe('vi1');
    expect(inst!.random_seed).toBe(42);
  });

  test('getInstance returns undefined for non-existent id', () => {
    const repo = new TestRepository(TMP_DB);
    expect(repo.getInstance('nonexistent')).toBeUndefined();
  });

  test('removeInstance deletes only the specified instance', () => {
    const repo = new TestRepository(TMP_DB);
    repo.upsertInstance(makeInstance('i1', 't1'));
    repo.upsertInstance(makeInstance('i2', 't1'));

    repo.removeInstance('i1');
    expect(repo.getInstance('i1')).toBeUndefined();
    expect(repo.getInstance('i2')).toBeDefined();
  });
} else {
  test.skip('testRepository (skipped - better-sqlite3 not installed)', () => {});
}
