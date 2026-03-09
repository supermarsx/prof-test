import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CompilationResult {
  success: boolean;
  pdfPath?: string;
  log: string;
  errors: string[];
}

export interface CompilationError {
  line?: number;
  message: string;
}

export type LatexEngine = 'pdflatex' | 'xelatex';

export interface CompilerOptions {
  engine?: LatexEngine;
  latexPath?: string;
  enginePath?: string;
  outputDir?: string;
  runs?: number;
  doubleRun?: boolean;
  timeout?: number;
}

export type CompileOptions = CompilerOptions;

function getBundledTinyTexPaths(): string[] {
  const candidates: string[] = [];
  const platform = process.platform;

  try {
    const exeDir = path.dirname(process.execPath);
    const resourceDirs = [
      path.join(exeDir, 'resources', 'tinytex'),
      path.join(exeDir, '..', 'resources', 'tinytex'),
      path.join(exeDir, 'tinytex'),
    ];
    for (const rd of resourceDirs) {
      if (platform === 'win32') {
        candidates.push(path.join(rd, 'bin', 'windows'));
        candidates.push(path.join(rd, 'bin', 'win32'));
      } else if (platform === 'darwin') {
        candidates.push(path.join(rd, 'bin', 'universal-darwin'));
        candidates.push(path.join(rd, 'bin', 'x86_64-darwin'));
        candidates.push(path.join(rd, 'bin', 'aarch64-darwin'));
      } else {
        candidates.push(path.join(rd, 'bin', 'x86_64-linux'));
        candidates.push(path.join(rd, 'bin', 'aarch64-linux'));
      }
    }
  } catch {}

  const home = os.homedir();
  if (platform === 'win32') {
    candidates.push(path.join(home, 'AppData', 'Roaming', 'TinyTeX', 'bin', 'windows'));
    candidates.push(path.join(home, 'AppData', 'Roaming', 'TinyTeX', 'bin', 'win32'));
  } else if (platform === 'darwin') {
    candidates.push(path.join(home, 'Library', 'TinyTeX', 'bin', 'universal-darwin'));
    candidates.push(path.join(home, 'Library', 'TinyTeX', 'bin', 'x86_64-darwin'));
    candidates.push(path.join(home, '.TinyTeX', 'bin', 'x86_64-darwin'));
  } else {
    candidates.push(path.join(home, '.TinyTeX', 'bin', 'x86_64-linux'));
    candidates.push(path.join(home, '.TinyTeX', 'bin', 'aarch64-linux'));
  }

  return candidates;
}

function findLatexEngine(engine: LatexEngine, customPath?: string): string {
  if (customPath) {
    const fullPath = path.join(customPath, engine + (process.platform === 'win32' ? '.exe' : ''));
    if (fs.existsSync(fullPath)) return fullPath;
    if (fs.existsSync(customPath)) return customPath;
  }
  return engine;
}

export function detectLatexInstallation(): { found: boolean; path?: string; engines: string[]; bundled?: boolean } {
  const bundledPaths = getBundledTinyTexPaths();
  for (const p of bundledPaths) {
    const engines = ['pdflatex', 'xelatex'].filter((eng) =>
      fs.existsSync(path.join(p, eng + (process.platform === 'win32' ? '.exe' : ''))),
    );
    if (engines.length > 0) {
      return { found: true, path: p, engines, bundled: true };
    }
  }

  const commonPaths = process.platform === 'win32'
    ? [
        'C:\\texlive\\2024\\bin\\windows',
        'C:\\texlive\\2023\\bin\\windows',
        'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
        'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin',
      ]
    : process.platform === 'darwin'
      ? ['/Library/TeX/texbin', '/usr/texbin', '/usr/local/texlive/2024/bin/universal-darwin']
      : ['/usr/bin', '/usr/local/bin', '/usr/share/texlive/bin'];

  for (const p of commonPaths) {
    const engines = ['pdflatex', 'xelatex'].filter((eng) =>
      fs.existsSync(path.join(p, eng + (process.platform === 'win32' ? '.exe' : ''))),
    );
    if (engines.length > 0) {
      return { found: true, path: p, engines };
    }
  }

  return { found: false, engines: [] };
}

export function parseLatexLog(log: string): CompilationError[] {
  const errors: CompilationError[] = [];
  const lines = log.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('!')) continue;
    const message = line.slice(1).trim();
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
  return errors;
}

function parseLatexErrors(log: string): string[] {
  const errors: string[] = [];
  for (const line of log.split('\n')) {
    if (line.startsWith('!')) errors.push(line.trim());
    if (line.includes('Fatal error') || line.includes('Emergency stop')) errors.push(line.trim());
  }
  return errors;
}

function runLatexProcess(
  binaryPath: string,
  texFile: string,
  workDir: string,
  timeout: number,
): Promise<{ success: boolean; log: string; errors: string[] }> {
  return new Promise((resolve) => {
    const args = ['-interaction=nonstopmode', '-halt-on-error', `-output-directory=${workDir}`, texFile];
    let log = '';
    const errors: string[] = [];
    let killed = false;

    const proc = spawn(binaryPath, args, { cwd: workDir, timeout });

    proc.stdout?.on('data', (data: Buffer) => {
      log += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      log += text;
      errors.push(text.trim());
    });

    const timer = setTimeout(() => {
      killed = true;
      try { proc.kill('SIGTERM'); } catch {}
      resolve({ success: false, log, errors: [...errors, 'Compilation timed out'] });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;
      errors.push(...parseLatexErrors(log));
      resolve({ success: code === 0, log, errors });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        log,
        errors: [...errors, `Failed to start ${binaryPath}: ${err.message}`],
      });
    });
  });
}

export async function compileLatex(
  latexSource: string,
  filename: string,
  options: CompilerOptions = {},
): Promise<CompilationResult> {
  const engine = options.engine || 'pdflatex';
  const runs = options.runs || (options.doubleRun ? 2 : 1);
  const timeout = options.timeout || 60000;

  let latexPath = options.latexPath || options.enginePath;
  if (!latexPath) {
    const detected = detectLatexInstallation();
    if (detected.found && detected.path) latexPath = detected.path;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proftest-latex-'));
  const texFile = path.join(tmpDir, filename.endsWith('.tex') ? filename : `${filename}.tex`);

  try {
    fs.writeFileSync(texFile, latexSource, 'utf8');

    const binaryPath = findLatexEngine(engine, latexPath);
    let fullLog = '';
    const errors: string[] = [];

    for (let run = 0; run < runs; run++) {
      const result = await runLatexProcess(binaryPath, texFile, tmpDir, timeout);
      fullLog += result.log;
      errors.push(...result.errors);
      if (!result.success && run === 0) {
        return { success: false, log: fullLog, errors };
      }
    }

    const baseName = path.basename(texFile, '.tex');
    const pdfInTmp = path.join(tmpDir, `${baseName}.pdf`);

    if (fs.existsSync(pdfInTmp)) {
      const destDir = options.outputDir || path.join(os.tmpdir(), 'proftest-output');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const finalPdf = path.join(destDir, `${baseName}.pdf`);
      fs.copyFileSync(pdfInTmp, finalPdf);
      return { success: true, pdfPath: finalPdf, log: fullLog, errors };
    }

    return {
      success: false,
      log: fullLog,
      errors: [...errors, 'PDF output file not found after compilation'],
    };
  } catch (err) {
    return {
      success: false,
      log: '',
      errors: [err instanceof Error ? err.message : String(err)],
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}
