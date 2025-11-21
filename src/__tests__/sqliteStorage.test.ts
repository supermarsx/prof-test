import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';

let hasBetter: boolean = true;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require.resolve('better-sqlite3');
} catch (e) {
  hasBetter = false;
}

const TMP_DB = path.join(__dirname, 'tmp_questions.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  // only import the storage if the package is available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SqliteStorage } = require('../repository/sqliteStorage');

  test('sqlite storage basic CRUD', () => {
    const store = new SqliteStorage(TMP_DB);
    const q = { id: 's1', type: 'multiple_choice', stem: 'S1' } as any;
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
