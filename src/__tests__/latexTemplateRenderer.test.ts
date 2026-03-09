import { test, expect } from 'vitest';
import {
  renderPreamble,
  renderHeader,
  renderTestDocument,
  renderAssembledTest,
} from '../utils/latexTemplateRenderer';
import { parseLatexLog } from '../utils/latexCompiler';
import { createAssembledTest, addSection, addQuestionToSection, toggleQuestionIncluded } from '../utils/testAssembler';
import { HeaderPreset, LayoutPreset, Question, SectionDefinition, TestTemplate } from '../models';

test('renderPreamble includes document class with font size', () => {
  const layout: LayoutPreset = { id: 'l1', name: 'Default', scope: 'project', base_font_size: 11 };
  const result = renderPreamble(layout);
  expect(result).toContain('\\documentclass[11pt]{article}');
  expect(result).toContain('\\usepackage[utf8]{inputenc}');
});

test('renderPreamble includes geometry when margins set', () => {
  const layout: LayoutPreset = {
    id: 'l1',
    name: 'Default',
    scope: 'project',
    page_margins: { top: 20, bottom: 20, left: 25, right: 25 },
  };
  const result = renderPreamble(layout);
  expect(result).toContain('geometry');
  expect(result).toContain('top=20mm');
});

test('renderPreamble includes line spacing', () => {
  const layout: LayoutPreset = { id: 'l1', name: 'Default', scope: 'project', line_spacing: 1.5 };
  const result = renderPreamble(layout);
  expect(result).toContain('setspace');
  expect(result).toContain('\\setstretch{1.5}');
});

test('renderHeader produces center block from fields_config', () => {
  const header: HeaderPreset = {
    id: 'h1',
    name: 'Midterm Exam',
    scope: 'global',
    fields_config: {
      show_date: true,
      student_name_line: true,
      student_id_line: true,
    },
  };
  const result = renderHeader(header, 'A');
  expect(result).toContain('\\begin{center}');
  expect(result).toContain('Midterm Exam');
  expect(result).toContain('Version A');
  expect(result).toContain('\\today');
  expect(result).toContain('Name:');
  expect(result).toContain('ID:');
});

test('renderHeader uses latex_snippet when provided', () => {
  const header: HeaderPreset = {
    id: 'h1',
    name: 'Custom',
    scope: 'global',
    latex_snippet: '\\textbf{Test {{version}}}',
  };
  const result = renderHeader(header, 'B');
  expect(result).toBe('\\textbf{Test B}');
});

test('renderTestDocument produces complete document', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      type: 'multiple_choice',
      stem: 'What is 2+2?',
      choices: [
        { id: 'c1', text: '3' },
        { id: 'c2', text: '4', is_correct: true },
      ],
    },
    { id: 'q2', type: 'short_answer', stem: 'Define gravity.' },
  ];
  const doc = renderTestDocument('Quiz 1', questions);
  expect(doc).toContain('\\begin{document}');
  expect(doc).toContain('\\end{document}');
  expect(doc).toContain('Quiz 1');
  expect(doc).toContain('What is 2+2?');
  expect(doc).toContain('Define gravity.');
  expect(doc).toContain('\\begin{enumerate}[label=\\Alph*)]');
});

test('renderAssembledTest omits excluded questions', () => {
  const template: TestTemplate = { id: 't1', title: 'Final' };
  const sec: SectionDefinition = { id: 's1', name: 'Part 1' };
  const q1: Question = { id: 'q1', type: 'short_answer', stem: 'Visible' };
  const q2: Question = { id: 'q2', type: 'short_answer', stem: 'Hidden' };
  let t = createAssembledTest(template);
  t = addSection(t, sec);
  t = addQuestionToSection(t, 's1', q1);
  t = addQuestionToSection(t, 's1', q2);
  const instanceId = t.sections[0].questions[1].instance.id;
  t = toggleQuestionIncluded(t, 's1', instanceId);
  const doc = renderAssembledTest(t);
  expect(doc).toContain('Visible');
  expect(doc).not.toContain('Hidden');
  expect(doc).toContain('Part 1');
});

test('renderAssembledTest shows points when layout says so', () => {
  const template: TestTemplate = { id: 't1', title: 'Test' };
  const sec: SectionDefinition = { id: 's1', name: 'Questions' };
  const q1: Question = { id: 'q1', type: 'short_answer', stem: 'Stem1' };
  let t = createAssembledTest(template);
  t = addSection(t, sec);
  t = addQuestionToSection(t, 's1', q1, 5);
  const layout: LayoutPreset = { id: 'l1', name: 'L', scope: 'project', show_points_inline: true };
  const doc = renderAssembledTest(t, { layout });
  expect(doc).toContain('5 pts');
});

// latexCompiler – parseLatexLog
test('parseLatexLog extracts errors with line numbers', () => {
  const log = [
    'This is pdfTeX',
    '! Undefined control sequence.',
    'l.12 \\badcommand',
    '                 ',
    '! Missing $ inserted.',
    'l.25 x^2',
  ].join('\n');
  const errors = parseLatexLog(log);
  expect(errors).toHaveLength(2);
  expect(errors[0].message).toBe('Undefined control sequence.');
  expect(errors[0].line).toBe(12);
  expect(errors[1].message).toBe('Missing $ inserted.');
  expect(errors[1].line).toBe(25);
});

test('parseLatexLog returns empty for clean log', () => {
  const log = 'Output written on test.pdf (1 page).\nTranscript written on test.log.';
  expect(parseLatexLog(log)).toHaveLength(0);
});
