import { Question, TestInstance } from '../models';

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAnswerKeyCsv(testId: string, versions: TestInstance[]): string {
  const rows: string[] = [];
  rows.push(['Test ID', 'Version', 'Question Number', 'Question ID', 'Correct Answers', 'Points'].join(','));

  for (const version of versions) {
    const label = version.version_label || '';
    const questions = version.generated_questions || [];
    for (let idx = 0; idx < questions.length; idx++) {
      const question = questions[idx];
      const answer = version.answer_key ? version.answer_key[idx + 1] : null;
      const answerText = Array.isArray(answer) ? answer.join(';') : answer ? String(answer) : '';
      const row = [
        csvEscape(testId),
        csvEscape(label),
        csvEscape(String(idx + 1)),
        csvEscape(question.base_question_id || question.id),
        csvEscape(answerText),
        csvEscape(question.points !== undefined ? String(question.points) : ''),
      ];
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

export function buildQuestionMetadataCsv(questions: Question[]): string {
  const rows: string[] = [];
  rows.push(
    [
      'Question ID',
      'Subject',
      'Topic',
      'Difficulty',
      'Tags',
      'Estimated Time (min)',
      'Usage Count',
      'Last Used',
    ].join(',')
  );

  for (const q of questions) {
    const row = [
      csvEscape(q.id),
      csvEscape(q.subject || ''),
      csvEscape(q.topic || ''),
      csvEscape(q.difficulty !== undefined ? String(q.difficulty) : ''),
      csvEscape((q.tags || []).join(';')),
      csvEscape(q.estimated_time_min !== undefined ? String(q.estimated_time_min) : ''),
      csvEscape(''),
      csvEscape(''),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}
