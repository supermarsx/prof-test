import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { ExportProfileRepository } from '../repository/exportProfileRepository';

const TMP_DB = path.join(__dirname, 'tmp_profiles.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

test('ExportProfileRepository CRUD', () => {
  const repo = new ExportProfileRepository(TMP_DB);
  repo.upsert({ id: 'p1', name: 'Profile 1', format: 'csv', includes: ['answer_keys'] } as any);
  const list = repo.list();
  expect(list.length).toBe(1);
  expect(list[0].id).toBe('p1');

  repo.remove('p1');
  const after = repo.list();
  expect(after.length).toBe(0);
});
