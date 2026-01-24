import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
let hasBetter: boolean = true;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.close();
} catch (e) {
  hasBetter = false;
}

const TMP_DB = path.join(__dirname, 'tmp_profiles.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  test('ExportProfileRepository CRUD', async () => {
    const mod = await import('../repository/exportProfileRepository');
    const repo = new mod.ExportProfileRepository(TMP_DB);
    repo.upsert({ id: 'p1', name: 'Profile 1', format: 'csv', includes: ['answer_keys'] } as any);
    const list = repo.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('p1');

    repo.remove('p1');
    const after = repo.list();
    expect(after.length).toBe(0);
  });
} else {
  test.skip('ExportProfileRepository CRUD (skipped - better-sqlite3 not installed)', () => {});
}
