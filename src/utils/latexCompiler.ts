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

export interface CompilerOptions {
  engine?: 'pdflatex' | 'xelatex';
  latexPath?: string; // custom path to LaTeX binary
  outputDir?: string; // where to put the final PDF
  runs?: number; // number of compilation passes (default 1)
  timeout?: number; // ms before killing the process
}

function findLatexEngine(engine: string, customPath?: string): string {
  if (customPath) {
    const fullPath = path.join(customPath, engine + (process.platform === 'win32' ? '.exe' : ''));
    if (fs.existsSync(fullPath)) return fullPath;
    // Also try customPath as a direct binary path
    if (fs.existsSync(customPath)) return customPath;
  }
  // Fall back to system PATH
  return engine;
}

export function detectLatexInstallation(): { found: boolean; path?: string; engines: string[] } {
  const engines: string[] = [];
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
    for (const eng of ['pdflatex', 'xelatex']) {
      const ext = process.platform === 'win32' ? '.exe' : '';
      const full = path.join(p, eng + ext);
      if (fs.existsSync(full)) {
        engines.push(eng);
        if (engines.length === 1) {
          return { found: true, path: p, engines };
        }
      }
    }
    if (engines.length > 0) {
      return { found: true, path: p, engines };
    }
  }

  return { found: engines.length > 0, engines };
}

export async function compileLatex(
  latexSource: string,
  filename: string,
  options: CompilerOptions = {}
): Promise<CompilationResult> {
  const engine = options.engine || 'pdflatex';
  const runs = options.runs || 1;
  const timeout = options.timeout || 60000;

  // Create a temp directory for compilation
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proftest-latex-'));
  const texFile = path.join(tmpDir, filename.endsWith('.tex') ? filename : filename + '.tex');
  
  try {
    fs.writeFileSync(texFile, latexSource, 'utf8');
    
    const binaryPath = findLatexEngine(engine, options.latexPath);
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

    // Check for output PDF
    const baseName = path.basename(texFile, '.tex');
    const pdfInTmp = path.join(tmpDir, baseName + '.pdf');
    
    if (fs.existsSync(pdfInTmp)) {
      let finalPdf: string;
      
      // Always copy the PDF out of tmpDir before cleanup
      const destDir = options.outputDir || path.join(os.tmpdir(), 'proftest-output');
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      finalPdf = path.join(destDir, baseName + '.pdf');
      fs.copyFileSync(pdfInTmp, finalPdf);

      return { success: true, pdfPath: finalPdf, log: fullLog, errors };
    }

    errors.push('PDF output file not found after compilation');
    return { success: false, log: fullLog, errors };
  } catch (err) {
    return {
      success: false,
      log: '',
      errors: [err instanceof Error ? err.message : String(err)],
    };
  } finally {
    // Always clean up temp directory to prevent leaks.
    // If no outputDir was specified, the PDF was returned from tmpDir — caller
    // should consume pdfPath before it's deleted. Copy it to a stable location
    // (outputDir) to keep it long-term.
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

function runLatexProcess(
  binaryPath: string,
  texFile: string,
  workDir: string,
  timeout: number
): Promise<{ success: boolean; log: string; errors: string[] }> {
  return new Promise((resolve) => {
    const args = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      `-output-directory=${workDir}`,
      texFile,
    ];

    let log = '';
    const errors: string[] = [];
    let killed = false;

    const proc = spawn(binaryPath, args, {
      cwd: workDir,
      timeout,
    });

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
      
      // Parse log for LaTeX errors
      const logErrors = parseLatexErrors(log);
      errors.push(...logErrors);
      
      resolve({
        success: code === 0,
        log,
        errors,
      });
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

function parseLatexErrors(log: string): string[] {
  const errors: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    if (line.startsWith('!')) {
      errors.push(line.trim());
    }
    if (line.includes('Fatal error') || line.includes('Emergency stop')) {
      errors.push(line.trim());
    }
  }
  return errors;
}
