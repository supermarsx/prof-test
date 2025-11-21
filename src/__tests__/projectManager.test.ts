import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { ProjectManager } from '../repository/projectManager';

const TMP_BASE = path.join(__dirname, 'tmp_projects');

afterEach(() => {
  if (fs.existsSync(TMP_BASE)) {
    fs.rmSync(TMP_BASE, { recursive: true, force: true });
  }
});

test('create project and media save/list', () => {
  const mgr = new ProjectManager(TMP_BASE);
  const layout = mgr.createProject('p1');
  expect(layout).toBeDefined();
  expect(fs.existsSync(layout.mediaDir)).toBe(true);

  const buf = Buffer.from('hello');
  const saved = mgr.saveMedia('p1', 'img.png', buf);
  expect(fs.existsSync(saved)).toBe(true);

  const files = mgr.listMedia('p1');
  expect(files.includes('img.png')).toBe(true);
});
