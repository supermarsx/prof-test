import { test, expect, describe } from 'vitest';
import {
  requireString,
  expectString,
  requireObject,
  requireArray,
  requirePositiveInt,
  sanitizePath,
  validateImportMode,
  validateQuestionInput,
  validateTemplateInput,
  validateSettingsInput,
  safeHandler,
  IpcValidationError,
} from '../utils/ipcValidation';

describe('requireString', () => {
  test('returns trimmed string for valid input', () => {
    expect(requireString('hello', 'field')).toBe('hello');
    expect(requireString('  spaced  ', 'field')).toBe('spaced');
  });
  test('throws for empty string', () => {
    expect(() => requireString('', 'field')).toThrow(IpcValidationError);
    expect(() => requireString('   ', 'field')).toThrow(IpcValidationError);
  });
  test('throws for non-string', () => {
    expect(() => requireString(123, 'field')).toThrow(IpcValidationError);
    expect(() => requireString(null, 'field')).toThrow(IpcValidationError);
    expect(() => requireString(undefined, 'field')).toThrow(IpcValidationError);
  });
});

describe('expectString', () => {
  test('returns string for valid input', () => {
    expect(expectString('hello', 'field')).toBe('hello');
  });
  test('returns empty string for null/undefined', () => {
    expect(expectString(null, 'field')).toBe('');
    expect(expectString(undefined, 'field')).toBe('');
  });
  test('throws for non-string, non-null', () => {
    expect(() => expectString(123, 'field')).toThrow(IpcValidationError);
  });
});

describe('requireObject', () => {
  test('returns object for valid input', () => {
    const obj = { a: 1 };
    expect(requireObject(obj, 'field')).toBe(obj);
  });
  test('throws for null', () => {
    expect(() => requireObject(null, 'field')).toThrow(IpcValidationError);
  });
  test('throws for array', () => {
    expect(() => requireObject([1, 2], 'field')).toThrow(IpcValidationError);
  });
  test('throws for primitive', () => {
    expect(() => requireObject('str', 'field')).toThrow(IpcValidationError);
  });
});

describe('requireArray', () => {
  test('returns array for valid input', () => {
    const arr = [1, 2, 3];
    expect(requireArray(arr, 'field')).toBe(arr);
  });
  test('throws for non-array', () => {
    expect(() => requireArray({}, 'field')).toThrow(IpcValidationError);
    expect(() => requireArray('str', 'field')).toThrow(IpcValidationError);
  });
});

describe('requirePositiveInt', () => {
  test('returns number for valid integer', () => {
    expect(requirePositiveInt(1, 'field')).toBe(1);
    expect(requirePositiveInt(42, 'field')).toBe(42);
  });
  test('parses string to integer', () => {
    expect(requirePositiveInt('5', 'field')).toBe(5);
  });
  test('throws for zero or negative', () => {
    expect(() => requirePositiveInt(0, 'field')).toThrow(IpcValidationError);
    expect(() => requirePositiveInt(-1, 'field')).toThrow(IpcValidationError);
  });
  test('throws for float', () => {
    expect(() => requirePositiveInt(1.5, 'field')).toThrow(IpcValidationError);
  });
});

describe('sanitizePath', () => {
  test('returns trimmed path', () => {
    expect(sanitizePath('/some/path', 'p')).toBe('/some/path');
  });
  test('throws for null bytes', () => {
    expect(() => sanitizePath('/some\0/path', 'p')).toThrow(IpcValidationError);
  });
  test('throws for non-string', () => {
    expect(() => sanitizePath(123, 'p')).toThrow(IpcValidationError);
  });
});

describe('validateImportMode', () => {
  test('accepts append and replace', () => {
    expect(validateImportMode('append')).toBe('append');
    expect(validateImportMode('replace')).toBe('replace');
  });
  test('throws for invalid mode', () => {
    expect(() => validateImportMode('merge')).toThrow(IpcValidationError);
    expect(() => validateImportMode(undefined)).toThrow(IpcValidationError);
  });
});

describe('validateQuestionInput', () => {
  test('accepts valid question', () => {
    const q = { id: 'q1', type: 'multiple_choice', stem: 'What?' };
    expect(validateQuestionInput(q)).toBe(q);
  });
  test('throws for missing id', () => {
    expect(() => validateQuestionInput({ type: 'multiple_choice', stem: 'What?' }))
      .toThrow(IpcValidationError);
  });
  test('throws for invalid type', () => {
    expect(() => validateQuestionInput({ id: 'q1', type: 'essay', stem: 'What?' }))
      .toThrow(IpcValidationError);
  });
  test('accepts all valid question types', () => {
    for (const type of ['multiple_choice', 'multiple_select', 'short_answer', 'true_false', 'matching']) {
      expect(validateQuestionInput({ id: 'q1', type, stem: '' })).toBeDefined();
    }
  });
});

describe('validateTemplateInput', () => {
  test('accepts valid template', () => {
    const t = { id: 't1', title: 'My Test' };
    expect(validateTemplateInput(t)).toBe(t);
  });
  test('throws for missing title', () => {
    expect(() => validateTemplateInput({ id: 't1' })).toThrow(IpcValidationError);
  });
});

describe('validateSettingsInput', () => {
  test('accepts valid settings', () => {
    const s = { ai_provider: 'openai' };
    expect(validateSettingsInput(s)).toBe(s);
  });
  test('accepts empty settings', () => {
    expect(validateSettingsInput({})).toEqual({});
  });
  test('throws for invalid ai_provider', () => {
    expect(() => validateSettingsInput({ ai_provider: 'invalid' })).toThrow(IpcValidationError);
  });
  test('throws for non-object', () => {
    expect(() => validateSettingsInput('hello')).toThrow(IpcValidationError);
  });
});

describe('safeHandler', () => {
  test('passes through successful results', async () => {
    const fn = safeHandler(async () => ({ ok: true, data: 42 }));
    const result = await fn();
    expect(result).toEqual({ ok: true, data: 42 });
  });

  test('catches IpcValidationError and returns ok:false', async () => {
    const fn = safeHandler(async () => {
      throw new IpcValidationError('bad input');
    });
    const result = await fn();
    expect(result).toEqual({ ok: false, error: 'Validation: bad input' });
  });

  test('re-throws non-validation errors', async () => {
    const fn = safeHandler(async () => {
      throw new Error('unexpected');
    });
    await expect(fn()).rejects.toThrow('unexpected');
  });
});
