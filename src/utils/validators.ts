import { HeaderPreset, LayoutPreset, Question, QuestionType, TestInstance, TestTemplate } from '../models';

const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'multiple_select',
  'short_answer',
  'true_false',
  'matching',
];

export function validateQuestion(question: Question): string[] {
  const errors: string[] = [];
  if (!question.id || String(question.id).trim() === '') {
    errors.push('Question id is required');
  }
  if (!QUESTION_TYPES.includes(question.type)) {
    errors.push(`Question type must be one of: ${QUESTION_TYPES.join(', ')}`);
  }
  if (!question.stem || String(question.stem).trim() === '') {
    errors.push('Question stem is required');
  }
  if (question.type === 'multiple_choice' || question.type === 'multiple_select') {
    const choices = question.choices || [];
    if (choices.length < 2) {
      errors.push('Choice-based questions require at least 2 choices');
    }
    const correctCount = choices.filter((c) => c.is_correct).length;
    if (correctCount < 1) {
      errors.push('Choice-based questions require at least one correct choice');
    }
    if (question.type === 'multiple_choice' && correctCount > 1) {
      errors.push('Multiple choice questions require exactly one correct choice');
    }
  }
  return errors;
}

export function validateHeaderPreset(preset: HeaderPreset): string[] {
  const errors: string[] = [];
  if (!preset.id || String(preset.id).trim() === '') {
    errors.push('HeaderPreset id is required');
  }
  if (!preset.name || String(preset.name).trim() === '') {
    errors.push('HeaderPreset name is required');
  }
  if (preset.scope !== 'global' && preset.scope !== 'project') {
    errors.push('HeaderPreset scope must be global or project');
  }
  return errors;
}

export function validateLayoutPreset(preset: LayoutPreset): string[] {
  const errors: string[] = [];
  if (!preset.id || String(preset.id).trim() === '') {
    errors.push('LayoutPreset id is required');
  }
  if (!preset.name || String(preset.name).trim() === '') {
    errors.push('LayoutPreset name is required');
  }
  return errors;
}

export function validateTestTemplate(template: TestTemplate): string[] {
  const errors: string[] = [];
  if (!template.id || String(template.id).trim() === '') {
    errors.push('TestTemplate id is required');
  }
  if (!template.title || String(template.title).trim() === '') {
    errors.push('TestTemplate title is required');
  }
  return errors;
}

export function validateTestInstance(instance: TestInstance): string[] {
  const errors: string[] = [];
  if (!instance.id || String(instance.id).trim() === '') {
    errors.push('TestInstance id is required');
  }
  if (instance.version_label && String(instance.version_label).length > 1) {
    errors.push('TestInstance version_label must be a single character');
  }
  return errors;
}
