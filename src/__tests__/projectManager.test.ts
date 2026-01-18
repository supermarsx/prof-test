import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { ProjectManager } from '../repository/projectManager';

const TMP_BASE = path.join(__dirname, 'tmp_projects');
const TMP_ARCHIVE = path.join(__dirname, 'tmp_projects.examproj');

afterEach(() => {
  if (fs.existsSync(TMP_BASE)) {
    fs.rmSync(TMP_BASE, { recursive: true, force: true });
  }
  if (fs.existsSync(TMP_ARCHIVE)) {
    fs.unlinkSync(TMP_ARCHIVE);
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

test('export and import project archive', () => {
  const mgr = new ProjectManager(TMP_BASE);
  mgr.createProject('p1');
  const out = mgr.exportProject('p1', TMP_ARCHIVE);
  expect(fs.existsSync(out)).toBe(true);
  const imported = mgr.importProject(TMP_ARCHIVE, 'p2');
  expect(imported).toBeDefined();
  expect(fs.existsSync(imported.root)).toBe(true);
});
