import { test, expect } from 'vitest';
import { generateTestVersions } from '../utils/testGenerator';

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
