import { test, expect } from 'vitest';
import { escapeLatex, renderQuestionLatex, renderTestLatex, renderAnswerKeyLatex } from '../utils/latexRenderer';
import { Question, QuestionInstance } from '../models';

test('escapeLatex escapes all special characters', () => {
  expect(escapeLatex('100% & $5 # _test')).toContain('\\%');
  expect(escapeLatex('100% & $5 # _test')).toContain('\\&');
  expect(escapeLatex('100% & $5 # _test')).toContain('\\$');
  expect(escapeLatex('100% & $5 # _test')).toContain('\\#');
  expect(escapeLatex('100% & $5 # _test')).toContain('\\_');
});

test('escapeLatex handles empty and null-like input', () => {
  expect(escapeLatex('')).toBe('');
  expect(escapeLatex(undefined as any)).toBe('');
  expect(escapeLatex(null as any)).toBe('');
});

test('escapeLatex escapes braces and tilde', () => {
  expect(escapeLatex('{hello}')).toContain('\\{');
  expect(escapeLatex('{hello}')).toContain('\\}');
  expect(escapeLatex('~')).toContain('\\textasciitilde{}');
  expect(escapeLatex('^')).toContain('\\textasciicircum{}');
});

test('renderQuestionLatex produces \\item for a simple MC question', () => {
  const q: Question = {
    id: 'q1',
    type: 'multiple_choice',
    stem: 'What is 2+2?',
    choices: [
      { id: 'c1', text: '3', is_correct: false },
      { id: 'c2', text: '4', is_correct: true },
      { id: 'c3', text: '5', is_correct: false },
    ],
  };
  const latex = renderQuestionLatex(q, 0, 5, true);
  expect(latex).toContain('\\item');
  expect(latex).toContain('What is 2+2?');
  expect(latex).toContain('(5 pts)');
  expect(latex).toContain('\\begin{enumerate}[label=\\Alph*)]');
  expect(latex).toContain('\\item 4');
});

test('renderQuestionLatex omits points when showPoints is false', () => {
  const q: Question = { id: 'q1', type: 'short_answer', stem: 'Explain.' };
  const latex = renderQuestionLatex(q, 0, 10, false);
  expect(latex).not.toContain('pts');
  expect(latex).toContain('\\vspace{2cm}');
});

test('renderQuestionLatex handles true/false', () => {
  const q: Question = {
    id: 'q1',
    type: 'true_false',
    stem: 'The sky is blue.',
    choices: [
      { id: 't', text: 'True', is_correct: true },
      { id: 'f', text: 'False', is_correct: false },
    ],
  };
  const latex = renderQuestionLatex(q, 0);
  expect(latex).toContain('True');
  expect(latex).toContain('False');
});

test('renderTestLatex produces a complete document', () => {
  const questions: Question[] = [
    { id: 'q1', type: 'multiple_choice', stem: 'Q1 stem', choices: [{ id: 'c1', text: 'A', is_correct: true }] },
    { id: 'q2', type: 'short_answer', stem: 'Q2 stem' },
  ];
  const instances: QuestionInstance[] = [
    { id: 'i1', base_question_id: 'q1', points: 5, order_index: 0 },
    { id: 'i2', base_question_id: 'q2', points: 10, order_index: 1 },
  ];
  const latex = renderTestLatex(questions, instances, {
    versionLabel: 'A',
    template: { id: 't1', title: 'Midterm Exam' },
  });
  expect(latex).toContain('\\documentclass');
  expect(latex).toContain('\\begin{document}');
  expect(latex).toContain('\\end{document}');
  expect(latex).toContain('Q1 stem');
  expect(latex).toContain('Q2 stem');
});

test('renderTestLatex with sections', () => {
  const questions: Question[] = [
    { id: 'q1', type: 'multiple_choice', stem: 'Section Q', choices: [{ id: 'c1', text: 'A', is_correct: true }] },
  ];
  const instances: QuestionInstance[] = [
    { id: 'i1', base_question_id: 'q1', points: 3, order_index: 0 },
  ];
  const sections = [
    { id: 's1', name: 'Part One', description: 'Answer all', question_references: [{ question_id: 'q1' }] },
  ];
  const latex = renderTestLatex(questions, instances, {}, sections);
  expect(latex).toContain('\\section*{Part One}');
  expect(latex).toContain('Answer all');
});

test('renderAnswerKeyLatex produces answer key document', () => {
  const questions: Question[] = [
    { id: 'q1', type: 'multiple_choice', stem: 'Q1', choices: [
      { id: 'c1', text: 'A', is_correct: false },
      { id: 'c2', text: 'B', is_correct: true },
    ]},
  ];
  const instances: QuestionInstance[] = [
    { id: 'i1', base_question_id: 'q1', points: 5, order_index: 0 },
  ];
  const answerKey = { 1: ['c2'] };
  const latex = renderAnswerKeyLatex(questions, instances, answerKey, {
    versionLabel: 'A',
    template: { id: 't1', title: 'Test' },
  });
  expect(latex).toContain('Answer Key');
  expect(latex).toContain('Version A');
  expect(latex).toContain('\\textbf{B}');
});

test('renderQuestionLatex handles media refs', () => {
  const q: Question = {
    id: 'q1',
    type: 'short_answer',
    stem: 'Look at the image',
    media_refs: [
      { id: 'm1', path: 'images/fig1.png', placement: 'above', caption: 'Figure 1' },
    ],
  };
  const latex = renderQuestionLatex(q, 0);
  expect(latex).toContain('\\includegraphics');
  expect(latex).toContain('fig1.png');
  expect(latex).toContain('\\caption{Figure 1}');
});
