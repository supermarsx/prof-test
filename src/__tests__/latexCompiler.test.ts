import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

/*
 * We mock child_process (spawn) and fs so that tests don't require an
 * actual LaTeX installation or filesystem side-effects.
 */

// --- Mock fs ---
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdtempSync: vi.fn(() => '/tmp/proftest-latex-mock'),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
    },
    existsSync: vi.fn(() => false),
    mkdtempSync: vi.fn(() => '/tmp/proftest-latex-mock'),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

// --- Mock child_process ---
vi.mock('child_process', () => {
  const EventEmitter = require('events');

  function createMockProcess(exitCode: number, stdout = '', stderr = '') {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();

    // Emit data and close on next tick so the promise in runLatexProcess resolves
    setTimeout(() => {
      if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
      if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
      proc.emit('close', exitCode);
    }, 10);

    return proc;
  }

  return {
    spawn: vi.fn(() => createMockProcess(1, '', 'pdflatex not found')),
  };
});

// Import after mocks are set up
import { detectLatexInstallation, compileLatex } from '../utils/latexCompiler';
import type { CompilerOptions } from '../utils/latexCompiler';
import fs from 'fs';
import { spawn } from 'child_process';

/* ------------------------------------------------------------------ */
/*  detectLatexInstallation                                            */
/* ------------------------------------------------------------------ */

describe('detectLatexInstallation', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  test('returns an object with found boolean and engines array', () => {
    const result = detectLatexInstallation();
    expect(result).toHaveProperty('found');
    expect(typeof result.found).toBe('boolean');
    expect(result).toHaveProperty('engines');
    expect(Array.isArray(result.engines)).toBe(true);
  });

  test('returns { found: false } when no LaTeX is installed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = detectLatexInstallation();
    expect(result.found).toBe(false);
    expect(result.engines).toHaveLength(0);
    expect(result.path).toBeUndefined();
  });

  test('returns { found: true } when pdflatex exists at a known path', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      // Match any path that ends with pdflatex or pdflatex.exe
      if (s.endsWith('pdflatex') || s.endsWith('pdflatex.exe')) {
        return true;
      }
      return false;
    });

    const result = detectLatexInstallation();
    expect(result.found).toBe(true);
    expect(result.path).toBeDefined();
    expect(result.engines).toContain('pdflatex');
  });

  test('path property is a string when found', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('pdflatex') || s.endsWith('pdflatex.exe')) return true;
      return false;
    });

    const result = detectLatexInstallation();
    expect(typeof result.path).toBe('string');
  });
});

/* ------------------------------------------------------------------ */
/*  compileLatex                                                       */
/* ------------------------------------------------------------------ */

describe('compileLatex', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/proftest-latex-mock');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.rmSync).mockImplementation(() => {});
  });

  test('returns a CompilationResult object', async () => {
    const result = await compileLatex('\\documentclass{article}', 'test.tex');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('log');
    expect(result).toHaveProperty('errors');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.log).toBe('string');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test('returns failure when compilation fails (non-zero exit)', async () => {
    const result = await compileLatex('bad latex', 'test.tex');
    expect(result.success).toBe(false);
  });

  test('returns errors array with messages on failure', async () => {
    const result = await compileLatex('bad latex', 'test.tex');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('pdfPath is undefined on failure', async () => {
    const result = await compileLatex('bad', 'test.tex');
    expect(result.pdfPath).toBeUndefined();
  });

  test('respects engine option', async () => {
    await compileLatex('\\documentclass{article}', 'test.tex', { engine: 'xelatex' });
    // The spawn mock should have been called; we just verify no crash
    expect(spawn).toHaveBeenCalled();
  });

  test('appends .tex extension if missing from filename', async () => {
    const result = await compileLatex('\\documentclass{article}', 'myfile');
    // Should not throw; internally it adds .tex
    expect(result).toHaveProperty('success');
  });

  test('handles spawn error event gracefully', async () => {
    const EventEmitter = require('events');
    vi.mocked(spawn).mockImplementationOnce((() => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn();
      setTimeout(() => {
        proc.emit('error', new Error('ENOENT: pdflatex not found'));
      }, 10);
      return proc;
    }) as any);

    const result = await compileLatex('\\documentclass{article}', 'test.tex');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('pdflatex') || e.includes('ENOENT'))).toBe(true);
  });

  test('cleans up temp directory even on failure', async () => {
    await compileLatex('bad', 'test.tex');
    expect(fs.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('proftest-latex'),
      expect.objectContaining({ recursive: true }),
    );
  });

  test('returns success with pdfPath when PDF is produced', async () => {
    // Make existsSync return true for the output PDF
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('.pdf')) return true;
      // Also return true for the output directory check
      if (s.includes('proftest-output')) return true;
      return false;
    });

    // Mock spawn to exit with code 0
    const EventEmitter = require('events');
    vi.mocked(spawn).mockImplementationOnce((() => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn();
      setTimeout(() => {
        proc.stdout.emit('data', Buffer.from('Output written on test.pdf'));
        proc.emit('close', 0);
      }, 10);
      return proc;
    }) as any);

    const result = await compileLatex('\\documentclass{article}\\begin{document}Hello\\end{document}', 'test.tex');
    expect(result.success).toBe(true);
    expect(result.pdfPath).toBeDefined();
    expect(result.pdfPath!.endsWith('.pdf')).toBe(true);
  });
});
