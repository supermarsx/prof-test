import { Question, QuestionType, TestTemplate } from '../models';
import { seededShuffle } from './seededShuffle';

export interface AssemblyConstraints {
  totalQuestions: number;
  topicDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
  typeDistribution?: Record<QuestionType, number>;
  excludeTags?: string[];
  requireTags?: string[];
  excludeQuestionIds?: string[];
  seed?: number;
  sections?: SectionConstraint[];
}

export interface SectionConstraint {
  sectionId: string;
  sectionName?: string;
  questionCount: number;
  allowedTypes?: QuestionType[];
  topicDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
}

export interface SolverResult {
  success: boolean;
  questions: Question[];
  warnings: string[];
  unmetConstraints: string[];
  sectionResults?: Array<{ sectionId: string; questions: Question[]; warnings: string[] }>;
}

export interface SelectionConstraints {
  total_questions: number;
  topic_distribution?: Record<string, number>;
  difficulty_distribution?: Record<string, number>;
  type_distribution?: Record<string, number>;
  exclude_tags?: string[];
}

export interface SelectionResult {
  selected: Question[];
  warnings: string[];
}

interface DifficultyRange {
  min: number;
  max: number;
}

const DIFFICULTY_MAP: Record<string, DifficultyRange> = {
  easy: { min: 1, max: 2 },
  medium: { min: 3, max: 3 },
  hard: { min: 4, max: 5 },
};

function matchesDifficulty(question: Question, diffLabel: string): boolean {
  const d = question.difficulty || 3;
  const num = parseInt(diffLabel, 10);
  if (!Number.isNaN(num)) return d === num;
  const range = DIFFICULTY_MAP[diffLabel.toLowerCase()];
  if (range) return d >= range.min && d <= range.max;
  return false;
}

function isPercentage(distribution: Record<string, number>): boolean {
  const sum = Object.values(distribution).reduce((a, b) => a + b, 0);
  return sum <= 1.01 && sum >= 0.99;
}

function distributionToCounts(distribution: Record<string, number>, total: number): Record<string, number> {
  if (isPercentage(distribution)) {
    const counts: Record<string, number> = {};
    let allocated = 0;
    const entries = Object.entries(distribution);
    for (let i = 0; i < entries.length; i++) {
      const [key, pct] = entries[i];
      if (i === entries.length - 1) {
        counts[key] = total - allocated;
      } else {
        counts[key] = Math.round(pct * total);
        allocated += counts[key];
      }
    }
    return counts;
  }
  return { ...distribution };
}

export function solveConstraints(bank: Question[], constraints: AssemblyConstraints): SolverResult {
  const warnings: string[] = [];
  const unmetConstraints: string[] = [];
  const selected: Question[] = [];
  const usedIds = new Set<string>(constraints.excludeQuestionIds || []);
  const seed = constraints.seed || Date.now();

  let pool = bank.filter((q) => {
    if (usedIds.has(q.id)) return false;
    if (constraints.excludeTags?.length && q.tags?.some((t) => constraints.excludeTags!.includes(t))) {
      return false;
    }
    if (constraints.requireTags?.length && !constraints.requireTags.every((t) => q.tags?.includes(t))) {
      return false;
    }
    return true;
  });

  pool = seededShuffle(pool, seed);

  if (constraints.sections && constraints.sections.length > 0) {
    const sectionResults: Array<{ sectionId: string; questions: Question[]; warnings: string[] }> = [];

    for (const secConstraint of constraints.sections) {
      const secWarnings: string[] = [];
      const secSelected: Question[] = [];

      const secPool = pool.filter((q) => {
        if (usedIds.has(q.id)) return false;
        if (secConstraint.allowedTypes?.length && !secConstraint.allowedTypes.includes(q.type)) {
          return false;
        }
        return true;
      });

      const secTotal = secConstraint.questionCount;

      if (secConstraint.topicDistribution && Object.keys(secConstraint.topicDistribution).length > 0) {
        const topicCounts = distributionToCounts(secConstraint.topicDistribution, secTotal);
        for (const [topic, count] of Object.entries(topicCounts)) {
          const topicPool = secPool.filter(
            (q) => (q.topic || '').toLowerCase() === topic.toLowerCase() && !usedIds.has(q.id),
          );
          const toSelect = Math.min(count, topicPool.length);
          for (let i = 0; i < toSelect; i++) {
            secSelected.push(topicPool[i]);
            usedIds.add(topicPool[i].id);
          }
          if (toSelect < count) {
            secWarnings.push(
              `Section "${secConstraint.sectionName || secConstraint.sectionId}": only ${toSelect} of ${count} for topic "${topic}"`,
            );
          }
        }
      }

      if (secConstraint.difficultyDistribution && Object.keys(secConstraint.difficultyDistribution).length > 0) {
        const diffCounts = distributionToCounts(secConstraint.difficultyDistribution, secTotal);
        for (const [diffLabel, count] of Object.entries(diffCounts)) {
          const currentCount = secSelected.filter((q) => matchesDifficulty(q, diffLabel)).length;
          const needed = Math.max(0, count - currentCount);
          if (needed > 0) {
            const diffPool = secPool.filter((q) => matchesDifficulty(q, diffLabel) && !usedIds.has(q.id));
            const toSelect = Math.min(needed, diffPool.length);
            for (let i = 0; i < toSelect; i++) {
              secSelected.push(diffPool[i]);
              usedIds.add(diffPool[i].id);
            }
            if (toSelect < needed) {
              secWarnings.push(
                `Section "${secConstraint.sectionName || secConstraint.sectionId}": only ${currentCount + toSelect} of ${count} at difficulty "${diffLabel}"`,
              );
            }
          }
        }
      }

      const remaining = secTotal - secSelected.length;
      if (remaining > 0) {
        const fillPool = secPool.filter((q) => !usedIds.has(q.id));
        const toFill = Math.min(remaining, fillPool.length);
        for (let i = 0; i < toFill; i++) {
          secSelected.push(fillPool[i]);
          usedIds.add(fillPool[i].id);
        }
        if (toFill < remaining) {
          secWarnings.push(
            `Section "${secConstraint.sectionName || secConstraint.sectionId}": could only select ${secSelected.length} of ${secTotal} questions`,
          );
        }
      }

      const shuffled = seededShuffle(secSelected, seed + sectionResults.length);
      sectionResults.push({ sectionId: secConstraint.sectionId, questions: shuffled, warnings: secWarnings });
      selected.push(...shuffled);
      warnings.push(...secWarnings);
    }

    if (warnings.length > 0) {
      unmetConstraints.push('section_constraints');
    }

    return {
      success: unmetConstraints.length === 0,
      questions: selected,
      warnings,
      unmetConstraints,
      sectionResults,
    };
  }

  const total = constraints.totalQuestions;

  if (constraints.topicDistribution && Object.keys(constraints.topicDistribution).length > 0) {
    const topicCounts = distributionToCounts(constraints.topicDistribution, total);
    for (const [topic, count] of Object.entries(topicCounts)) {
      const topicPool = pool.filter(
        (q) => (q.topic || '').toLowerCase() === topic.toLowerCase() && !usedIds.has(q.id),
      );
      const toSelect = Math.min(count, topicPool.length);
      for (let i = 0; i < toSelect; i++) {
        selected.push(topicPool[i]);
        usedIds.add(topicPool[i].id);
      }
      if (toSelect < count) {
        warnings.push(`Only ${toSelect} of ${count} questions available for topic "${topic}"`);
        unmetConstraints.push(`topic:${topic}`);
      }
    }
  }

  if (constraints.difficultyDistribution && Object.keys(constraints.difficultyDistribution).length > 0) {
    const diffCounts = distributionToCounts(constraints.difficultyDistribution, total);
    for (const [diffLabel, count] of Object.entries(diffCounts)) {
      const currentCount = selected.filter((q) => matchesDifficulty(q, diffLabel)).length;
      const needed = Math.max(0, count - currentCount);
      if (needed > 0) {
        const diffPool = pool.filter((q) => matchesDifficulty(q, diffLabel) && !usedIds.has(q.id));
        const toSelect = Math.min(needed, diffPool.length);
        for (let i = 0; i < toSelect; i++) {
          selected.push(diffPool[i]);
          usedIds.add(diffPool[i].id);
        }
        if (toSelect < needed) {
          warnings.push(`Only ${currentCount + toSelect} of ${count} questions at difficulty "${diffLabel}"`);
          unmetConstraints.push(`difficulty:${diffLabel}`);
        }
      }
    }
  }

  if (constraints.typeDistribution && Object.keys(constraints.typeDistribution).length > 0) {
    const typeCounts = distributionToCounts(constraints.typeDistribution, total);
    for (const [type, count] of Object.entries(typeCounts)) {
      const currentCount = selected.filter((q) => q.type === type).length;
      const needed = Math.max(0, count - currentCount);
      if (needed > 0) {
        const typePool = pool.filter((q) => q.type === type && !usedIds.has(q.id));
        const toSelect = Math.min(needed, typePool.length);
        for (let i = 0; i < toSelect; i++) {
          selected.push(typePool[i]);
          usedIds.add(typePool[i].id);
        }
        if (toSelect < needed) {
          warnings.push(`Only ${currentCount + toSelect} of ${count} questions of type "${type}"`);
          unmetConstraints.push(`type:${type}`);
        }
      }
    }
  }

  const remaining = total - selected.length;
  if (remaining > 0) {
    const fillPool = pool.filter((q) => !usedIds.has(q.id));
    const toFill = Math.min(remaining, fillPool.length);
    for (let i = 0; i < toFill; i++) {
      selected.push(fillPool[i]);
      usedIds.add(fillPool[i].id);
    }
    if (toFill < remaining) {
      warnings.push(`Could only select ${selected.length} of ${total} requested questions from bank`);
      unmetConstraints.push('total_questions');
    }
  }

  const finalSelection = seededShuffle(selected, seed + 999);

  return {
    success: unmetConstraints.length === 0,
    questions: finalSelection,
    warnings,
    unmetConstraints,
  };
}

export function constraintsFromTemplate(template: TestTemplate): SelectionConstraints {
  const c = template.constraints ?? {};
  const total = c.total_questions ?? 0;
  const toCountMap = (src: Record<string, number> | undefined): Record<string, number> | undefined => {
    if (!src) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
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

export function selectQuestions(pool: Question[], constraints: SelectionConstraints): SelectionResult {
  const warnings: string[] = [];

  let candidates = pool;
  if (constraints.exclude_tags?.length) {
    const excluded = new Set(constraints.exclude_tags.map((t) => t.toLowerCase()));
    candidates = candidates.filter((q) => !q.tags || !q.tags.some((t) => excluded.has(t.toLowerCase())));
  }

  const total = constraints.total_questions;
  if (total <= 0) {
    return { selected: [], warnings: ['total_questions must be > 0'] };
  }

  const selected = new Set<string>();

  const pick = (filter: (q: Question) => boolean): Question | undefined => {
    for (const q of candidates) {
      if (!selected.has(q.id) && filter(q)) {
        selected.add(q.id);
        return q;
      }
    }
    return undefined;
  };

  const fillBucket = (
    distribution: Record<string, number> | undefined,
    accessor: (q: Question) => string | undefined,
    label: string,
  ) => {
    if (!distribution) return;
    for (const [key, count] of Object.entries(distribution)) {
      let filled = 0;
      for (let i = 0; i < count; i++) {
        if (pick((q) => (accessor(q) ?? '') === key)) filled++;
      }
      if (filled < count) {
        warnings.push(`Could only select ${filled}/${count} questions for ${label}="${key}"`);
      }
    }
  };

  fillBucket(constraints.topic_distribution, (q) => q.topic, 'topic');
  fillBucket(constraints.difficulty_distribution, (q) => (q.difficulty != null ? String(q.difficulty) : undefined), 'difficulty');
  fillBucket(constraints.type_distribution, (q) => q.type, 'type');

  if (selected.size < total) {
    for (const q of candidates) {
      if (selected.size >= total) break;
      if (!selected.has(q.id)) selected.add(q.id);
    }
  }

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
