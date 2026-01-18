import { test, expect } from 'vitest';
import { lintLatex } from '../utils/latexLint';

test('lintLatex detects unbalanced dollar signs', () => {
  const errors = lintLatex('This is $x + y');
  expect(errors.length).toBeGreaterThan(0);
});

test('lintLatex detects unmatched begin/end', () => {
  const errors = lintLatex('\\begin{align}x=1');
  expect(errors.length).toBeGreaterThan(0);
});
