export function lintLatex(text: string): string[] {
  const errors: string[] = [];
  const content = String(text || '');
  let dollarCount = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '$' && content[i - 1] !== '\\') {
      dollarCount += 1;
    }
  }
  if (dollarCount % 2 !== 0) {
    errors.push('Unbalanced $ delimiters');
  }

  const stack: string[] = [];
  const beginRegex = /\\begin\{([^}]+)\}/g;
  const endRegex = /\\end\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = beginRegex.exec(content))) {
    stack.push(match[1]);
  }
  while ((match = endRegex.exec(content))) {
    const env = match[1];
    const idx = stack.lastIndexOf(env);
    if (idx === -1) {
      errors.push(`Unmatched \\end{${env}}`);
    } else {
      stack.splice(idx, 1);
    }
  }
  if (stack.length) {
    errors.push(`Unmatched \\begin{${stack[stack.length - 1]}}`);
  }

  return errors;
}
