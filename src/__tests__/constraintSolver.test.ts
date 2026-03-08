import { test, expect } from 'vitest';
import { solveConstraints, AssemblyConstraints } from '../utils/constraintSolver';
import { Question } from '../models';

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
    choices: types[i % types.length] === 'multiple_choice' ? [
      { id: `c${i}a`, text: 'A', is_correct: true },
      { id: `c${i}b`, text: 'B', is_correct: false },
    ] : undefined,
  }));
}

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
  const algebraCount = result.questions.filter(q => q.topic === 'algebra').length;
  const geometryCount = result.questions.filter(q => q.topic === 'geometry').length;
  expect(algebraCount).toBe(3);
  expect(geometryCount).toBe(3);
  expect(result.questions).toHaveLength(6);
});

test('solveConstraints respects difficulty distribution as percentages', () => {
  const bank = makeBank(50);
  const result = solveConstraints(bank, {
    totalQuestions: 10,
    difficultyDistribution: { easy: 0.3, medium: 0.3, hard: 0.4 },
  });
  expect(result.questions).toHaveLength(10);
  // At minimum, we should have some from each bucket (bank has all difficulties)
  const easyCount = result.questions.filter(q => (q.difficulty || 3) <= 2).length;
  const hardCount = result.questions.filter(q => (q.difficulty || 3) >= 4).length;
  expect(easyCount).toBeGreaterThanOrEqual(1);
  expect(hardCount).toBeGreaterThanOrEqual(1);
});

test('solveConstraints excludes tags', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 10,
    excludeTags: ['bonus'],
  });
  for (const q of result.questions) {
    expect(q.tags).not.toContain('bonus');
  }
});

test('solveConstraints excludes specific question IDs', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 5,
    excludeQuestionIds: ['q1', 'q2', 'q3'],
  });
  const ids = result.questions.map(q => q.id);
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
  const ids = result.questions.map(q => q.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('solveConstraints is deterministic with seed', () => {
  const bank = makeBank(30);
  const constraints: AssemblyConstraints = { totalQuestions: 10, seed: 42 };
  const result1 = solveConstraints(bank, constraints);
  const result2 = solveConstraints(bank, constraints);
  expect(result1.questions.map(q => q.id)).toEqual(result2.questions.map(q => q.id));
});

test('solveConstraints uses different selections with different seeds', () => {
  const bank = makeBank(50);
  const result1 = solveConstraints(bank, { totalQuestions: 10, seed: 1 });
  const result2 = solveConstraints(bank, { totalQuestions: 10, seed: 999 });
  const ids1 = result1.questions.map(q => q.id);
  const ids2 = result2.questions.map(q => q.id);
  // With 50 questions and different seeds, the selections should differ
  // (there's a tiny chance they match, but extremely unlikely)
  expect(ids1).not.toEqual(ids2);
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
  expect(result.warnings.some(w => w.includes('nonexistent_topic'))).toBe(true);
  expect(result.unmetConstraints).toContain('topic:nonexistent_topic');
});

test('solveConstraints respects requireTags', () => {
  const bank = makeBank(20);
  const result = solveConstraints(bank, {
    totalQuestions: 5,
    requireTags: ['standard'],
  });
  for (const q of result.questions) {
    expect(q.tags).toContain('standard');
  }
});
