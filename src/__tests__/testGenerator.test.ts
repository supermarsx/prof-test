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
  const versions = generateTestVersions(sampleQs as any, { versions: 3, seed: 42 });
  expect(versions.length).toBe(3);
  versions.forEach((v) => {
    expect(v.answer_key).toBeDefined();
    // ensure answer_key has entries for each question
    expect(Object.keys(v.answer_key || {}).length).toBe(sampleQs.length);
  });
});

test('generateTestVersions shuffles choices for multiple choice', () => {
  const versions = generateTestVersions(sampleQs as any, { versions: 1, seed: 1 });
  const shuffled = versions[0];
  const firstQuestionAnswer = shuffled.answer_key && shuffled.answer_key[1];
  expect(firstQuestionAnswer).toBeDefined();
});

test('buildAnswerKeyCsv emits rows for each version/question', () => {
  const versions = generateTestVersions(sampleQs as any, { versions: 2, seed: 1 });
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
  const versions = generateTestVersions(sampleQs as any, { versions: 1, seed: 1 });
  const buf = buildGradingMatrixWorkbook('test-1', versions);
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.length).toBeGreaterThan(0);
});

test('generateTestVersions keeps media refs with shuffled questions', () => {
  const mediaQs = [
    { id: 'qa', type: 'multiple_choice', stem: 'A', media_refs: [{ id: 'm1', path: 'a.png' }] },
    { id: 'qb', type: 'multiple_choice', stem: 'B', media_refs: [{ id: 'm2', path: 'b.png' }] },
  ];
  const versions = generateTestVersions(mediaQs as any, { versions: 1, seed: 2 });
  const shuffled = versions[0];
  const firstQuestionId = shuffled.generated_questions?.[0]?.base_question_id;
  const source = mediaQs.find((q) => q.id === firstQuestionId);
  expect(source?.media_refs?.[0]?.path).toBeDefined();
});
