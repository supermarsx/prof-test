import { test, expect } from 'vitest';
import { validateHeaderPreset, validateLayoutPreset, validateQuestion, validateTestInstance, validateTestTemplate } from '../utils/validators';

test('validateQuestion returns errors for missing fields', () => {
  const errors = validateQuestion({ id: '', type: 'multiple_choice', stem: '' } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateQuestion accepts basic valid question', () => {
  const errors = validateQuestion({ id: 'q1', type: 'multiple_choice', stem: 'Hi' } as any);
  expect(errors.length).toBe(0);
});

test('validateQuestion enforces choice rules for multiple choice', () => {
  const errors = validateQuestion({
    id: 'q2',
    type: 'multiple_choice',
    stem: 'Hi',
    choices: [{ id: 'c1', text: 'A', is_correct: true }, { id: 'c2', text: 'B', is_correct: true }],
  } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateQuestion enforces true/false rules', () => {
  const errors = validateQuestion({
    id: 'q3',
    type: 'true_false',
    stem: 'Hi',
    choices: [{ id: 't', text: 'True', is_correct: true }],
  } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateHeaderPreset enforces required fields', () => {
  const errors = validateHeaderPreset({ id: '', name: '', scope: 'global' } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateLayoutPreset enforces required fields', () => {
  const errors = validateLayoutPreset({ id: '', name: '' } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateTestTemplate requires id and title', () => {
  const errors = validateTestTemplate({ id: '', title: '' } as any);
  expect(errors.length).toBeGreaterThan(0);
});

test('validateTestInstance checks version label', () => {
  const errors = validateTestInstance({ id: 't1', version_label: 'AB' } as any);
  expect(errors.length).toBeGreaterThan(0);
});
