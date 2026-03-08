import { Question, QuestionInstance, SectionDefinition, TestTemplate } from '../models';

/**
 * An assembled section holds resolved question instances with points and
 * include/exclude state so the UI can toggle visibility without removing.
 */
export interface AssembledQuestion {
  /** The resolved question instance with ordering and point info. */
  instance: QuestionInstance;
  /** The full question data for display / LaTeX rendering. */
  question: Question;
  /** When false the question is excluded from rendered output but kept in the structure. */
  included: boolean;
}

export interface AssembledSection {
  definition: SectionDefinition;
  questions: AssembledQuestion[];
}

export interface AssembledTest {
  template: TestTemplate;
  sections: AssembledSection[];
}

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

/** Create a new blank section at the end of the section list. */
export function addSection(test: AssembledTest, section: SectionDefinition): AssembledTest {
  const order = test.sections.length;
  const def = { ...section, order_index: section.order_index ?? order };
  return {
    ...test,
    sections: [...test.sections, { definition: def, questions: [] }],
  };
}

/** Remove a section by id (questions are discarded). */
export function removeSection(test: AssembledTest, sectionId: string): AssembledTest {
  return {
    ...test,
    sections: test.sections
      .filter((s) => s.definition.id !== sectionId)
      .map((s, idx) => ({
        ...s,
        definition: { ...s.definition, order_index: idx },
      })),
  };
}

/** Move a section from one index to another. */
export function reorderSection(test: AssembledTest, fromIndex: number, toIndex: number): AssembledTest {
  const sections = [...test.sections];
  const [moved] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, moved);
  return {
    ...test,
    sections: sections.map((s, idx) => ({
      ...s,
      definition: { ...s.definition, order_index: idx },
    })),
  };
}

// ---------------------------------------------------------------------------
// Question-in-section helpers
// ---------------------------------------------------------------------------

/** Add a question to a section with default points. */
export function addQuestionToSection(
  test: AssembledTest,
  sectionId: string,
  question: Question,
  points: number = 1,
): AssembledTest {
  return {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== sectionId) return s;
      const orderIndex = s.questions.length;
      const instance: QuestionInstance = {
        id: `${question.id}_sec_${sectionId}_${orderIndex}`,
        base_question_id: question.id,
        points,
        order_index: orderIndex,
      };
      return {
        ...s,
        questions: [...s.questions, { instance, question, included: true }],
      };
    }),
  };
}

/** Remove a question from a section by question instance id. */
export function removeQuestionFromSection(
  test: AssembledTest,
  sectionId: string,
  instanceId: string,
): AssembledTest {
  return {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== sectionId) return s;
      return {
        ...s,
        questions: s.questions
          .filter((q) => q.instance.id !== instanceId)
          .map((q, idx) => ({
            ...q,
            instance: { ...q.instance, order_index: idx },
          })),
      };
    }),
  };
}

/** Reorder a question within a section. */
export function reorderQuestionInSection(
  test: AssembledTest,
  sectionId: string,
  fromIndex: number,
  toIndex: number,
): AssembledTest {
  return {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== sectionId) return s;
      const qs = [...s.questions];
      const [moved] = qs.splice(fromIndex, 1);
      qs.splice(toIndex, 0, moved);
      return {
        ...s,
        questions: qs.map((q, idx) => ({
          ...q,
          instance: { ...q.instance, order_index: idx },
        })),
      };
    }),
  };
}

/** Move a question from one section to another. */
export function moveQuestionBetweenSections(
  test: AssembledTest,
  fromSectionId: string,
  toSectionId: string,
  instanceId: string,
  toIndex?: number,
): AssembledTest {
  let movedItem: AssembledQuestion | undefined;
  // Remove from source
  let result = {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== fromSectionId) return s;
      const idx = s.questions.findIndex((q) => q.instance.id === instanceId);
      if (idx === -1) return s;
      movedItem = s.questions[idx];
      return {
        ...s,
        questions: s.questions
          .filter((_, i) => i !== idx)
          .map((q, i) => ({ ...q, instance: { ...q.instance, order_index: i } })),
      };
    }),
  };
  if (!movedItem) return test;
  // Insert into target
  const item = movedItem;
  result = {
    ...result,
    sections: result.sections.map((s) => {
      if (s.definition.id !== toSectionId) return s;
      const qs = [...s.questions];
      const insertAt = toIndex != null ? toIndex : qs.length;
      const newInstance: QuestionInstance = {
        ...item.instance,
        id: `${item.instance.base_question_id}_sec_${toSectionId}_${insertAt}`,
        order_index: insertAt,
      };
      qs.splice(insertAt, 0, { ...item, instance: newInstance });
      return {
        ...s,
        questions: qs.map((q, i) => ({ ...q, instance: { ...q.instance, order_index: i } })),
      };
    }),
  };
  return result;
}

/** Set the points for a question instance. */
export function setQuestionPoints(
  test: AssembledTest,
  sectionId: string,
  instanceId: string,
  points: number,
): AssembledTest {
  return {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== sectionId) return s;
      return {
        ...s,
        questions: s.questions.map((q) =>
          q.instance.id === instanceId
            ? { ...q, instance: { ...q.instance, points } }
            : q,
        ),
      };
    }),
  };
}

/** Toggle include/exclude for a question without removing it. */
export function toggleQuestionIncluded(
  test: AssembledTest,
  sectionId: string,
  instanceId: string,
): AssembledTest {
  return {
    ...test,
    sections: test.sections.map((s) => {
      if (s.definition.id !== sectionId) return s;
      return {
        ...s,
        questions: s.questions.map((q) =>
          q.instance.id === instanceId ? { ...q, included: !q.included } : q,
        ),
      };
    }),
  };
}

/** Get the total point count for included questions. */
export function totalPoints(test: AssembledTest): number {
  let sum = 0;
  for (const section of test.sections) {
    for (const q of section.questions) {
      if (q.included) sum += q.instance.points ?? 0;
    }
  }
  return sum;
}

/** Create a fresh AssembledTest from a TestTemplate. */
export function createAssembledTest(template: TestTemplate): AssembledTest {
  const sections: AssembledSection[] = (template.sections ?? []).map((def, idx) => ({
    definition: { ...def, order_index: def.order_index ?? idx },
    questions: [],
  }));
  return { template, sections };
}
