import { test, expect } from 'vitest';
import { selectQuestions, constraintsFromTemplate, SelectionConstraints } from '../utils/constraintSolver';
import { Question, TestTemplate } from '../models';

function makeQuestion(overrides: Partial<Question> & { id: string; stem: string }): Question {
  return { type: 'multiple_choice', ...overrides } as Question;
}

const pool: Question[] = [
  makeQuestion({ id: 'q1', stem: 'Q1', topic: 'Algebra', difficulty: 1, type: 'multiple_choice', tags: ['easy'] }),
  makeQuestion({ id: 'q2', stem: 'Q2', topic: 'Algebra', difficulty: 2, type: 'short_answer', tags: ['medium'] }),
  makeQuestion({ id: 'q3', stem: 'Q3', topic: 'Geometry', difficulty: 3, type: 'multiple_choice' }),
  makeQuestion({ id: 'q4', stem: 'Q4', topic: 'Geometry', difficulty: 1, type: 'true_false' }),
  makeQuestion({ id: 'q5', stem: 'Q5', topic: 'Calculus', difficulty: 2, type: 'multiple_select' }),
  makeQuestion({ id: 'q6', stem: 'Q6', topic: 'Calculus', difficulty: 3, type: 'multiple_choice', tags: ['old-exam'] }),
  makeQuestion({ id: 'q7', stem: 'Q7', topic: 'Algebra', difficulty: 1, type: 'multiple_choice' }),
];

test('selectQuestions returns correct total', () => {
  const result = selectQuestions(pool, { total_questions: 3 });
  expect(result.selected).toHaveLength(3);
  expect(result.warnings).toHaveLength(0);
});

test('selectQuestions respects topic distribution', () => {
  const result = selectQuestions(pool, {
    total_questions: 4,
    topic_distribution: { Algebra: 2, Geometry: 2 },
  });
  const topics = result.selected.map((q) => q.topic);
  expect(topics.filter((t) => t === 'Algebra')).toHaveLength(2);
  expect(topics.filter((t) => t === 'Geometry')).toHaveLength(2);
});

test('selectQuestions respects difficulty distribution', () => {
  const result = selectQuestions(pool, {
    total_questions: 4,
    difficulty_distribution: { '1': 2, '2': 2 },
  });
  const diffs = result.selected.map((q) => q.difficulty);
  expect(diffs.filter((d) => d === 1)).toHaveLength(2);
  expect(diffs.filter((d) => d === 2)).toHaveLength(2);
});

test('selectQuestions respects type distribution', () => {
  const result = selectQuestions(pool, {
    total_questions: 3,
    type_distribution: { multiple_choice: 2, short_answer: 1 },
  });
  const types = result.selected.map((q) => q.type);
  expect(types.filter((t) => t === 'multiple_choice')).toHaveLength(2);
  expect(types.filter((t) => t === 'short_answer')).toHaveLength(1);
});

test('selectQuestions excludes tags', () => {
  const result = selectQuestions(pool, {
    total_questions: 7,
    exclude_tags: ['old-exam'],
  });
  expect(result.selected.find((q) => q.id === 'q6')).toBeUndefined();
  expect(result.selected).toHaveLength(6);
  expect(result.warnings.length).toBeGreaterThanOrEqual(1); // only 6 available
});

test('selectQuestions warns when pool is insufficient', () => {
  const result = selectQuestions(pool, { total_questions: 100 });
  expect(result.selected).toHaveLength(7);
  expect(result.warnings).toContain('Only 7 questions available; requested 100');
});

test('selectQuestions warns on unfillable bucket', () => {
  const result = selectQuestions(pool, {
    total_questions: 5,
    topic_distribution: { Statistics: 3 }, // topic not in pool
  });
  expect(result.warnings.some((w) => w.includes('topic="Statistics"'))).toBe(true);
});

test('selectQuestions with zero total returns empty', () => {
  const result = selectQuestions(pool, { total_questions: 0 });
  expect(result.selected).toHaveLength(0);
});

test('constraintsFromTemplate converts percentages to counts', () => {
  const template: TestTemplate = {
    id: 't1',
    title: 'Test',
    constraints: {
      total_questions: 10,
      topic_distribution: { Algebra: 0.5, Geometry: 0.5 },
      difficulty_distribution: { '1': 0.3, '2': 0.7 },
    },
  };
  const c = constraintsFromTemplate(template);
  expect(c.total_questions).toBe(10);
  expect(c.topic_distribution).toEqual({ Algebra: 5, Geometry: 5 });
  expect(c.difficulty_distribution).toEqual({ '1': 3, '2': 7 });
});
