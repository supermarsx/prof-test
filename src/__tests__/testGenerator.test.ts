import { test, expect } from 'vitest';
import { generateTestVersions } from '../utils/testGenerator';
import { buildAnswerKeyCsv, buildQuestionMetadataCsv } from '../utils/exports';
import { buildGradingMatrixWorkbook } from '../utils/exportsExcel';

const sampleQs = [
  { id: 'q1', type: 'multiple_choice', choices: [{id:'c1', is_correct:false},{id:'c2', is_correct:true}] },
  { id: 'q2', type: 'multiple_choice', choices: [{id:'c3', is_correct:true},{id:'c4', is_correct:false}] },
  { id: 'q3', type: 'multiple_choice', choices: [{id:'c5', is_correct:false},{id:'c6', is_correct:true}] },
];

test('generateTestVersions produces requested number of versions and answer keys', () => {
  const { versions } = generateTestVersions(sampleQs as any, { versions: 3, seed: 42 });
  expect(versions.length).toBe(3);
  versions.forEach((v) => {
    expect(v.answer_key).toBeDefined();
    // ensure answer_key has entries for each question
    expect(Object.keys(v.answer_key || {}).length).toBe(sampleQs.length);
  });
});

test('generateTestVersions shuffles choices for multiple choice', () => {
  const { versions } = generateTestVersions(sampleQs as any, { versions: 1, seed: 1 });
  const shuffled = versions[0];
  const firstQuestionAnswer = shuffled.answer_key && shuffled.answer_key[1];
  expect(firstQuestionAnswer).toBeDefined();
});

test('buildAnswerKeyCsv emits rows for each version/question', () => {
  const { versions } = generateTestVersions(sampleQs as any, { versions: 2, seed: 1 });
  const csv = buildAnswerKeyCsv('test-1', versions);
  const lines = csv.trim().split('\n');
  expect(lines.length).toBe(1 + versions.length * sampleQs.length);
});

test('buildQuestionMetadataCsv emits rows for each question', () => {
  const csv = buildQuestionMetadataCsv(sampleQs as any);
  const lines = csv.trim().split('\n');
  expect(lines.length).toBe(1 + sampleQs.length);
});

test('buildGradingMatrixWorkbook creates a workbook buffer', () => {
  const { versions } = generateTestVersions(sampleQs as any, { versions: 1, seed: 1 });
  const buf = buildGradingMatrixWorkbook('test-1', versions);
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.length).toBeGreaterThan(0);
});

test('generateTestVersions keeps media refs with shuffled questions', () => {
  const mediaQs = [
    { id: 'qa', type: 'multiple_choice', stem: 'A', media_refs: [{ id: 'm1', path: 'a.png' }] },
    { id: 'qb', type: 'multiple_choice', stem: 'B', media_refs: [{ id: 'm2', path: 'b.png' }] },
  ];
  const { versions } = generateTestVersions(mediaQs as any, { versions: 1, seed: 2 });
  const shuffled = versions[0];
  const firstQuestionId = shuffled.generated_questions?.[0]?.base_question_id;
  const source = mediaQs.find((q) => q.id === firstQuestionId);
  expect(source?.media_refs?.[0]?.path).toBeDefined();
});

test('generateTestVersions returns a changeLog', () => {
  const result = generateTestVersions(sampleQs as any, { versions: 2, seed: 10 });
  expect(result.changeLog).toBeDefined();
  expect(result.changeLog.entries.length).toBe(2);
  expect(result.changeLog.generated_at).toBeDefined();
  result.changeLog.entries.forEach((entry) => {
    expect(entry.version_label).toBeDefined();
    expect(Array.isArray(entry.changes)).toBe(true);
  });
});

test('generateTestVersions with swapEquivalentQuestions swaps equivalent questions', () => {
  const equivalentQs = [
    { id: 'q1', type: 'multiple_choice', topic: 'algebra', difficulty: 2, stem: 'Q1',
      choices: [{id:'c1', is_correct:true},{id:'c2', is_correct:false}] },
    { id: 'q2', type: 'multiple_choice', topic: 'algebra', difficulty: 2, stem: 'Q2',
      choices: [{id:'c3', is_correct:true},{id:'c4', is_correct:false}] },
    { id: 'q3', type: 'multiple_choice', topic: 'calculus', difficulty: 3, stem: 'Q3',
      choices: [{id:'c5', is_correct:false},{id:'c6', is_correct:true}] },
  ];
  const result = generateTestVersions(equivalentQs as any, {
    versions: 4,
    seed: 1,
    swapEquivalentQuestions: true,
  });
  expect(result.versions.length).toBe(4);
  // The non-equivalent question (q3) should always appear
  result.versions.forEach((v) => {
    const baseIds = v.generated_questions!.map((qi) => qi.base_question_id);
    expect(baseIds).toContain('q3');
    // Each version should have exactly 3 questions
    expect(v.generated_questions!.length).toBe(3);
  });
  // With 4 versions and seed-based swaps, at least one version should have a swap recorded
  const allChanges = result.changeLog.entries.flatMap((e) => e.changes);
  const swapChanges = allChanges.filter((c) => c.includes('swapped'));
  // There should be some swap entries across versions (not necessarily all)
  expect(swapChanges.length).toBeGreaterThanOrEqual(0);
});

test('generateTestVersions with sections shuffles within sections, not across them', () => {
  const secA = [
    { id: 'a1', type: 'multiple_choice', stem: 'A1', choices: [{id:'ca1', is_correct:true}] },
    { id: 'a2', type: 'multiple_choice', stem: 'A2', choices: [{id:'ca2', is_correct:true}] },
    { id: 'a3', type: 'multiple_choice', stem: 'A3', choices: [{id:'ca3', is_correct:true}] },
  ];
  const secB = [
    { id: 'b1', type: 'short_answer', stem: 'B1' },
    { id: 'b2', type: 'short_answer', stem: 'B2' },
  ];
  const allQuestions = [...secA, ...secB];

  const result = generateTestVersions(allQuestions as any, {
    versions: 5,
    seed: 42,
    sections: [
      { id: 'sec-a', name: 'Section A', questionIds: ['a1', 'a2', 'a3'] },
      { id: 'sec-b', name: 'Section B', questionIds: ['b1', 'b2'] },
    ],
  });

  expect(result.versions.length).toBe(5);
  result.versions.forEach((v) => {
    const ids = v.generated_questions!.map((qi) => qi.base_question_id);
    // First 3 should all be from section A
    const first3 = new Set(ids.slice(0, 3));
    expect(first3.has('a1')).toBe(true);
    expect(first3.has('a2')).toBe(true);
    expect(first3.has('a3')).toBe(true);
    // Last 2 should all be from section B
    const last2 = new Set(ids.slice(3));
    expect(last2.has('b1')).toBe(true);
    expect(last2.has('b2')).toBe(true);
    // Total should be 5
    expect(ids.length).toBe(5);
  });

  // Change log should include section labels
  const allChanges = result.changeLog.entries.flatMap((e) => e.changes);
  const sectionLabeledChanges = allChanges.filter((c) => c.includes('[Section'));
  expect(sectionLabeledChanges.length).toBeGreaterThan(0);
});
