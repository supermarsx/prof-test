import { test, expect } from 'vitest';
import {
  solveConstraints,
  AssemblyConstraints,
  selectQuestions,
  constraintsFromTemplate,
} from '../utils/constraintSolver';
import { Question, TestTemplate } from '../models';

function makeBank(count: number): Question[] {
  const topics = ['algebra', 'geometry', 'calculus', 'statistics'];
  const types: Question['type'][] = ['multiple_choice', 'short_answer', 'true_false'];
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    type: types[i % types.length],
    stem: `Question ${i + 1}`,
    difficulty: (i % 5) + 1,
    topic: topics[i % topics.length],
    tags: i % 3 === 0 ? ['bonus'] : ['standard'],
    choices: types[i % types.length] === 'multiple_choice'
      ? [
          { id: `c${i}a`, text: 'A', is_correct: true },
          { id: `c${i}b`, text: 'B', is_correct: false },
        ]
      : undefined,
  }));
}

function makeQuestion(overrides: Partial<Question> & { id: string; stem: string }): Question {
  return { type: 'multiple_choice', ...overrides } as Question;
}

const selectionPool: Question[] = [
  makeQuestion({ id: 'q1', stem: 'Q1', topic: 'Algebra', difficulty: 1, type: 'multiple_choice', tags: ['easy'] }),
  makeQuestion({ id: 'q2', stem: 'Q2', topic: 'Algebra', difficulty: 2, type: 'short_answer', tags: ['medium'] }),
  makeQuestion({ id: 'q3', stem: 'Q3', topic: 'Geometry', difficulty: 3, type: 'multiple_choice' }),
  makeQuestion({ id: 'q4', stem: 'Q4', topic: 'Geometry', difficulty: 1, type: 'true_false' }),
  makeQuestion({ id: 'q5', stem: 'Q5', topic: 'Calculus', difficulty: 2, type: 'multiple_select' }),
  makeQuestion({ id: 'q6', stem: 'Q6', topic: 'Calculus', difficulty: 3, type: 'multiple_choice', tags: ['old-exam'] }),
  makeQuestion({ id: 'q7', stem: 'Q7', topic: 'Algebra', difficulty: 1, type: 'multiple_choice' }),
];

test('solveConstraints selects the requested total questions', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, { totalQuestions: 10 });
  expect(result.questions).toHaveLength(10);
  expect(result.success).toBe(true);
});

test('solveConstraints respects topic distribution with counts', () => {
  const bank = makeBank(40);
  const result = solveConstraints(bank, {
    totalQuestions: 6,
    topicDistribution: { algebra: 3, geometry: 3 },
  });
  expect(result.questions.filter((q) => q.topic === 'algebra')).toHaveLength(3);
  expect(result.questions.filter((q) => q.topic === 'geometry')).toHaveLength(3);
});

test('solveConstraints respects difficulty distribution as percentages', () => {
  const bank = makeBank(50);
  const result = solveConstraints(bank, {
    totalQuestions: 10,
    difficultyDistribution: { easy: 0.3, medium: 0.3, hard: 0.4 },
  });
  expect(result.questions).toHaveLength(10);
  expect(result.questions.filter((q) => (q.difficulty || 3) <= 2).length).toBeGreaterThanOrEqual(1);
  expect(result.questions.filter((q) => (q.difficulty || 3) >= 4).length).toBeGreaterThanOrEqual(1);
});

test('solveConstraints excludes tags', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 10,
    excludeTags: ['bonus'],
  });
  for (const q of result.questions) expect(q.tags).not.toContain('bonus');
});

test('solveConstraints excludes specific question IDs', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 5,
    excludeQuestionIds: ['q1', 'q2', 'q3'],
  });
  const ids = result.questions.map((q) => q.id);
  expect(ids).not.toContain('q1');
  expect(ids).not.toContain('q2');
  expect(ids).not.toContain('q3');
});

test('solveConstraints warns when bank is insufficient', () => {
  const bank = makeBank(3);
  const result = solveConstraints(bank, { totalQuestions: 10 });
  expect(result.questions.length).toBeLessThan(10);
  expect(result.success).toBe(false);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('solveConstraints produces unique questions', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, { totalQuestions: 15 });
  const ids = result.questions.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('solveConstraints is deterministic with seed', () => {
  const bank = makeBank(30);
  const constraints: AssemblyConstraints = { totalQuestions: 10, seed: 42 };
  const result1 = solveConstraints(bank, constraints);
  const result2 = solveConstraints(bank, constraints);
  expect(result1.questions.map((q) => q.id)).toEqual(result2.questions.map((q) => q.id));
});

test('solveConstraints uses different selections with different seeds', () => {
  const bank = makeBank(50);
  const result1 = solveConstraints(bank, { totalQuestions: 10, seed: 1 });
  const result2 = solveConstraints(bank, { totalQuestions: 10, seed: 999 });
  expect(result1.questions.map((q) => q.id)).not.toEqual(result2.questions.map((q) => q.id));
});

test('solveConstraints handles empty bank', () => {
  const result = solveConstraints([], { totalQuestions: 5 });
  expect(result.questions).toHaveLength(0);
  expect(result.success).toBe(false);
});

test('solveConstraints warns for unmet topic constraints', () => {
  const bank = makeBank(10);
  const result = solveConstraints(bank, {
    totalQuestions: 10,
    topicDistribution: { nonexistent_topic: 5 },
  });
  expect(result.warnings.some((w) => w.includes('nonexistent_topic'))).toBe(true);
  expect(result.unmetConstraints).toContain('topic:nonexistent_topic');
});

test('solveConstraints respects requireTags', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 5,
    requireTags: ['standard'],
  });
  for (const q of result.questions) expect(q.tags).toContain('standard');
});

test('selectQuestions returns correct total', () => {
  const result = selectQuestions(selectionPool, { total_questions: 3 });
  expect(result.selected).toHaveLength(3);
  expect(result.warnings).toHaveLength(0);
});

test('selectQuestions respects topic distribution', () => {
  const result = selectQuestions(selectionPool, {
    total_questions: 4,
    topic_distribution: { Algebra: 2, Geometry: 2 },
  });
  expect(result.selected.map((q) => q.topic).filter((t) => t === 'Algebra')).toHaveLength(2);
  expect(result.selected.map((q) => q.topic).filter((t) => t === 'Geometry')).toHaveLength(2);
});

test('selectQuestions respects difficulty distribution', () => {
  const result = selectQuestions(selectionPool, {
    total_questions: 4,
    difficulty_distribution: { '1': 2, '2': 2 },
  });
  expect(result.selected.map((q) => q.difficulty).filter((d) => d === 1)).toHaveLength(2);
  expect(result.selected.map((q) => q.difficulty).filter((d) => d === 2)).toHaveLength(2);
});

test('selectQuestions respects type distribution', () => {
  const result = selectQuestions(selectionPool, {
    total_questions: 3,
    type_distribution: { multiple_choice: 2, short_answer: 1 },
  });
  expect(result.selected.map((q) => q.type).filter((t) => t === 'multiple_choice')).toHaveLength(2);
  expect(result.selected.map((q) => q.type).filter((t) => t === 'short_answer')).toHaveLength(1);
});

test('selectQuestions excludes tags', () => {
  const result = selectQuestions(selectionPool, {
    total_questions: 7,
    exclude_tags: ['old-exam'],
  });
  expect(result.selected.find((q) => q.id === 'q6')).toBeUndefined();
  expect(result.selected).toHaveLength(6);
  expect(result.warnings.length).toBeGreaterThanOrEqual(1);
});

test('selectQuestions warns when pool is insufficient', () => {
  const result = selectQuestions(selectionPool, { total_questions: 100 });
  expect(result.selected).toHaveLength(7);
  expect(result.warnings).toContain('Only 7 questions available; requested 100');
});

test('selectQuestions warns on unfillable bucket', () => {
  const result = selectQuestions(selectionPool, {
    total_questions: 5,
    topic_distribution: { Statistics: 3 },
  });
  expect(result.warnings.some((w) => w.includes('topic="Statistics"'))).toBe(true);
});

test('selectQuestions with zero total returns empty', () => {
  const result = selectQuestions(selectionPool, { total_questions: 0 });
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
