import { Question, QuestionType } from '../models';
import { seededShuffle } from './seededShuffle';

export interface AssemblyConstraints {
  totalQuestions: number;
  topicDistribution?: Record<string, number>; // topic -> count or percentage
  difficultyDistribution?: Record<string, number>; // "easy"|"medium"|"hard" or "1"|"2"|"3"|"4"|"5" -> percentage
  typeDistribution?: Record<QuestionType, number>; // type -> count or percentage
  excludeTags?: string[];
  requireTags?: string[];
  excludeQuestionIds?: string[];
  seed?: number;
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
  // Direct numeric label
  const num = parseInt(diffLabel, 10);
  if (!isNaN(num)) return d === num;
  // Named label
  const range = DIFFICULTY_MAP[diffLabel.toLowerCase()];
  if (range) return d >= range.min && d <= range.max;
  return false;
}

function isPercentage(distribution: Record<string, number>): boolean {
  const sum = Object.values(distribution).reduce((a, b) => a + b, 0);
  return sum <= 1.01 && sum >= 0.99; // allow small floating point variance
}

function distributionToCounts(distribution: Record<string, number>, total: number): Record<string, number> {
  if (isPercentage(distribution)) {
    const counts: Record<string, number> = {};
    let allocated = 0;
    const entries = Object.entries(distribution);
    for (let i = 0; i < entries.length; i++) {
      const [key, pct] = entries[i];
      if (i === entries.length - 1) {
        counts[key] = total - allocated; // give remainder to last bucket
      } else {
        counts[key] = Math.round(pct * total);
        allocated += counts[key];
      }
    }
    return counts;
  }
  return { ...distribution };
}

export interface SolverResult {
  success: boolean;
  questions: Question[];
  warnings: string[];
  unmetConstraints: string[];
}

export function solveConstraints(
  bank: Question[],
  constraints: AssemblyConstraints
): SolverResult {
  const warnings: string[] = [];
  const unmetConstraints: string[] = [];
  const selected: Question[] = [];
  const usedIds = new Set<string>(constraints.excludeQuestionIds || []);
  const seed = constraints.seed || Date.now();

  // Filter bank: exclude by tags and IDs
  let pool = bank.filter(q => {
    if (usedIds.has(q.id)) return false;
    if (constraints.excludeTags?.length) {
      if (q.tags?.some(t => constraints.excludeTags!.includes(t))) return false;
    }
    if (constraints.requireTags?.length) {
      if (!constraints.requireTags.every(t => q.tags?.includes(t))) return false;
    }
    return true;
  });

  // Shuffle the pool for randomness
  pool = seededShuffle(pool, seed);

  const total = constraints.totalQuestions;

  // Strategy: satisfy specific constraints first, then fill remaining

  // 1. Topic distribution
  if (constraints.topicDistribution && Object.keys(constraints.topicDistribution).length > 0) {
    const topicCounts = distributionToCounts(constraints.topicDistribution, total);
    for (const [topic, count] of Object.entries(topicCounts)) {
      const topicPool = pool.filter(q => 
        (q.topic || '').toLowerCase() === topic.toLowerCase() && !usedIds.has(q.id)
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

  // 2. Difficulty distribution (add more if needed)
  if (constraints.difficultyDistribution && Object.keys(constraints.difficultyDistribution).length > 0) {
    const diffCounts = distributionToCounts(constraints.difficultyDistribution, total);
    for (const [diffLabel, count] of Object.entries(diffCounts)) {
      const currentCount = selected.filter(q => matchesDifficulty(q, diffLabel)).length;
      const needed = Math.max(0, count - currentCount);
      if (needed > 0) {
        const diffPool = pool.filter(q => matchesDifficulty(q, diffLabel) && !usedIds.has(q.id));
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

  // 3. Type distribution
  if (constraints.typeDistribution && Object.keys(constraints.typeDistribution).length > 0) {
    const typeCounts = distributionToCounts(constraints.typeDistribution, total);
    for (const [type, count] of Object.entries(typeCounts)) {
      const currentCount = selected.filter(q => q.type === type).length;
      const needed = Math.max(0, count - currentCount);
      if (needed > 0) {
        const typePool = pool.filter(q => q.type === type && !usedIds.has(q.id));
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

  // 4. Fill remaining slots
  const remaining = total - selected.length;
  if (remaining > 0) {
    const fillPool = pool.filter(q => !usedIds.has(q.id));
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

  // Final shuffle of selection
  const finalSelection = seededShuffle(selected, seed + 999);

  return {
    success: unmetConstraints.length === 0,
    questions: finalSelection,
    warnings,
    unmetConstraints,
  };
}
