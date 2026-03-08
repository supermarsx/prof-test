import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuestionEditor } from '../renderer/components/QuestionEditor';

// Mock the api module so QuestionEditor uses our stubs
vi.mock('../renderer/lib/api', () => ({
  api: {
    addQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    getActiveProject: vi.fn().mockResolvedValue({ ok: true, active: null }),
    listMedia: vi.fn().mockResolvedValue([]),
  },
  initAPI: vi.fn(),
}));

// Ensure DOM globals when running in non-jsdom environment
if (typeof document === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  (globalThis as any).window = dom.window as any;
  (globalThis as any).document = dom.window.document;
}

test('shows validation error when stem empty', () => {
  const saved = vi.fn();
  const { getByText } = render(<QuestionEditor question={null as any} onSaved={saved} />);
  const saveBtn = getByText('Save');
  fireEvent.click(saveBtn);
  expect(getByText('Stem is required')).toBeDefined();
});
