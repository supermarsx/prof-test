import { seededShuffle } from './seededShuffle';
import { Question, TestInstance, QuestionInstance } from '../models';

export interface GenerateOptions {
  versions: number;
  seed?: number;
}

export function generateTestVersions(baseQuestions: Question[], options: GenerateOptions): TestInstance[] {
  const versions: TestInstance[] = [];
  const baseSeed = options.seed || 1;
  for (let v = 0; v < options.versions; v++) {
    const seed = baseSeed + v;
    const shuffled = seededShuffle(baseQuestions, seed);
    const questionInstances: QuestionInstance[] = shuffled.map((q, idx) => ({
      id: `${q.id}_v${v}`,
      base_question_id: q.id,
      order_index: idx,
    }));
    const answer_key: Record<string, any> = {};
    // naive: for MC, pick correct choice ids
    questionInstances.forEach((qi, idx) => {
      const base = shuffled[idx];
      if (base.choices && base.choices.length) {
        const correct = base.choices.filter((c) => (c as any).is_correct).map((c) => (c as any).id);
        answer_key[idx + 1] = correct;
      } else {
        answer_key[idx + 1] = null;
      }
    });

    versions.push({
      id: `version-${v}`,
      version_label: String.fromCharCode(65 + v),
      random_seed: seed,
      generated_questions: questionInstances,
      answer_key,
    });
  }
  return versions;
}
