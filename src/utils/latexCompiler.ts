import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface CompilationResult {
  success: boolean;
  pdfPath?: string;
  log: string;
  errors: CompilationError[];
}

export interface CompilationError {
  line?: number;
  message: string;
}

export type LatexEngine = 'pdflatex' | 'xelatex';

export interface CompileOptions {
  /** LaTeX engine to use; defaults to pdflatex. */
  engine?: LatexEngine;
  /** Custom path to the LaTeX binary (e.g. /usr/local/texlive/bin/pdflatex). */
  enginePath?: string;
  /** Working directory for compilation (temp dir by default). */
  outputDir?: string;
  /** Run twice for references / TOC. */
  doubleRun?: boolean;
}

/** Parse a LaTeX log for errors. */
export function parseLatexLog(log: string): CompilationError[] {
  const errors: CompilationError[] = [];
  const lines = log.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Standard TeX error pattern: ! ErrorMessage
    if (line.startsWith('!')) {
      const message = line.slice(2).trim();
      // Try to extract line number from context (l.NNN ...)
      let lineNum: number | undefined;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const match = lines[j].match(/^l\.(\d+)/);
        if (match) {
          lineNum = parseInt(match[1], 10);
          break;
        }
      }
      errors.push({ line: lineNum, message });
    }
  }
  return errors;
}

/**
 * Compile a LaTeX source string to PDF.
 *
 * This writes the source to a temporary .tex file, invokes the chosen
 * engine, and returns the result.
 */
export async function compileLatex(
  source: string,
  options: CompileOptions = {},
): Promise<CompilationResult> {
  const ALLOWED_ENGINES: LatexEngine[] = ['pdflatex', 'xelatex'];
  const engine = options.engine ?? 'pdflatex';
  if (!ALLOWED_ENGINES.includes(engine)) {
    return { success: false, log: '', errors: [{ message: `Unsupported engine: ${engine}` }] };
  }
  // Validate enginePath – only accept if it ends with an allowed engine name
  let engineBin = engine;
  if (options.enginePath) {
    const base = path.basename(options.enginePath);
    if (!ALLOWED_ENGINES.some((e) => base === e || base === `${e}.exe`)) {
      return { success: false, log: '', errors: [{ message: 'Invalid engine path' }] };
    }
    engineBin = options.enginePath;
  }
  const outDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'proftest-'));
  const texFile = path.join(outDir, 'test.tex');
  fs.writeFileSync(texFile, source, 'utf8');

  const run = (): Promise<string> =>
    new Promise((resolve, reject) => {
      execFile(
        engineBin,
        ['-interaction=nonstopmode', '-halt-on-error', `-output-directory=${outDir}`, texFile],
        { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => {
          // pdflatex returns non-zero on errors but we still want the log
          resolve((stdout ?? '') + (stderr ?? ''));
        },
      );
    });

  let log = await run();
  if (options.doubleRun) {
    log = await run(); // second run for references
  }

  const pdfPath = path.join(outDir, 'test.pdf');
  const pdfExists = fs.existsSync(pdfPath);
  const errors = parseLatexLog(log);

  return {
    success: pdfExists && errors.length === 0,
    pdfPath: pdfExists ? pdfPath : undefined,
    log,
    errors,
  };
}
