import { test, expect } from 'vitest';
import {
  createAssembledTest,
  addSection,
  removeSection,
  reorderSection,
  addQuestionToSection,
  removeQuestionFromSection,
  reorderQuestionInSection,
  moveQuestionBetweenSections,
  setQuestionPoints,
  toggleQuestionIncluded,
  totalPoints,
} from '../utils/testAssembler';
import { Question, TestTemplate, SectionDefinition } from '../models';

const template: TestTemplate = { id: 't1', title: 'Midterm', sections: [] };
const sectionA: SectionDefinition = { id: 's1', name: 'Section A' };
const sectionB: SectionDefinition = { id: 's2', name: 'Section B' };
const q1: Question = { id: 'q1', type: 'multiple_choice', stem: 'Q1' };
const q2: Question = { id: 'q2', type: 'short_answer', stem: 'Q2' };
const q3: Question = { id: 'q3', type: 'true_false', stem: 'Q3' };

test('createAssembledTest produces empty sections', () => {
  const t = createAssembledTest(template);
  expect(t.sections).toHaveLength(0);
  expect(t.template).toBe(template);
});

test('addSection and removeSection', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addSection(t, sectionB);
  expect(t.sections).toHaveLength(2);
  expect(t.sections[0].definition.name).toBe('Section A');
  t = removeSection(t, 's1');
  expect(t.sections).toHaveLength(1);
  expect(t.sections[0].definition.name).toBe('Section B');
  expect(t.sections[0].definition.order_index).toBe(0);
});

test('reorderSection', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addSection(t, sectionB);
  t = reorderSection(t, 0, 1);
  expect(t.sections[0].definition.name).toBe('Section B');
  expect(t.sections[1].definition.name).toBe('Section A');
});

test('addQuestionToSection adds with points', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1, 5);
  t = addQuestionToSection(t, 's1', q2, 3);
  expect(t.sections[0].questions).toHaveLength(2);
  expect(t.sections[0].questions[0].instance.points).toBe(5);
  expect(t.sections[0].questions[1].instance.points).toBe(3);
  expect(t.sections[0].questions[0].included).toBe(true);
});

test('removeQuestionFromSection', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1);
  t = addQuestionToSection(t, 's1', q2);
  const instanceId = t.sections[0].questions[0].instance.id;
  t = removeQuestionFromSection(t, 's1', instanceId);
  expect(t.sections[0].questions).toHaveLength(1);
  expect(t.sections[0].questions[0].question.id).toBe('q2');
  expect(t.sections[0].questions[0].instance.order_index).toBe(0);
});

test('reorderQuestionInSection', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1);
  t = addQuestionToSection(t, 's1', q2);
  t = addQuestionToSection(t, 's1', q3);
  t = reorderQuestionInSection(t, 's1', 0, 2);
  expect(t.sections[0].questions[0].question.id).toBe('q2');
  expect(t.sections[0].questions[1].question.id).toBe('q3');
  expect(t.sections[0].questions[2].question.id).toBe('q1');
});

test('moveQuestionBetweenSections', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addSection(t, sectionB);
  t = addQuestionToSection(t, 's1', q1);
  t = addQuestionToSection(t, 's1', q2);
  const instanceId = t.sections[0].questions[0].instance.id;
  t = moveQuestionBetweenSections(t, 's1', 's2', instanceId);
  expect(t.sections[0].questions).toHaveLength(1);
  expect(t.sections[1].questions).toHaveLength(1);
  expect(t.sections[1].questions[0].question.id).toBe('q1');
});

test('setQuestionPoints', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1, 1);
  const instanceId = t.sections[0].questions[0].instance.id;
  t = setQuestionPoints(t, 's1', instanceId, 10);
  expect(t.sections[0].questions[0].instance.points).toBe(10);
});

test('toggleQuestionIncluded', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1);
  const instanceId = t.sections[0].questions[0].instance.id;
  expect(t.sections[0].questions[0].included).toBe(true);
  t = toggleQuestionIncluded(t, 's1', instanceId);
  expect(t.sections[0].questions[0].included).toBe(false);
  t = toggleQuestionIncluded(t, 's1', instanceId);
  expect(t.sections[0].questions[0].included).toBe(true);
});

test('totalPoints counts only included questions', () => {
  let t = createAssembledTest(template);
  t = addSection(t, sectionA);
  t = addQuestionToSection(t, 's1', q1, 5);
  t = addQuestionToSection(t, 's1', q2, 3);
  expect(totalPoints(t)).toBe(8);
  const instanceId = t.sections[0].questions[1].instance.id;
  t = toggleQuestionIncluded(t, 's1', instanceId);
  expect(totalPoints(t)).toBe(5);
});
