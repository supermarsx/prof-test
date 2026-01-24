import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';

let hasBetter: boolean = true;
let SqliteStorage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.close();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SqliteStorage = require('../repository/sqliteStorage').SqliteStorage;
} catch (e) {
  hasBetter = false;
}

const TMP_DB = path.join(__dirname, 'tmp_questions.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  test('sqlite storage basic CRUD', () => {
    const store = new SqliteStorage(TMP_DB);
    const q = {
      id: 's1',
      type: 'multiple_choice',
      stem: 'S1',
      choices: [
        { id: 'c1', text: 'A', is_correct: true },
        { id: 'c2', text: 'B', is_correct: false },
      ],
    } as any;
    store.addQuestion(q);
    const got = store.getQuestion('s1');
    expect(got).toBeDefined();
    expect(got!.id).toBe('s1');

    store.updateQuestion('s1', { stem: 'S1-updated' });
    const upd = store.getQuestion('s1');
    expect(upd!.stem).toBe('S1-updated');

    store.removeQuestion('s1');
    const after = store.getQuestion('s1');
    expect(after).toBeUndefined();
  });
} else {
  test.skip('sqlite storage basic CRUD (skipped - better-sqlite3 not installed)', () => {});
}
