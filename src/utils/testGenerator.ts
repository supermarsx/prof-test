import { seededShuffle } from './seededShuffle';
import { Question, TestInstance, QuestionInstance, VersionChangeEntry, VersionChangeLog } from '../models';

/** A section of questions for section-aware generation */
export interface SectionInput {
  id: string;
  name: string;
  questionIds: string[];
}

export interface GenerateOptions {
  versions: number;
  seed?: number;
  swapEquivalentQuestions?: boolean;
  templateId?: string;
  /** When provided, shuffling happens within each section and section order is preserved */
  sections?: SectionInput[];
}

export interface GenerateResult {
  versions: TestInstance[];
  changeLog: VersionChangeLog;
}

function groupEquivalents(questions: Question[]): Map<string, Question[]> {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const key = `${q.topic || 'none'}|${q.difficulty || 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }
  return groups;
}

function getEquivalentKey(q: Question): string {
  return `${q.topic || 'none'}|${q.difficulty || 0}`;
}

/**
 * Apply equivalent-question swaps within a group of questions for a given version seed.
 * Returns the (possibly swapped) questions and a list of change descriptions.
 */
function applySwaps(
  questions: Question[],
  seed: number,
  equivalentGroups: Map<string, Question[]>,
  sectionLabel: string,
): { result: Question[]; changes: string[] } {
  const changes: string[] = [];
  const groupShuffles = new Map<string, Question[]>();
  const groupIndexes = new Map<string, number>();
  const result = questions.map((q, idx) => {
    const key = getEquivalentKey(q);
    const group = equivalentGroups.get(key)!;
    if (group.length < 2) return q;
    if (!groupShuffles.has(key)) {
      const groupSeed = seed + hashString(key);
      groupShuffles.set(key, seededShuffle(group, groupSeed));
      groupIndexes.set(key, 0);
    }
    const shuffledGroup = groupShuffles.get(key)!;
    const pickIdx = groupIndexes.get(key)!;
    const picked = shuffledGroup[pickIdx % shuffledGroup.length];
    groupIndexes.set(key, pickIdx + 1);
    if (picked.id !== q.id) {
      changes.push(`${sectionLabel}Position ${idx + 1}: swapped ${q.id} with equivalent ${picked.id}`);
    }
    return picked;
  });
  return { result, changes };
}

/**
 * Shuffle a flat list of questions and return change descriptions.
 */
function shuffleQuestions(
  questions: Question[],
  seed: number,
  sectionLabel: string,
): { shuffled: Question[]; changes: string[] } {
  const changes: string[] = [];
  const shuffled = seededShuffle(questions, seed);
  const originalOrder = shuffled.map((sq) => {
    const origIdx = questions.indexOf(sq);
    return origIdx + 1;
  });
  const isReordered = originalOrder.some((o, i) => o !== i + 1);
  if (isReordered) {
    changes.push(`${sectionLabel}Questions shuffled: original order [${originalOrder.join(',')}]`);
  }
  return { shuffled, changes };
}

/**
 * Shuffle choices for MC/MS questions and return change descriptions.
 */
function shuffleChoices(
  questions: Question[],
  seed: number,
  globalOffset: number,
  sectionLabel: string,
): { result: Question[]; changes: string[] } {
  const changes: string[] = [];
  const result = questions.map((q, idx) => {
    if (q.choices && (q.type === 'multiple_choice' || q.type === 'multiple_select')) {
      const choiceSeed = seed + globalOffset + idx + 1000;
      const shuffledChoices = seededShuffle(q.choices, choiceSeed);
      const choicesChanged = shuffledChoices.some((c, ci) => c !== q.choices![ci]);
      if (choicesChanged) {
        changes.push(`${sectionLabel}Q${globalOffset + idx + 1}: choices reshuffled`);
      }
      return { ...q, choices: shuffledChoices };
    }
    return q;
  });
  return { result, changes };
}

export function generateTestVersions(baseQuestions: Question[], options: GenerateOptions): GenerateResult {
  const versions: TestInstance[] = [];
  const baseSeed = options.seed || 1;
  const swapEnabled = !!options.swapEquivalentQuestions;
  const equivalentGroups = swapEnabled ? groupEquivalents(baseQuestions) : new Map<string, Question[]>();
  const entries: VersionChangeEntry[] = [];
  const hasSections = options.sections && options.sections.length > 0;

  // Build a lookup map: questionId -> Question
  const questionMap = new Map<string, Question>();
  for (const q of baseQuestions) {
    questionMap.set(q.id, q);
  }

  for (let v = 0; v < options.versions; v++) {
    const seed = baseSeed + v;
    const changes: string[] = [];
    let finalQuestions: Question[];

    if (hasSections) {
      // --- Section-aware mode: shuffle within each section, preserve section order ---
      finalQuestions = [];
      let globalOffset = 0;
      for (const section of options.sections!) {
        const sectionLabel = `[${section.name}] `;
        // Resolve questions for this section
        let sectionQuestions = section.questionIds
          .map(id => questionMap.get(id))
          .filter(Boolean) as Question[];

        // Step 1: Swap equivalents within section
        if (swapEnabled) {
          const swapResult = applySwaps(sectionQuestions, seed, equivalentGroups, sectionLabel);
          sectionQuestions = swapResult.result;
          changes.push(...swapResult.changes);
        }

        // Step 2: Shuffle question order within section
        const sectionSeed = seed + hashString(section.id);
        const shuffleResult = shuffleQuestions(sectionQuestions, sectionSeed, sectionLabel);
        sectionQuestions = shuffleResult.shuffled;
        changes.push(...shuffleResult.changes);

        // Step 3: Shuffle choices within section
        const choiceResult = shuffleChoices(sectionQuestions, seed, globalOffset, sectionLabel);
        sectionQuestions = choiceResult.result;
        changes.push(...choiceResult.changes);

        finalQuestions.push(...sectionQuestions);
        globalOffset += sectionQuestions.length;
      }
    } else {
      // --- Flat mode (backwards compatible): shuffle all questions together ---
      let questionsForVersion: Question[];
      if (swapEnabled) {
        const swapResult = applySwaps(baseQuestions, seed, equivalentGroups, '');
        questionsForVersion = swapResult.result;
        changes.push(...swapResult.changes);
      } else {
        questionsForVersion = baseQuestions;
      }

      const shuffleResult = shuffleQuestions(questionsForVersion, seed, '');
      const shuffled = shuffleResult.shuffled;
      changes.push(...shuffleResult.changes);

      const choiceResult = shuffleChoices(shuffled, seed, 0, '');
      finalQuestions = choiceResult.result;
      changes.push(...choiceResult.changes);
    }

    const questionInstances: QuestionInstance[] = finalQuestions.map((q, idx) => ({
      id: `${q.id}_v${v}`,
      base_question_id: q.id,
      order_index: idx,
    }));
    const answer_key: Record<string, any> = {};
    questionInstances.forEach((qi, idx) => {
      const base = finalQuestions[idx];
      if (base.choices && base.choices.length) {
        const correct = base.choices.filter((c) => (c as any).is_correct).map((c) => (c as any).id);
        answer_key[idx + 1] = correct;
      } else {
        answer_key[idx + 1] = null;
      }
    });

    const versionLabel = String.fromCharCode(65 + v);
    entries.push({ version_label: versionLabel, changes });

    versions.push({
      id: `version-${v}`,
      version_label: versionLabel,
      random_seed: seed,
      generated_questions: questionInstances,
      answer_key,
    });
  }

  const changeLog: VersionChangeLog = {
    template_id: options.templateId || '',
    generated_at: new Date().toISOString(),
    entries,
  };

  return { versions, changeLog };
}

/** Simple string hash to derive a numeric seed offset from a group key */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
