import fs from 'fs';
import path from 'path';
import { test, expect, afterEach } from 'vitest';
import { QuestionRepository } from '../repository/questionRepository';

const TMP = path.join(__dirname, 'tmp_questions.json');

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
});

test('QuestionRepository CRUD operations', () => {
  const repo = new QuestionRepository(TMP);
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

  repo.remove('q2');
  const after = repo.list();
  expect(after.length).toBe(1);
});

test('QuestionRepository search by text', () => {
  const repo = new QuestionRepository(TMP);
  repo.add(makeQuestion('q1'));
  repo.add({ ...makeQuestion('q2'), stem: 'This mentions algebra' });

  const results = repo.search('algebra');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('q2');
});
