import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { QuestionRepository } from '../repository/questionRepository';
import { JsonFileStorage } from '../repository/storage';

const TMP = path.join(__dirname, 'tmp_questions.json');
const TMP_EXPORT = path.join(__dirname, 'tmp_export.json');
const TMP_YAML = path.join(__dirname, 'tmp_questions.yaml');

function makeQuestion(id: string) {
  return {
    id,
    type: 'multiple_choice',
    stem: `Question ${id}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any;
}

afterEach(() => {
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  if (fs.existsSync(TMP_EXPORT)) fs.unlinkSync(TMP_EXPORT);
  if (fs.existsSync(TMP_YAML)) fs.unlinkSync(TMP_YAML);
});

test('QuestionRepository CRUD operations', () => {
  const repo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  const q1 = makeQuestion('q1');
  const q2 = makeQuestion('q2');

  repo.add(q1);
  repo.add(q2);

  const all = repo.list();
  expect(all.length).toBe(2);

  const got = repo.get('q1');
  expect(got).toBeDefined();
  expect(got!.stem).toContain('q1');

  repo.update('q1', { stem: 'Updated q1' });
  const updated = repo.get('q1');
  expect(updated!.stem).toBe('Updated q1');
  expect(updated!.updated_at).toBeDefined();

  repo.remove('q2');
  const after = repo.list();
  expect(after.length).toBe(1);
});

test('QuestionRepository sets timestamps on add', () => {
  const repo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  repo.add({ id: 'q3', type: 'multiple_choice', stem: 'Test' } as any);
  const got = repo.get('q3');
  expect(got!.created_at).toBeDefined();
  expect(got!.updated_at).toBeDefined();
});

test('QuestionRepository search by text', () => {
  const repo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  repo.add(makeQuestion('q1'));
  repo.add({ ...makeQuestion('q2'), stem: 'This mentions algebra', subject: 'Math' } as any);

  const results = repo.search('algebra');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('q2');

  const subjectResults = repo.search('math');
  expect(subjectResults.length).toBe(1);
  expect(subjectResults[0].id).toBe('q2');
});

test('QuestionRepository JSON export/import', () => {
  const repo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  repo.add(makeQuestion('q1'));
  repo.exportToJson(TMP_EXPORT);

  const importRepo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  importRepo.importFromJson(TMP_EXPORT, 'replace');
  const all = importRepo.list();
  expect(all.length).toBe(1);
  expect(all[0].id).toBe('q1');
});

test('QuestionRepository YAML export/import', () => {
  const repo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  repo.add(makeQuestion('q1'));
  repo.exportToYaml(TMP_YAML);

  const importRepo = new QuestionRepository(undefined, new JsonFileStorage(TMP));
  importRepo.importFromYaml(TMP_YAML, 'replace');
  const all = importRepo.list();
  expect(all.length).toBe(1);
  expect(all[0].id).toBe('q1');
});
