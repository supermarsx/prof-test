import * as XLSX from 'xlsx';
import { TestInstance } from '../models';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function versionSheetName(label: string): string {
  const safe = label.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? `GradingMatrix_${safe}` : 'GradingMatrix';
}

/** Convert 0-based column index to Excel column letter (0→A, 25→Z, 26→AA …) */
function colLetter(c: number): string {
  return XLSX.utils.encode_col(c);
}

/** Apply a green fill to a range of cells (answer-key row). */
function applyAnswerKeyFill(
  ws: XLSX.WorkSheet,
  row: number,
  colStart: number,
  colEnd: number,
): void {
  for (let c = colStart; c <= colEnd; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    ws[addr].s = {
      fill: { fgColor: { rgb: 'C6EFCE' } },
      font: { bold: true },
    };
  }
}

/** Apply a light-red fill to cells (points row visual hint). */
function applyPointsRowFill(
  ws: XLSX.WorkSheet,
  row: number,
  colStart: number,
  colEnd: number,
): void {
  for (let c = colStart; c <= colEnd; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    ws[addr].s = {
      fill: { fgColor: { rgb: 'FFF2CC' } },
      font: { italic: true },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  1.  buildGradingMatrixWorkbook  (enhanced)                         */
/* ------------------------------------------------------------------ */

/**
 * Builds the grading-matrix workbook.
 *
 * Sheet layout per version (0-indexed rows):
 *   Row 0 : Header   — Student Name | Student ID | Q1 … Qn | Total | Percentage
 *   Row 1 : Correct  — correct answers per question
 *   Row 2 : Points   — point value per question | total points
 *   Row 3+: Student rows — answer cells are blank (for input);
 *           Total uses SUMPRODUCT+IF array formula; Percentage = Total / totalPoints.
 *
 * Per-question auto-grading is embedded in the Total formula via SUMPRODUCT
 * so teachers can simply enter answers and see scores immediately.
 *
 * Conditional-formatting-style cell fills are applied to the answer key row
 * (green) and the points row (light yellow) for visual guidance.
 */
export function buildGradingMatrixWorkbook(
  testId: string,
  versions: TestInstance[],
): Buffer {
  const wb = XLSX.utils.book_new();

  /* ---- AnswerKey reference sheet ---- */
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

  /* ---- Per-version grading sheets ---- */
  for (const version of versions) {
    const label = version.version_label || '';
    const questions = version.generated_questions || [];
    const qCount = questions.length;

    // Column layout:
    //   0: Student Name  1: Student ID  2..(2+qCount-1): Q1..Qn
    //   (2+qCount): Total   (2+qCount+1): Percentage
    const firstQCol = 2;
    const lastQCol = firstQCol + qCount - 1; // inclusive
    const totalCol = lastQCol + 1;
    const pctCol = totalCol + 1;

    // Header row (row index 0)
    const header: string[] = ['Student Name', 'Student ID'];
    for (let i = 0; i < qCount; i++) header.push(`Q${i + 1}`);
    header.push('Total', 'Percentage');

    const rows: Array<Array<string | number | object>> = [header];

    // Answer row (row index 1)
    const answerRow: Array<string | number> = ['Correct', ''];
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    for (let i = 0; i < qCount; i++) {
      const answer = version.answer_key ? version.answer_key[i + 1] : '';
      answerRow.push(Array.isArray(answer) ? answer.join(';') : answer ? String(answer) : '');
    }
    answerRow.push('', '');
    rows.push(answerRow);

    // Points row (row index 2)
    const pointsRow: Array<string | number> = ['Points', ''];
    for (let i = 0; i < qCount; i++) {
      pointsRow.push(questions[i].points || 0);
    }
    pointsRow.push(totalPoints || '', '');
    rows.push(pointsRow);

    // Student placeholder rows (rows 3..7 → 5 students)
    const STUDENT_PLACEHOLDER_COUNT = 5;
    // These are initially filled with empty strings; formulas are applied below.
    for (let s = 0; s < STUDENT_PLACEHOLDER_COUNT; s++) {
      const row: Array<string | number | object> = new Array(header.length).fill('');
      rows.push(row);
    }

    // Build worksheet from AOA first, then overlay formulas
    const ws = XLSX.utils.aoa_to_sheet(rows as any[][]);

    // Overlay Total & Percentage formulas for each student row
    // Row indices: answer row = 2 (1-indexed), points row = 3 (1-indexed)
    // Student rows start at row index 3 (0-indexed) → Excel row 4 (1-indexed)
    const answerExcelRow = 2; // 1-indexed row for correct answers
    const pointsExcelRow = 3; // 1-indexed row for points

    for (let s = 0; s < STUDENT_PLACEHOLDER_COUNT; s++) {
      const studentExcelRow = 4 + s; // 1-indexed

      if (qCount > 0) {
        // Question range letters
        const qStartLetter = colLetter(firstQCol);
        const qEndLetter = colLetter(lastQCol);

        // SUMPRODUCT(IF(C4:L4=C$2:L$2,1,0)*C$3:L$3)
        // Using $ on answer/points rows so they stay fixed
        const formula =
          `SUMPRODUCT(IF(${qStartLetter}${studentExcelRow}:${qEndLetter}${studentExcelRow}` +
          `=${qStartLetter}$${answerExcelRow}:${qEndLetter}$${answerExcelRow},1,0)` +
          `*${qStartLetter}$${pointsExcelRow}:${qEndLetter}$${pointsExcelRow})`;

        const totalAddr = XLSX.utils.encode_cell({ r: studentExcelRow - 1, c: totalCol });
        ws[totalAddr] = { t: 'n', f: formula };

        // Percentage = Total / totalPoints  (guard against 0)
        if (totalPoints > 0) {
          const pctAddr = XLSX.utils.encode_cell({ r: studentExcelRow - 1, c: pctCol });
          const totalRef = `${colLetter(totalCol)}${studentExcelRow}`;
          ws[pctAddr] = { t: 'n', f: `${totalRef}/${totalPoints}` };
        }
      }
    }

    // Conditional formatting colours (cell-level styles)
    if (qCount > 0) {
      applyAnswerKeyFill(ws, 1, firstQCol, lastQCol); // answer row (0-indexed row 1)
      applyPointsRowFill(ws, 2, firstQCol, lastQCol); // points row (0-indexed row 2)
    }

    // Set column widths for readability
    const colWidths: XLSX.ColInfo[] = [
      { wch: 20 }, // Student Name
      { wch: 14 }, // Student ID
    ];
    for (let i = 0; i < qCount; i++) colWidths.push({ wch: 10 });
    colWidths.push({ wch: 10 }); // Total
    colWidths.push({ wch: 12 }); // Percentage
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, versionSheetName(label));
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/* ------------------------------------------------------------------ */
/*  2.  buildResponseImportTemplate                                    */
/* ------------------------------------------------------------------ */

/**
 * Creates an XLSX workbook that teachers can fill in with student responses
 * and then re-import.  One sheet per version.
 *
 * Layout per sheet:
 *   Row 0: Instructions text (merged across columns)
 *   Row 1: Header — Student Name | Student ID | Q1 … Qn
 *   Row 2+: Empty rows for data entry
 */
export function buildResponseImportTemplate(
  testId: string,
  versions: TestInstance[],
): Buffer {
  const wb = XLSX.utils.book_new();

  for (const version of versions) {
    const label = version.version_label || 'Default';
    const questions = version.generated_questions || [];
    const qCount = questions.length;

    const instructions = `Response Import Template — Test: ${testId}, Version: ${label}. ` +
      `Enter student responses below. One row per student. Columns Q1–Q${qCount} correspond to each question.`;

    const header: string[] = ['Student Name', 'Student ID'];
    for (let i = 0; i < qCount; i++) header.push(`Q${i + 1}`);

    const rows: string[][] = [
      [instructions],
      header,
    ];

    // 30 blank rows for data entry
    const BLANK_ROWS = 30;
    for (let i = 0; i < BLANK_ROWS; i++) {
      rows.push(new Array(header.length).fill(''));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merge the instruction row across all columns
    if (qCount > 0) {
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      ];
    }

    // Column widths
    const colWidths: XLSX.ColInfo[] = [
      { wch: 22 }, // Student Name
      { wch: 14 }, // Student ID
    ];
    for (let i = 0; i < qCount; i++) colWidths.push({ wch: 10 });
    ws['!cols'] = colWidths;

    const sheetName = `Import_${label.replace(/[^a-zA-Z0-9_-]/g, '') || 'Default'}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/* ------------------------------------------------------------------ */
/*  3.  buildMixedClassGradingWorkbook                                 */
/* ------------------------------------------------------------------ */

/**
 * Produces a workbook for grading a mixed class where different students
 * may have different test versions.
 *
 * Sheet "AnswerKeys":
 *   Row 0: Header — Version | Q1 … Qn
 *   Rows 1+: One row per version with correct answers
 *
 * Sheet "MixedGrading":
 *   Row 0: Header — Student Name | Student ID | Version | Q1 … Qn | Total | Percentage
 *   Rows 1+: Student data rows (blank).
 *     Total formula uses INDEX/MATCH against AnswerKeys sheet to look up the
 *     correct answer for the student's Version, then SUMPRODUCT to score.
 *
 * The Total formula per student row:
 *   =SUMPRODUCT(
 *       IF(D{r}:{lastQ}{r} =
 *          INDEX(AnswerKeys!B$2:${lastQ}${vCount+1},
 *                MATCH(C{r}, AnswerKeys!A$2:A${vCount+1}, 0), 0),
 *          1, 0)
 *     * PointsKeys!B$2:${lastQ}$2 )
 *
 * Because point values may differ across versions, we simplify by using
 * a single "Points" row taken from the version with the most questions.
 * A "PointsKeys" helper sheet holds one row of point values.
 */
export function buildMixedClassGradingWorkbook(
  testId: string,
  versions: TestInstance[],
): Buffer {
  const wb = XLSX.utils.book_new();

  // Determine max question count across all versions
  const maxQ = Math.max(1, ...versions.map((v) => (v.generated_questions || []).length));

  /* ---- AnswerKeys sheet ---- */
  const akHeader: string[] = ['Version'];
  for (let i = 0; i < maxQ; i++) akHeader.push(`Q${i + 1}`);
  const akRows: Array<Array<string | number>> = [akHeader];

  for (const version of versions) {
    const label = version.version_label || '';
    const questions = version.generated_questions || [];
    const row: Array<string | number> = [label];
    for (let i = 0; i < maxQ; i++) {
      if (i < questions.length) {
        const answer = version.answer_key ? version.answer_key[i + 1] : '';
        row.push(Array.isArray(answer) ? answer.join(';') : answer ? String(answer) : '');
      } else {
        row.push('');
      }
    }
    akRows.push(row);
  }

  const akSheet = XLSX.utils.aoa_to_sheet(akRows);
  XLSX.utils.book_append_sheet(wb, akSheet, 'AnswerKeys');

  /* ---- PointsKeys sheet (one row of points based on first version that has max questions) ---- */
  const pkHeader: string[] = ['Label'];
  for (let i = 0; i < maxQ; i++) pkHeader.push(`Q${i + 1}`);
  const pkRow: Array<string | number> = ['Points'];

  // Use the first version's points; pad with 0 for shorter versions
  const refVersion = versions.find((v) => (v.generated_questions || []).length === maxQ) || versions[0];
  const refQuestions = refVersion?.generated_questions || [];
  let totalPossible = 0;
  for (let i = 0; i < maxQ; i++) {
    const pts = i < refQuestions.length ? (refQuestions[i].points || 0) : 0;
    pkRow.push(pts);
    totalPossible += pts;
  }

  const pkSheet = XLSX.utils.aoa_to_sheet([pkHeader, pkRow]);
  XLSX.utils.book_append_sheet(wb, pkSheet, 'PointsKeys');

  /* ---- MixedGrading sheet ---- */
  // Column layout:
  //   0: Student Name   1: Student ID   2: Version   3..(3+maxQ-1): Q1..Qn
  //   (3+maxQ): Total   (3+maxQ+1): Percentage
  const firstQCol = 3;
  const lastQCol = firstQCol + maxQ - 1;
  const totalCol = lastQCol + 1;
  const pctCol = totalCol + 1;

  const mgHeader: string[] = ['Student Name', 'Student ID', 'Version'];
  for (let i = 0; i < maxQ; i++) mgHeader.push(`Q${i + 1}`);
  mgHeader.push('Total', 'Percentage');

  const mgRows: string[][] = [mgHeader];

  const STUDENT_ROWS = 30;
  for (let s = 0; s < STUDENT_ROWS; s++) {
    mgRows.push(new Array(mgHeader.length).fill(''));
  }

  const mgSheet = XLSX.utils.aoa_to_sheet(mgRows);

  // Overlay formulas for each student row
  const versionCount = versions.length;
  const qStartLetter = colLetter(firstQCol);
  const qEndLetter = colLetter(lastQCol);
  const versionColLetter = colLetter(2); // Version in column C

  // AnswerKeys ranges (1-indexed):
  //   Versions list: AnswerKeys!A$2:A${1+versionCount}
  //   Answers matrix: AnswerKeys!B$2:${qEndAK}${1+versionCount}
  const akQStartLetter = 'B'; // first Q col in AnswerKeys
  const akQEndLetter = colLetter(maxQ); // last Q col in AnswerKeys
  const akVersionEndRow = 1 + versionCount; // 1-indexed

  // PointsKeys range: PointsKeys!B$2:${pkQEnd}$2
  const pkQStartLetter = 'B';
  const pkQEndLetter = colLetter(maxQ);

  for (let s = 0; s < STUDENT_ROWS; s++) {
    const excelRow = 2 + s; // 1-indexed (header is row 1)

    if (maxQ > 0) {
      // SUMPRODUCT(
      //   IF(D2:M2=INDEX(AnswerKeys!B$2:K$4, MATCH(C2, AnswerKeys!A$2:A$4, 0), 0), 1, 0)
      //   * PointsKeys!B$2:K$2 )
      const formula =
        `SUMPRODUCT(IF(${qStartLetter}${excelRow}:${qEndLetter}${excelRow}=` +
        `INDEX(AnswerKeys!${akQStartLetter}$2:${akQEndLetter}$${akVersionEndRow},` +
        `MATCH(${versionColLetter}${excelRow},AnswerKeys!A$2:A$${akVersionEndRow},0),0),1,0)` +
        `*PointsKeys!${pkQStartLetter}$2:${pkQEndLetter}$2)`;

      const totalAddr = XLSX.utils.encode_cell({ r: excelRow - 1, c: totalCol });
      mgSheet[totalAddr] = { t: 'n', f: formula };

      if (totalPossible > 0) {
        const pctAddr = XLSX.utils.encode_cell({ r: excelRow - 1, c: pctCol });
        const totalRef = `${colLetter(totalCol)}${excelRow}`;
        mgSheet[pctAddr] = { t: 'n', f: `IFERROR(${totalRef}/${totalPossible},0)` };
      }
    }
  }

  // Column widths
  const mgColWidths: XLSX.ColInfo[] = [
    { wch: 20 }, // Student Name
    { wch: 14 }, // Student ID
    { wch: 12 }, // Version
  ];
  for (let i = 0; i < maxQ; i++) mgColWidths.push({ wch: 10 });
  mgColWidths.push({ wch: 10 }); // Total
  mgColWidths.push({ wch: 12 }); // Percentage
  mgSheet['!cols'] = mgColWidths;

  XLSX.utils.book_append_sheet(wb, mgSheet, 'MixedGrading');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
