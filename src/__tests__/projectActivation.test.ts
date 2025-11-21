import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { ProjectManager } from '../repository/projectManager';
import { QuestionRepository } from '../repository/questionRepository';

const TMP_BASE = path.join(__dirname, 'tmp_projects2');

afterEach(() => {
  if (fs.existsSync(TMP_BASE)) {
    fs.rmSync(TMP_BASE, { recursive: true, force: true });
  }
});

test('activate project by constructing repo with project questions path', () => {
  const mgr = new ProjectManager(TMP_BASE);
  const layout = mgr.createProject('p2');
  const questionsFile = path.join(layout.dataDir, 'questions.json');

  const repo = new QuestionRepository(questionsFile);
  const q = { id: 'qa', type: 'multiple_choice', stem: 'QA' } as any;
  repo.add(q);

  const all = repo.list();
  expect(all.length).toBe(1);
  expect(all[0].id).toBe('qa');
});
