import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { PresetRepository } from '../repository/presetRepository';

const TMP_DB = path.join(__dirname, 'tmp_presets.db');

afterEach(() => {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

test('PresetRepository CRUD', () => {
  const repo = new PresetRepository(TMP_DB);
  repo.upsertHeaderPreset({ id: 'h1', name: 'Header 1', scope: 'global' } as any);
  repo.upsertLayoutPreset({ id: 'l1', name: 'Layout 1' } as any);

  expect(repo.listHeaderPresets().length).toBe(1);
  expect(repo.listLayoutPresets().length).toBe(1);

  repo.removeHeaderPreset('h1');
  repo.removeLayoutPreset('l1');
  expect(repo.listHeaderPresets().length).toBe(0);
  expect(repo.listLayoutPresets().length).toBe(0);
});
