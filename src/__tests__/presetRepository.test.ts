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

const TMP_DB = path.join(__dirname, 'tmp_presets.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  test('PresetRepository CRUD', async () => {
    const mod = await import('../repository/presetRepository');
    const repo = new mod.PresetRepository(TMP_DB);
    repo.upsertHeaderPreset({ id: 'h1', name: 'Header 1', scope: 'global' } as any);
    repo.upsertLayoutPreset({ id: 'l1', name: 'Layout 1' } as any);

    expect(repo.listHeaderPresets().length).toBe(1);
    expect(repo.listLayoutPresets().length).toBe(1);

    repo.removeHeaderPreset('h1');
    repo.removeLayoutPreset('l1');
    expect(repo.listHeaderPresets().length).toBe(0);
    expect(repo.listLayoutPresets().length).toBe(0);
  });
} else {
  test.skip('PresetRepository CRUD (skipped - better-sqlite3 not installed)', () => {});
}
