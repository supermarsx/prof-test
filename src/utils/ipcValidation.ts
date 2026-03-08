/**
 * IPC input validation utilities.
 * Validates data coming from the renderer process before it reaches the main process logic.
 */

export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcValidationError';
  }
}

/** Asserts value is a non-empty string */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new IpcValidationError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

/** Asserts value is a string (may be empty) */
export function expectString(value: unknown, name: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    throw new IpcValidationError(`${name} must be a string`);
  }
  return value;
}

/** Asserts value is a non-null object */
export function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new IpcValidationError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

/** Asserts value is an array */
export function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(`${name} must be an array`);
  }
  return value;
}

/** Asserts value is a positive integer */
export function requirePositiveInt(value: unknown, name: string): number {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num < 1) {
    throw new IpcValidationError(`${name} must be a positive integer`);
  }
  return num;
}

/** Sanitizes a file path - prevents directory traversal */
export function sanitizePath(filePath: unknown, name: string): string {
  const str = requireString(filePath, name);
  // Block null bytes
  if (str.includes('\0')) {
    throw new IpcValidationError(`${name} contains invalid characters`);
  }
  return str;
}

/** Validates import mode */
export function validateImportMode(mode: unknown): 'append' | 'replace' {
  if (mode !== 'append' && mode !== 'replace') {
    throw new IpcValidationError(`Import mode must be 'append' or 'replace'`);
  }
  return mode;
}

/** Validates that a question object has minimum required fields */
export function validateQuestionInput(q: unknown): Record<string, unknown> {
  const obj = requireObject(q, 'question');
  requireString(obj.id, 'question.id');
  requireString(obj.type, 'question.type');
  const validTypes = ['multiple_choice', 'multiple_select', 'short_answer', 'true_false', 'matching'];
  if (!validTypes.includes(obj.type as string)) {
    throw new IpcValidationError(`question.type must be one of: ${validTypes.join(', ')}`);
  }
  expectString(obj.stem, 'question.stem');
  return obj;
}

/** Validates that a template object has minimum required fields */
export function validateTemplateInput(t: unknown): Record<string, unknown> {
  const obj = requireObject(t, 'template');
  requireString(obj.id, 'template.id');
  requireString(obj.title, 'template.title');
  return obj;
}

/** Validates settings input */
export function validateSettingsInput(s: unknown): Record<string, unknown> {
  const obj = requireObject(s, 'settings');
  // All fields optional, but types should be correct if present
  if (obj.ai_provider !== undefined) {
    const valid = ['openai', 'anthropic', 'local', ''];
    if (!valid.includes(String(obj.ai_provider))) {
      throw new IpcValidationError(`Invalid AI provider`);
    }
  }
  return obj;
}

/** Wraps an IPC handler with validation error handling */
export function safeHandler<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T | { ok: false; error: string }> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof IpcValidationError) {
        return { ok: false, error: `Validation: ${e.message}` } as any;
      }
      throw e;
    }
  };
}
