import * as XLSX from 'xlsx';
import { TestInstance } from '../models';

function versionSheetName(label: string) {
  const safe = label.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? `GradingMatrix_${safe}` : 'GradingMatrix';
}

export function buildGradingMatrixWorkbook(testId: string, versions: TestInstance[]): Buffer {
  const wb = XLSX.utils.book_new();

  const answerKeyRows: Array<Array<string | number>> = [
    ['Test ID', 'Version', 'Question Number', 'Question ID', 'Correct Answers', 'Points'],
  ];

  for (const version of versions) {
    const label = version.version_label || '';
    const questions = version.generated_questions || [];
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = version.answer_key ? version.answer_key[i + 1] : null;
      const answerText = Array.isArray(answer) ? answer.join(';') : answer ? String(answer) : '';
      answerKeyRows.push([
        testId,
        label,
        i + 1,
        question.base_question_id || question.id,
        answerText,
        question.points ?? '',
      ]);
    }
  }

  const answerSheet = XLSX.utils.aoa_to_sheet(answerKeyRows);
  XLSX.utils.book_append_sheet(wb, answerSheet, 'AnswerKey');

  for (const version of versions) {
    const label = version.version_label || '';
    const questions = version.generated_questions || [];
    const qCount = questions.length;
    const header = ['Student Name', 'Student ID'];
    for (let i = 0; i < qCount; i++) header.push(`Q${i + 1}`);
    header.push('Total', 'Percentage');

    const rows: Array<Array<string | number>> = [header];
    const answerRow = ['Correct', ''];
    const pointsRow = ['Points', ''];
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    for (let i = 0; i < qCount; i++) {
      const answer = version.answer_key ? version.answer_key[i + 1] : '';
      answerRow.push(Array.isArray(answer) ? answer.join(';') : answer ? String(answer) : '');
      pointsRow.push(questions[i].points || '');
    }
    answerRow.push('', '');
    pointsRow.push(totalPoints || '', '');
    rows.push(answerRow);
    rows.push(pointsRow);

    for (let i = 0; i < 5; i++) {
      const row = new Array(header.length).fill('');
      const startCol = 3;
      const endCol = 2 + qCount;
      const rowIndex = rows.length + 1;
      if (qCount > 0) {
        row[header.length - 2] = {
          f: `SUM(${XLSX.utils.encode_cell({ r: rowIndex - 1, c: startCol - 1 })}:${XLSX.utils.encode_cell({ r: rowIndex - 1, c: endCol - 1 })})`,
        } as any;
        if (totalPoints > 0) {
          row[header.length - 1] = {
            f: `${XLSX.utils.encode_cell({ r: rowIndex - 1, c: header.length - 2 })}/${totalPoints}`,
          } as any;
        }
      }
      rows.push(row);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, versionSheetName(label));
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
