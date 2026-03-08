import { Question, HeaderPreset, LayoutPreset, TestTemplate, TestInstance, SectionDefinition, QuestionInstance, MediaRef } from '../models';

export interface RenderContext {
  headerPreset?: HeaderPreset;
  layoutPreset?: LayoutPreset;
  template?: TestTemplate;
  versionLabel?: string;
  courseName?: string;
  instructorName?: string;
  date?: string;
  duration?: string;
}

// Escapes special LaTeX characters
export function escapeLatex(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// Renders stem text with LaTeX special characters escaped.
// Preserves existing LaTeX math delimiters ($...$, \[...\]) and commands (\textbf, etc.)
function renderStem(stem: string): string {
  if (!stem) return '';
  // Split on LaTeX math environments and commands to preserve them
  // Escape only plain text segments
  const mathPattern = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\[a-zA-Z]+\{[^}]*\})/g;
  const parts = stem.split(mathPattern);
  return parts
    .map(part => {
      // If part matches a LaTeX command/math pattern, leave it as-is
      if (mathPattern.test(part)) {
        mathPattern.lastIndex = 0; // reset regex state
        return part;
      }
      mathPattern.lastIndex = 0;
      return escapeLatex(part);
    })
    .join('');
}

function renderMediaRef(ref: MediaRef): string {
  if (!ref || !ref.path) return '';
  const caption = ref.caption ? `\\caption{${escapeLatex(ref.caption)}}` : '';
  const label = ref.alt_text ? `% alt: ${escapeLatex(ref.alt_text)}` : '';
  return `\\begin{figure}[h]
\\centering
\\includegraphics[width=0.6\\textwidth]{${ref.path}}
${caption}
${label}
\\end{figure}`;
}

export function renderQuestionLatex(question: Question, index: number, points?: number, showPoints?: boolean): string {
  const lines: string[] = [];
  const pointsStr = showPoints && points !== undefined ? ` \\hfill (${points} pts)` : '';
  
  // Media above stem
  if (question.media_refs) {
    for (const ref of question.media_refs) {
      if (ref.placement === 'above') {
        lines.push(renderMediaRef(ref));
      }
    }
  }

  lines.push(`\\item ${renderStem(question.stem)}${pointsStr}`);

  // Media below stem
  if (question.media_refs) {
    for (const ref of question.media_refs) {
      if (ref.placement === 'below' || ref.placement === 'inline' || !ref.placement) {
        lines.push(renderMediaRef(ref));
      }
    }
  }

  if (question.type === 'multiple_choice' || question.type === 'multiple_select') {
    lines.push('\\begin{enumerate}[label=\\Alph*)]');
    for (const choice of (question.choices || [])) {
      let choiceText = escapeLatex(choice.text || '');
      // Per-choice media
      if (choice.media_ref_id && question.media_refs) {
        const mRef = question.media_refs.find(m => m.id === choice.media_ref_id);
        if (mRef) {
          choiceText += ` ${renderMediaRef(mRef)}`;
        }
      }
      lines.push(`  \\item ${choiceText}`);
    }
    lines.push('\\end{enumerate}');
  } else if (question.type === 'true_false') {
    lines.push('\\begin{enumerate}[label=\\Alph*)]');
    for (const choice of (question.choices || [])) {
      lines.push(`  \\item ${escapeLatex(choice.text || '')}`);
    }
    lines.push('\\end{enumerate}');
  } else if (question.type === 'short_answer') {
    lines.push('\\vspace{2cm}');
  }

  return lines.join('\n');
}

function renderPreamble(layout?: LayoutPreset): string {
  const margins = layout?.page_margins || { top: 1, bottom: 1, left: 1, right: 1 };
  const fontSize = layout?.base_font_size || 12;
  const lineSpacing = layout?.line_spacing || 1.2;
  const font = layout?.font_family || '';

  const lines: string[] = [];
  lines.push(`\\documentclass[${fontSize}pt]{article}`);
  lines.push(`\\usepackage[top=${margins.top || 1}in, bottom=${margins.bottom || 1}in, left=${margins.left || 1}in, right=${margins.right || 1}in]{geometry}`);
  lines.push('\\usepackage{enumitem}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{float}');
  lines.push('\\usepackage{setspace}');
  if (font) {
    lines.push(`\\usepackage{${font}}`);
  }
  lines.push(`\\setstretch{${lineSpacing}}`);
  lines.push('\\usepackage{fancyhdr}');
  lines.push('\\pagestyle{fancy}');
  lines.push('');

  return lines.join('\n');
}

function renderHeader(ctx: RenderContext): string {
  const header = ctx.headerPreset;
  if (!header) return '';

  // If a custom latex_snippet is provided, use it directly
  if (header.latex_snippet && header.latex_snippet.trim()) {
    return header.latex_snippet;
  }

  const fc = header.fields_config || {};
  const lines: string[] = [];

  lines.push('\\begin{center}');
  if (fc.show_logo && fc.logo_path) {
    lines.push(`\\includegraphics[height=1.5cm]{${fc.logo_path}} \\\\[0.3cm]`);
  }
  if (ctx.template?.title) {
    lines.push(`{\\Large \\textbf{${ctx.template.title}}}\\\\[0.2cm]`);
  }
  if (ctx.versionLabel) {
    lines.push(`{\\large Version ${ctx.versionLabel}}\\\\[0.2cm]`);
  }
  if (fc.show_course && ctx.courseName) {
    lines.push(`{\\large ${ctx.courseName}}\\\\[0.1cm]`);
  }
  if (fc.show_instructor && ctx.instructorName) {
    lines.push(`Instructor: ${ctx.instructorName}\\\\[0.1cm]`);
  }

  const metaItems: string[] = [];
  if (fc.show_date && ctx.date) {
    metaItems.push(`Date: ${ctx.date}`);
  }
  if (fc.show_duration && ctx.duration) {
    metaItems.push(`Duration: ${ctx.duration}`);
  }
  if (metaItems.length) {
    lines.push(metaItems.join(' \\hfill ') + '\\\\[0.3cm]');
  }
  lines.push('\\end{center}');

  if (fc.student_name_line || fc.student_id_line) {
    lines.push('\\noindent');
    if (fc.student_name_line) {
      lines.push('Name: \\underline{\\hspace{8cm}} \\hfill');
    }
    if (fc.student_id_line) {
      lines.push('ID: \\underline{\\hspace{4cm}}');
    }
    lines.push('\\\\[0.5cm]');
  }

  if (ctx.template?.metadata?.instructions) {
    lines.push(`\\noindent\\textbf{Instructions:} ${ctx.template.metadata.instructions}\\\\[0.3cm]`);
  }

  lines.push('\\hrule');
  lines.push('\\vspace{0.5cm}');

  return lines.join('\n');
}

export function renderTestLatex(
  questions: Question[],
  instances: QuestionInstance[],
  ctx: RenderContext,
  sections?: SectionDefinition[]
): string {
  const lines: string[] = [];
  
  lines.push(renderPreamble(ctx.layoutPreset));
  lines.push('\\begin{document}');
  lines.push('');
  lines.push(renderHeader(ctx));
  lines.push('');

  const showPoints = ctx.layoutPreset?.show_points_inline ?? true;
  const numberingStyle = ctx.layoutPreset?.numbering_style || 'numeric';
  const labelStyle = numberingStyle === 'alpha' ? 'label=\\alph*)' : 
                     numberingStyle === 'roman' ? 'label=\\roman*)' : '';

  if (sections && sections.length > 0) {
    for (const section of sections) {
      lines.push(`\\section*{${section.name || 'Section'}}`);
      if (section.description) {
        lines.push(`\\textit{${section.description}}\\\\[0.3cm]`);
      }
      
      const sectionQRefs = section.question_references || [];
      const sectionQuestions = sectionQRefs
        .map(ref => {
          const inst = instances.find(i => i.base_question_id === ref.question_id);
          const q = questions.find(q => q.id === ref.question_id);
          return { question: q, instance: inst };
        })
        .filter(item => item.question);

      lines.push(`\\begin{enumerate}${labelStyle ? `[${labelStyle}]` : ''}`);
      for (const { question, instance } of sectionQuestions) {
        if (question) {
          const merged = instance?.local_overrides 
            ? { ...question, ...instance.local_overrides } 
            : question;
          lines.push(renderQuestionLatex(merged, 0, instance?.points, showPoints));
        }
      }
      lines.push('\\end{enumerate}');
      lines.push('');
    }
  } else {
    // Flat question list (no sections)
    lines.push(`\\begin{enumerate}${labelStyle ? `[${labelStyle}]` : ''}`);
    for (let i = 0; i < questions.length; i++) {
      const inst = instances[i];
      const q = inst?.local_overrides ? { ...questions[i], ...inst.local_overrides } : questions[i];
      lines.push(renderQuestionLatex(q, i, inst?.points, showPoints));
    }
    lines.push('\\end{enumerate}');
  }

  lines.push('');
  lines.push('\\end{document}');
  return lines.join('\n');
}

export function renderAnswerKeyLatex(
  questions: Question[],
  instances: QuestionInstance[],
  answerKey: Record<string, any>,
  ctx: RenderContext
): string {
  const lines: string[] = [];
  
  lines.push(renderPreamble(ctx.layoutPreset));
  lines.push('\\begin{document}');
  lines.push('');
  lines.push('\\begin{center}');
  lines.push(`{\\Large \\textbf{Answer Key${ctx.versionLabel ? ` - Version ${ctx.versionLabel}` : ''}}}\\\\[0.3cm]`);
  if (ctx.template?.title) {
    lines.push(`{\\large ${ctx.template.title}}\\\\[0.2cm]`);
  }
  lines.push('\\end{center}');
  lines.push('\\hrule\\vspace{0.5cm}');
  lines.push('');
  lines.push('\\begin{enumerate}');
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const inst = instances[i];
    const answer = answerKey[i + 1];
    const pointsStr = inst?.points ? ` (${inst.points} pts)` : '';
    
    let answerText = '';
    if (Array.isArray(answer)) {
      // Map choice IDs to labels (A, B, C, ...)
      if (q.choices) {
        const labels = answer.map(id => {
          const idx = q.choices!.findIndex(c => c.id === id);
          return idx >= 0 ? String.fromCharCode(65 + idx) : id;
        });
        answerText = labels.join(', ');
      } else {
        answerText = answer.join(', ');
      }
    } else if (answer !== null && answer !== undefined) {
      answerText = String(answer);
    } else {
      answerText = '(Open response)';
    }

    lines.push(`  \\item \\textbf{${answerText}}${pointsStr}`);
    
    if (q.explanation) {
      lines.push(`  \\\\ \\textit{Explanation: ${q.explanation}}`);
    }
  }
  
  lines.push('\\end{enumerate}');
  lines.push('');
  lines.push('\\end{document}');
  return lines.join('\n');
}
