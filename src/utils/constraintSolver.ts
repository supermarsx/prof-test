import { Question, QuestionType, TestTemplate } from '../models';

/**
 * Constraints that guide automatic question selection.
 * All distribution fields map label → count (not percentage).
 */
export interface SelectionConstraints {
  /** Total number of questions to select. */
  total_questions: number;
  /** topic label → desired count. */
  topic_distribution?: Record<string, number>;
  /** difficulty level (as string "1"-"5") → desired count. */
  difficulty_distribution?: Record<string, number>;
  /** QuestionType → desired count. */
  type_distribution?: Record<string, number>;
  /** Tags to exclude – any question having one of these tags is filtered out. */
  exclude_tags?: string[];
}

export interface SelectionResult {
  /** Selected questions in stable order. */
  selected: Question[];
  /** Human-readable warnings (e.g. unfulfilled constraints). */
  warnings: string[];
}

/**
 * Derive concrete counts from a TestTemplate's constraints object.
 * Percentage values (0–1) are converted to absolute counts.
 */
export function constraintsFromTemplate(template: TestTemplate): SelectionConstraints {
  const c = template.constraints ?? {};
  const total = c.total_questions ?? 0;
  const toCountMap = (src: Record<string, number> | undefined): Record<string, number> | undefined => {
    if (!src) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      // If value is between 0 and 1 treat as percentage of total
      out[k] = v > 0 && v <= 1 ? Math.round(v * total) : v;
    }
    return out;
  };
  return {
    total_questions: total,
    topic_distribution: toCountMap(c.topic_distribution),
    difficulty_distribution: toCountMap(c.difficulty_distribution),
    type_distribution: toCountMap(c.type_distribution),
  };
}

/**
 * Select questions from `pool` that best satisfy `constraints`.
 *
 * Algorithm:
 * 1. Filter pool by exclude_tags.
 * 2. Greedily fill distribution buckets (topic, difficulty, type).
 * 3. If buckets are under-filled, add remaining questions by priority.
 * 4. If total is still under, warn.
 */
export function selectQuestions(pool: Question[], constraints: SelectionConstraints): SelectionResult {
  const warnings: string[] = [];

  // Step 1 – filter excluded tags
  let candidates = pool;
  if (constraints.exclude_tags && constraints.exclude_tags.length > 0) {
    const excluded = new Set(constraints.exclude_tags.map((t) => t.toLowerCase()));
    candidates = candidates.filter(
      (q) => !q.tags || !q.tags.some((t) => excluded.has(t.toLowerCase())),
    );
  }

  const total = constraints.total_questions;
  if (total <= 0) return { selected: [], warnings: ['total_questions must be > 0'] };

  const selected = new Set<string>(); // track by question id
  const idToQuestion = new Map<string, Question>();
  for (const q of candidates) idToQuestion.set(q.id, q);

  // Helper: pick first matching candidate that isn't already selected
  const pick = (filter: (q: Question) => boolean): Question | undefined => {
    for (const q of candidates) {
      if (!selected.has(q.id) && filter(q)) {
        selected.add(q.id);
        return q;
      }
    }
    return undefined;
  };

  // Step 2 – fill distribution buckets in order: topic, difficulty, type.
  const fillBucket = (
    distribution: Record<string, number> | undefined,
    accessor: (q: Question) => string | undefined,
    label: string,
  ) => {
    if (!distribution) return;
    for (const [key, count] of Object.entries(distribution)) {
      let filled = 0;
      for (let i = 0; i < count; i++) {
        const q = pick((q) => (accessor(q) ?? '') === key);
        if (q) filled++;
      }
      if (filled < count) {
        warnings.push(`Could only select ${filled}/${count} questions for ${label}="${key}"`);
      }
    }
  };

  fillBucket(constraints.topic_distribution, (q) => q.topic, 'topic');
  fillBucket(constraints.difficulty_distribution, (q) => q.difficulty != null ? String(q.difficulty) : undefined, 'difficulty');
  fillBucket(constraints.type_distribution, (q) => q.type, 'type');

  // Step 3 – fill remaining slots up to total
  if (selected.size < total) {
    for (const q of candidates) {
      if (selected.size >= total) break;
      if (!selected.has(q.id)) selected.add(q.id);
    }
  }

  // Trim to total if over-selected from multiple overlapping buckets
  const result: Question[] = [];
  for (const q of candidates) {
    if (result.length >= total) break;
    if (selected.has(q.id)) result.push(q);
  }

  if (result.length < total) {
    warnings.push(`Only ${result.length} questions available; requested ${total}`);
  }

  return { selected: result, warnings };
}
