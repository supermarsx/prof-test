import { HeaderPreset, LayoutPreset, Question, TestInstance, QuestionInstance } from '../models';
import { AssembledTest } from './testAssembler';

/**
 * Renders an assembled test to a LaTeX source string using header and layout presets.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeLatex(text: string): string {
  // Escape common TeX special characters but preserve existing LaTeX commands
  return text
    .replace(/(?<!\\)&/g, '\\&')
    .replace(/(?<!\\)%/g, '\\%')
    .replace(/(?<!\\)#/g, '\\#');
}

function marginsToLatex(margins?: { top?: number; bottom?: number; left?: number; right?: number }): string {
  if (!margins) return '';
  const parts: string[] = [];
  if (margins.top != null) parts.push(`top=${margins.top}mm`);
  if (margins.bottom != null) parts.push(`bottom=${margins.bottom}mm`);
  if (margins.left != null) parts.push(`left=${margins.left}mm`);
  if (margins.right != null) parts.push(`right=${margins.right}mm`);
  if (parts.length === 0) return '';
  return `\\usepackage[${parts.join(',')}]{geometry}`;
}

// ---------------------------------------------------------------------------
// Preamble
// ---------------------------------------------------------------------------

export function renderPreamble(layout?: LayoutPreset): string {
  const lines: string[] = [];
  const fontSize = layout?.base_font_size ?? 12;
  const fontFamily = layout?.font_family ?? 'Computer Modern';
  lines.push(`\\documentclass[${fontSize}pt]{article}`);
  lines.push('\\usepackage[utf8]{inputenc}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{enumitem}');
  if (layout?.page_margins) {
    const geo = marginsToLatex(layout.page_margins);
    if (geo) lines.push(geo);
  }
  if (fontFamily && fontFamily !== 'Computer Modern') {
    lines.push(`\\usepackage{${fontFamily}}`);
    lines.push(`\\renewcommand{\\familydefault}{\\sfdefault}`);
  }
  if (layout?.line_spacing && layout.line_spacing !== 1) {
    lines.push('\\usepackage{setspace}');
    lines.push(`\\setstretch{${layout.line_spacing}}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function renderHeader(header?: HeaderPreset, versionLabel?: string): string {
  if (!header) return '';
  // If a full latex_snippet is provided, use it directly
  if (header.latex_snippet) {
    let snippet = header.latex_snippet;
    if (versionLabel) {
      snippet = snippet.replace(/\{\{version\}\}/g, versionLabel);
    }
    return snippet;
  }

  const lines: string[] = [];
  const fc = header.fields_config ?? {};
  lines.push('\\begin{center}');
  if (fc.show_logo && fc.logo_path) {
    lines.push(`\\includegraphics[height=1.5cm]{${fc.logo_path}}`);
    lines.push('\\\\[0.3cm]');
  }
  lines.push(`\\textbf{\\Large ${escapeLatex(header.name)}}`);
  if (versionLabel) {
    lines.push(`\\\\Version ${escapeLatex(versionLabel)}`);
  }
  if (fc.show_date) lines.push('\\\\\\today');
  lines.push('\\end{center}');
  if (fc.student_name_line) lines.push('\\noindent Name: \\underline{\\hspace{8cm}}\\\\');
  if (fc.student_id_line) lines.push('\\noindent ID: \\underline{\\hspace{8cm}}\\\\');
  lines.push('\\vspace{0.5cm}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function renderQuestion(q: Question, index: number, showPoints?: boolean, points?: number): string {
  const lines: string[] = [];
  const pointStr = showPoints && points != null ? ` \\hfill (${points} pts)` : '';
  lines.push(`\\item ${q.stem}${pointStr}`);
  // Media above/below
  if (q.media_refs) {
    for (const m of q.media_refs) {
      if (m.placement === 'above') {
        lines.splice(lines.length - 1, 0, `\\begin{center}\\includegraphics[width=0.5\\textwidth]{${m.path}}\\end{center}`);
      }
      if (m.placement === 'below') {
        lines.push(`\\begin{center}\\includegraphics[width=0.5\\textwidth]{${m.path}}\\end{center}`);
      }
    }
  }
  if (q.choices && q.choices.length > 0) {
    lines.push('\\begin{enumerate}[label=\\Alph*)]');
    for (const c of q.choices) {
      lines.push(`  \\item ${c.text}`);
    }
    lines.push('\\end{enumerate}');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Full document
// ---------------------------------------------------------------------------

export interface RenderOptions {
  header?: HeaderPreset;
  layout?: LayoutPreset;
  versionLabel?: string;
  showPoints?: boolean;
}

/**
 * Render a list of questions into a complete LaTeX document.
 * Used for simple test rendering (e.g. from generateTestVersions).
 */
export function renderTestDocument(
  title: string,
  questions: Question[],
  options: RenderOptions = {},
): string {
  const parts: string[] = [];
  parts.push(renderPreamble(options.layout));
  parts.push('\\begin{document}');
  parts.push(renderHeader(options.header, options.versionLabel));
  parts.push(`\\section*{${escapeLatex(title)}}`);
  parts.push('\\begin{enumerate}');
  for (let i = 0; i < questions.length; i++) {
    parts.push(renderQuestion(questions[i], i, options.showPoints));
  }
  parts.push('\\end{enumerate}');
  parts.push('\\end{document}');
  return parts.join('\n');
}

/**
 * Render an AssembledTest (with sections) to a full LaTeX document.
 */
export function renderAssembledTest(
  assembled: AssembledTest,
  options: RenderOptions = {},
): string {
  const parts: string[] = [];
  const showPoints = options.showPoints ?? options.layout?.show_points_inline ?? false;
  parts.push(renderPreamble(options.layout));
  parts.push('\\begin{document}');
  parts.push(renderHeader(options.header, options.versionLabel));
  parts.push(`\\section*{${escapeLatex(assembled.template.title)}}`);

  for (const section of assembled.sections) {
    const included = section.questions.filter((q) => q.included);
    if (included.length === 0) continue;
    parts.push(`\\subsection*{${escapeLatex(section.definition.name)}}`);
    if (section.definition.description) {
      parts.push(`\\textit{${escapeLatex(section.definition.description)}}`);
      parts.push('');
    }
    parts.push('\\begin{enumerate}');
    for (const aq of included) {
      parts.push(renderQuestion(aq.question, aq.instance.order_index ?? 0, showPoints, aq.instance.points));
    }
    parts.push('\\end{enumerate}');
  }

  parts.push('\\end{document}');
  return parts.join('\n');
}
