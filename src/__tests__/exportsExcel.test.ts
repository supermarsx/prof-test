import { describe, test, expect } from 'vitest';
import {
  buildGradingMatrixWorkbook,
  buildResponseImportTemplate,
  buildMixedClassGradingWorkbook,
} from '../utils/exportsExcel';
import type { TestInstance } from '../models';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeVersion(
  label: string,
  questionCount: number,
  answerKey?: Record<string, any>,
): TestInstance {
  const questions = Array.from({ length: questionCount }, (_, i) => ({
    id: `qi-${label}-${i + 1}`,
    base_question_id: `q${i + 1}`,
    points: (i + 1) * 2,
  }));
  const key: Record<string, any> = {};
  if (answerKey) {
    Object.assign(key, answerKey);
  } else {
    for (let i = 0; i < questionCount; i++) {
      key[i + 1] = String.fromCharCode(65 + (i % 4)); // A, B, C, D, A, ...
    }
  }
  return {
    id: `v-${label}`,
    version_label: label,
    generated_questions: questions,
    answer_key: key,
  };
}

/* ------------------------------------------------------------------ */
/*  buildGradingMatrixWorkbook                                         */
/* ------------------------------------------------------------------ */

describe('buildGradingMatrixWorkbook', () => {
  test('returns a Buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildGradingMatrixWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('returns a non-zero-length buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildGradingMatrixWorkbook('test-1', versions);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('works with empty versions array', () => {
    const buf = buildGradingMatrixWorkbook('test-empty', []);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('works with a version that has zero questions', () => {
    const versions: TestInstance[] = [
      { id: 'v1', version_label: 'Empty', generated_questions: [], answer_key: {} },
    ];
    const buf = buildGradingMatrixWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles multiple versions', () => {
    const versions = [
      makeVersion('A', 5),
      makeVersion('B', 5),
      makeVersion('C', 3),
    ];
    const buf = buildGradingMatrixWorkbook('test-multi', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles version with array answer keys (multiple select)', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'MS',
        generated_questions: [
          { id: 'qi1', base_question_id: 'q1', points: 3 },
        ],
        answer_key: { 1: ['A', 'C'] },
      },
    ];
    const buf = buildGradingMatrixWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles version without answer_key', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'NoKey',
        generated_questions: [
          { id: 'qi1', base_question_id: 'q1', points: 2 },
        ],
      },
    ];
    const buf = buildGradingMatrixWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('produces larger buffer for more questions', () => {
    const small = buildGradingMatrixWorkbook('t', [makeVersion('A', 1)]);
    const large = buildGradingMatrixWorkbook('t', [makeVersion('A', 20)]);
    expect(large.length).toBeGreaterThan(small.length);
  });
});

/* ------------------------------------------------------------------ */
/*  buildResponseImportTemplate                                        */
/* ------------------------------------------------------------------ */

describe('buildResponseImportTemplate', () => {
  test('returns a Buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildResponseImportTemplate('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('returns a non-zero-length buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildResponseImportTemplate('test-1', versions);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('throws on empty versions array (workbook has no sheets)', () => {
    // XLSX.write throws when the workbook contains zero sheets
    expect(() => buildResponseImportTemplate('test-empty', [])).toThrow('Workbook is empty');
  });

  test('works with a version that has zero questions', () => {
    const versions: TestInstance[] = [
      { id: 'v1', version_label: 'Empty', generated_questions: [], answer_key: {} },
    ];
    const buf = buildResponseImportTemplate('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles multiple versions', () => {
    const versions = [makeVersion('A', 3), makeVersion('B', 5)];
    const buf = buildResponseImportTemplate('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('uses "Default" as fallback label for empty version_label', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: '',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 1 }],
        answer_key: { 1: 'A' },
      },
    ];
    // Should not throw; the function falls back to 'Default' for sheet naming
    const buf = buildResponseImportTemplate('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  buildMixedClassGradingWorkbook                                     */
/* ------------------------------------------------------------------ */

describe('buildMixedClassGradingWorkbook', () => {
  test('returns a Buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildMixedClassGradingWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('returns a non-zero-length buffer', () => {
    const versions = [makeVersion('A', 3)];
    const buf = buildMixedClassGradingWorkbook('test-1', versions);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('works with empty versions array', () => {
    const buf = buildMixedClassGradingWorkbook('test-empty', []);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('works with a version that has zero questions', () => {
    const versions: TestInstance[] = [
      { id: 'v1', version_label: 'Empty', generated_questions: [], answer_key: {} },
    ];
    const buf = buildMixedClassGradingWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles multiple versions with different question counts', () => {
    const versions = [
      makeVersion('A', 3),
      makeVersion('B', 5),
      makeVersion('C', 2),
    ];
    const buf = buildMixedClassGradingWorkbook('test-mixed', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles versions without version_label', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        generated_questions: [{ id: 'qi1', base_question_id: 'q1', points: 5 }],
        answer_key: { 1: 'B' },
      },
    ];
    const buf = buildMixedClassGradingWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('handles version with points of zero', () => {
    const versions: TestInstance[] = [
      {
        id: 'v1',
        version_label: 'Zero',
        generated_questions: [
          { id: 'qi1', base_question_id: 'q1', points: 0 },
          { id: 'qi2', base_question_id: 'q2', points: 0 },
        ],
        answer_key: { 1: 'A', 2: 'B' },
      },
    ];
    const buf = buildMixedClassGradingWorkbook('test-1', versions);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('produces larger buffer for more versions/questions', () => {
    const small = buildMixedClassGradingWorkbook('t', [makeVersion('A', 1)]);
    const large = buildMixedClassGradingWorkbook('t', [
      makeVersion('A', 10),
      makeVersion('B', 10),
      makeVersion('C', 10),
    ]);
    expect(large.length).toBeGreaterThan(small.length);
  });
});
