import { describe, test, expect } from 'vitest';
import { buildAnswerKeyCsv, buildQuestionMetadataCsv } from '../utils/exports';
import type { Question, TestInstance } from '../models';

/* ------------------------------------------------------------------ */
/*  buildAnswerKeyCsv                                                  */
/* ------------------------------------------------------------------ */

describe('buildAnswerKeyCsv', () => {
  test('returns only the header row for empty versions array', () => {
    const csv = buildAnswerKeyCsv('test-empty', []);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Test ID,Version,Question Number,Question ID,Correct Answers,Points');
  });

  test('returns only the header row when version has no questions', () => {
    const versions: TestInstance[] = [
      { id: 'v1', version_label: 'A', generated_questions: [], answer_key: {} },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });

  test('includes correct header columns', () => {
    const csv = buildAnswerKeyCsv('t', []);
    const header = csv.split('\n')[0];
    expect(header).toContain('Test ID');
    expect(header).toContain('Version');
    expect(header).toContain('Question Number');
    expect(header).toContain('Question ID');
    expect(header).toContain('Correct Answers');
    expect(header).toContain('Points');
  });

  test('emits one row per question per version', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [
          { id: 'qi1', base_question_id: 'q1', points: 5 },
          { id: 'qi2', base_question_id: 'q2', points: 10 },
        ],
        answer_key: { 1: 'B', 2: 'C' },
      },
      {
        id: 'v2',
        version_label: 'B',
        generated_questions: [
          { id: 'qi3', base_question_id: 'q1', points: 5 },
        ],
        answer_key: { 1: 'A' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const lines = csv.split('\n');
    // header + 2 questions (version A) + 1 question (version B)
    expect(lines).toHaveLength(4);
  });

  test('includes test ID and version label in each row', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'Version-X',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 3 }],
        answer_key: { 1: 'A' },
      },
    ];
    const csv = buildAnswerKeyCsv('my-test', versions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('my-test');
    expect(dataLine).toContain('Version-X');
  });

  test('handles array answer keys (multiple select)', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 2 }],
        answer_key: { 1: ['A', 'C'] },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const dataLine = csv.split('\n')[1];
    // Array answers are joined with semicolons
    expect(dataLine).toContain('A;C');
  });

  test('handles missing answer_key gracefully', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 1 }],
        // no answer_key
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    // The answer column should be empty string
    const cols = lines[1].split(',');
    expect(cols[4]).toBe('');
  });

  test('handles missing version_label', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1' }],
        answer_key: { 1: 'D' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(',');
    // version_label column should be empty
    expect(cols[1]).toBe('');
  });

  test('uses base_question_id when present, falls back to id', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [
          { id: 'qi1', base_question_id: 'original-q1', points: 1 },
          { id: 'qi2', points: 2 }, // no base_question_id
        ],
        answer_key: { 1: 'A', 2: 'B' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('original-q1');
    expect(lines[2]).toContain('qi2');
  });

  test('handles points being undefined', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1' }],
        answer_key: { 1: 'X' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(',');
    // Points column is last; should be empty string
    expect(cols[5]).toBe('');
  });

  test('escapes commas in values', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A,B',
        generated_questions: [{ id: 'qi1', base_question_id: 'q,1', points: 1 }],
        answer_key: { 1: 'yes' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    // Commas in fields should be wrapped in quotes
    expect(csv).toContain('"A,B"');
    expect(csv).toContain('"q,1"');
  });

  test('escapes double quotes in values', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'He said "hello"',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 1 }],
        answer_key: { 1: 'A' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    // Double quotes in fields should be doubled and wrapped
    expect(csv).toContain('"He said ""hello"""');
  });

  test('question numbering is 1-indexed', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'A',
        generated_questions: [
          { id: 'qi1', base_question_id: 'q1', points: 1 },
          { id: 'qi2', base_question_id: 'q2', points: 2 },
          { id: 'qi3', base_question_id: 'q3', points: 3 },
        ],
        answer_key: { 1: 'A', 2: 'B', 3: 'C' },
      },
    ];
    const csv = buildAnswerKeyCsv('test-1', versions);
    const lines = csv.split('\n');
    expect(lines[1].split(',')[2]).toBe('1');
    expect(lines[2].split(',')[2]).toBe('2');
    expect(lines[3].split(',')[2]).toBe('3');
  });
});

/* ------------------------------------------------------------------ */
/*  buildQuestionMetadataCsv                                           */
/* ------------------------------------------------------------------ */

describe('buildQuestionMetadataCsv', () => {
  test('returns only the header row for empty questions array', () => {
    const csv = buildQuestionMetadataCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Question ID');
  });

  test('header contains all expected columns', () => {
    const csv = buildQuestionMetadataCsv([]);
    const header = csv.split('\n')[0];
    const expectedColumns = [
      'Question ID',
      'Subject',
      'Topic',
      'Difficulty',
      'Tags',
      'Estimated Time (min)',
      'Usage Count',
      'Last Used',
    ];
    for (const col of expectedColumns) {
      expect(header).toContain(col);
    }
  });

  test('emits one row per question', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'What?' },
      { id: 'q2', type: 'short_answer', stem: 'Why?' },
      { id: 'q3', type: 'true_false', stem: 'True?' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // header + 3 rows
  });

  test('includes subject, topic, and difficulty', () => {
    const questions: Question[] = [
      {
        id: 'q1',
        type: 'multiple_choice',
        stem: 'Test',
        subject: 'Math',
        topic: 'Algebra',
        difficulty: 3,
      },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('Math');
    expect(dataLine).toContain('Algebra');
    expect(dataLine).toContain('3');
  });

  test('joins tags with semicolons', () => {
    const questions: Question[] = [
      {
        id: 'q1',
        type: 'multiple_choice',
        stem: 'Test',
        tags: ['algebra', 'midterm', 'easy'],
      },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('algebra;midterm;easy');
  });

  test('handles empty tags array', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test', tags: [] },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    // Tags column should be empty; no error
    const cols = dataLine.split(',');
    expect(cols[4]).toBe('');
  });

  test('handles undefined tags', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'short_answer', stem: 'Why?' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
  });

  test('includes estimated_time_min', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test', estimated_time_min: 5 },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('5');
  });

  test('includes usage_count field', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test', usage_count: 12 },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('12');
  });

  test('defaults usage_count to 0 when undefined', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(',');
    // usage_count is column index 6
    expect(cols[6]).toBe('0');
  });

  test('includes last_used_at field', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test', last_used_at: '2025-01-15T10:30:00Z' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('2025-01-15T10:30:00Z');
  });

  test('last_used_at is empty when undefined', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(',');
    // last_used_at is the last column (index 7)
    expect(cols[7]).toBe('');
  });

  test('handles all optional fields being undefined', () => {
    const questions: Question[] = [
      { id: 'q-only', type: 'multiple_choice', stem: 'Bare minimum' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    const cols = lines[1].split(',');
    expect(cols[0]).toBe('q-only');
    expect(cols[1]).toBe(''); // subject
    expect(cols[2]).toBe(''); // topic
    expect(cols[3]).toBe(''); // difficulty
    expect(cols[4]).toBe(''); // tags
    expect(cols[5]).toBe(''); // estimated_time_min
    expect(cols[6]).toBe('0'); // usage_count defaults to '0'
    expect(cols[7]).toBe(''); // last_used_at
  });

  test('escapes values with commas', () => {
    const questions: Question[] = [
      { id: 'q1', type: 'multiple_choice', stem: 'Test', subject: 'Math, Science' },
    ];
    const csv = buildQuestionMetadataCsv(questions);
    expect(csv).toContain('"Math, Science"');
  });
});
