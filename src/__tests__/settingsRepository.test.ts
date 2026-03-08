import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';

let hasBetter = true;
let SettingsRepository: any;
let closeDb: any;

try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.close();
  SettingsRepository = require('../repository/settingsRepository').SettingsRepository;
  closeDb = require('../repository/dbManager').closeDb;
} catch {
  hasBetter = false;
}

const TMP_DB = path.join(__dirname, 'tmp_settings_test.db');

afterEach(() => {
  if (hasBetter && closeDb) closeDb(TMP_DB);
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
});

if (hasBetter) {
  test('get/set/remove individual keys', () => {
    const repo = new SettingsRepository(TMP_DB);
    expect(repo.get('foo')).toBeUndefined();

    repo.set('foo', 'bar');
    expect(repo.get('foo')).toBe('bar');

    repo.set('foo', 'baz');
    expect(repo.get('foo')).toBe('baz');

    repo.remove('foo');
    expect(repo.get('foo')).toBeUndefined();
  });

  test('getAll returns all key-value pairs', () => {
    const repo = new SettingsRepository(TMP_DB);
    repo.set('a', '1');
    repo.set('b', '2');
    repo.set('c', '3');

    const all = repo.getAll();
    expect(all).toEqual({ a: '1', b: '2', c: '3' });
  });

  test('getSettings returns defaults when empty', () => {
    const repo = new SettingsRepository(TMP_DB);
    const settings = repo.getSettings();
    expect(settings.language).toBe('en');
    expect(settings.use_embedded_latex).toBe(false);
    expect(settings.latex_path).toBeUndefined();
    expect(settings.ai_provider).toBeUndefined();
  });

  test('saveSettings persists and getSettings retrieves', () => {
    const repo = new SettingsRepository(TMP_DB);
    repo.saveSettings({
      latex_path: '/usr/bin/pdflatex',
      use_embedded_latex: true,
      ai_provider: 'openai',
      ai_api_key_encrypted: 'encrypted123',
      language: 'es',
    });

    const settings = repo.getSettings();
    expect(settings.latex_path).toBe('/usr/bin/pdflatex');
    expect(settings.use_embedded_latex).toBe(true);
    expect(settings.ai_provider).toBe('openai');
    expect(settings.ai_api_key_encrypted).toBe('encrypted123');
    expect(settings.language).toBe('es');
  });

  test('saveSettings supports partial updates', () => {
    const repo = new SettingsRepository(TMP_DB);
    repo.saveSettings({ language: 'fr' });
    repo.saveSettings({ ai_provider: 'anthropic' });

    const settings = repo.getSettings();
    expect(settings.language).toBe('fr');
    expect(settings.ai_provider).toBe('anthropic');
  });
} else {
  test.skip('settingsRepository (skipped - better-sqlite3 not installed)', () => {});
}
