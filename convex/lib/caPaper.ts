import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  activeAssessmentsFor,
  type ClassSubjectKey,
  classKeyOf,
  type GradeTarget,
  recomputeGrade,
  scheduleClassRecompute,
  scheduleRecompute,
} from "../computedGrades";

/**
 * The CA Paper module: what makes an Assessment's questions and marks valid
 * (ADR-0004). Every write to `assessments`, `assessmentQuestions` and
 * `studentAssessmentAnswers` goes through here, so the rules live once:
 *
 * - a mark is between 0 and its question's allocation;
 * - the question belongs to the paper being marked;
 * - an Absent student's marks are 0;
 * - an allocation is positive, never below a mark already entered, and the
 *   allocations sum to at most the paper total;
 * - one active CA-N per subject + term + level + year;
 * - deleting cascades, and every change recomputes the grades it moves.
 *
 * No permission checks: the calling mutation does `requireCapability` first.
 */

/** Questions per paper read in one go; a paper has a few dozen at most. */
const MAX_QUESTIONS = 200;
/** Answers read per cascade / check: a few hundred students × questions. */
const MAX_ANSWERS = 5000;
/**
 * A grid save recomputes each student's grade in the same transaction up to
 * this many students (≈ 100 docs read per student). Larger payloads go to the
 * scheduled, chunked batch.
 */
const INLINE_RECOMPUTE_MAX = 50;

type Ctx = QueryCtx | MutationCtx;

// ── Reads ────────────────────────────────────────────────────────────────────

/** The real CA total: the sum of the marks on the paper (ADR-0004). */
export function questionTotal(questions: { marksAllocated: number }[]): number {
  return questions.reduce((sum, q) => sum + q.marksAllocated, 0);
}

/** A paper's questions, in display order. */
export function paperQuestions(
  ctx: Ctx,
  assessmentId: Id<"assessments">,
): Promise<Doc<"assessmentQuestions">[]> {
  return ctx.db
    .query("assessmentQuestions")
    .withIndex("by_assessment_order", (q) => q.eq("assessmentId", assessmentId))
    .take(MAX_QUESTIONS);
}

async function getPaper(
  ctx: Ctx,
  assessmentId: Id<"assessments">,
): Promise<Doc<"assessments">> {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) throw new ConvexError("Assessment not found");
  return assessment;
}

async function getQuestion(
  ctx: Ctx,
  questionId: Id<"assessmentQuestions">,
): Promise<Doc<"assessmentQuestions">> {
  const question = await ctx.db.get(questionId);
  if (!question) throw new ConvexError("Question not found");
  return question;
}

/** Drop `undefined` values: `db.patch` would otherwise remove those fields. */
function defined<T extends object>(updates: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

// ── Rules ────────────────────────────────────────────────────────────────────

/** The allocation cap, the only copy: Σ question marks ≤ the paper total. */
function assertAllocationFits(paperTotal: number, allocated: number) {
  if (allocated > paperTotal) {
    throw new ConvexError(
      `Questions would add up to ${allocated} marks, more than the assessment total of ${paperTotal}.`,
    );
  }
}

function assertPositiveAllocation(marksAllocated: number) {
  if (!(marksAllocated > 0) || !Number.isFinite(marksAllocated)) {
    throw new ConvexError("A question must be worth more than 0 marks.");
  }
}

/**
 * Every entry's enrollment must be that student's, in the paper's level and
 * year. Open is not required: a late CA mark for a closed enrollment of that
 * year is legitimate. Without this the recompute would write (or delete) a
 * grade row in the wrong class.
 */
async function assertInPaperClass(
  ctx: Ctx,
  assessment: Doc<"assessments">,
  entries: { studentId: Id<"students">; enrollmentId: Id<"enrollments"> }[],
) {
  const ids = [...new Set(entries.map((e) => e.enrollmentId))];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const byId = new Map(ids.map((id, i) => [id, docs[i]]));
  const misplaced = entries.some((e) => {
    const en = byId.get(e.enrollmentId);
    return (
      !en ||
      en.studentId !== e.studentId ||
      en.standardLevelId !== assessment.standardLevelId ||
      en.academicYear !== assessment.academicYearId
    );
  });
  if (misplaced) {
    throw new ConvexError(
      "A student here is not in this assessment's class. Reload the page and try again.",
    );
  }
}

/**
 * Every classmate's grade for the paper's subject + term may have moved.
 * Always names the paper, so students who have marks on it but no grade row
 * yet are included. Runs after the transaction commits, so it may be called
 * before a cascade delete and still see the deletes.
 */
function recomputeClass(
  ctx: MutationCtx,
  assessment: Doc<"assessments">,
): Promise<number> {
  return scheduleClassRecompute(ctx, classKeyOf(assessment), assessment._id);
}

// ── Marks ────────────────────────────────────────────────────────────────────

export type MarkEntry = {
  studentId: Id<"students">;
  enrollmentId: Id<"enrollments">;
  questionId: Id<"assessmentQuestions">;
  marksObtained: number;
  isAbsent?: boolean;
  remarks?: string;
};

/**
 * Write marks on one paper and recompute the grades they move. Validates the
 * whole payload before any write. Returns the answer ids, one per distinct
 * (student, question), and how many students were touched.
 */
export async function enterMarks(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  entries: MarkEntry[],
): Promise<{ ids: Id<"studentAssessmentAnswers">[]; studentCount: number }> {
  const assessment = await getPaper(ctx, assessmentId);
  await assertInPaperClass(ctx, assessment, entries);

  const questions = await paperQuestions(ctx, assessmentId);
  const byQuestion = new Map(questions.map((q) => [q._id, q]));
  // Last entry wins for a repeated (student, question): one row each.
  const marks = new Map<string, MarkEntry>();
  for (const e of entries) {
    const question = byQuestion.get(e.questionId);
    if (!question) {
      throw new ConvexError(
        "A question here is not on this assessment. Reload the page and try again.",
      );
    }
    // Absent = a present 0 (CONTEXT.md), whatever the payload says.
    const marksObtained = e.isAbsent ? 0 : e.marksObtained;
    if (!(marksObtained >= 0 && marksObtained <= question.marksAllocated)) {
      throw new ConvexError(
        `Marks for question ${question.questionNumber} must be between 0 and ${question.marksAllocated}.`,
      );
    }
    marks.set(`${e.studentId}|${e.questionId}`, { ...e, marksObtained });
  }

  const targets = new Map<Id<"students">, GradeTarget>();
  for (const e of marks.values()) {
    targets.set(e.studentId, {
      studentId: e.studentId,
      enrollmentId: e.enrollmentId,
    });
  }
  // Each student's existing answers on this paper (≤ one per question).
  const existing = new Map<string, Id<"studentAssessmentAnswers">>();
  const perStudent = await Promise.all(
    [...targets.keys()].map((studentId) =>
      ctx.db
        .query("studentAssessmentAnswers")
        .withIndex("by_student_assessment", (q) =>
          q.eq("studentId", studentId).eq("assessmentId", assessmentId),
        )
        .take(MAX_QUESTIONS),
    ),
  );
  for (const a of perStudent.flat()) {
    existing.set(`${a.studentId}|${a.questionId}`, a._id);
  }

  const enteredAt = Date.now();
  const ids: Id<"studentAssessmentAnswers">[] = [];
  for (const [key, e] of marks) {
    const row = {
      marksObtained: e.marksObtained,
      isAbsent: e.isAbsent,
      remarks: e.remarks,
      enteredAt,
    };
    const id = existing.get(key);
    if (id) {
      await ctx.db.patch(id, row);
      ids.push(id);
    } else {
      ids.push(
        await ctx.db.insert("studentAssessmentAnswers", {
          studentId: e.studentId,
          enrollmentId: e.enrollmentId,
          assessmentId,
          questionId: e.questionId,
          ...row,
        }),
      );
    }
  }

  // Same transaction for a normal class save, so the grade never lags the
  // mark; the chunked batch when the payload is too large for one.
  const key = {
    subjectId: assessment.subjectId,
    semester: assessment.semester,
  };
  const list = [...targets.values()];
  if (list.length <= INLINE_RECOMPUTE_MAX) {
    await Promise.all(list.map((t) => recomputeGrade(ctx, { ...t, ...key })));
  } else {
    await scheduleRecompute(ctx, key, list);
  }
  return { ids, studentCount: list.length };
}

/** Mark a student Absent for a whole paper: a 0 on every question. */
export async function markAbsent(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    enrollmentId: Id<"enrollments">;
    assessmentId: Id<"assessments">;
  },
): Promise<void> {
  const questions = await paperQuestions(ctx, args.assessmentId);
  // Still validates the class when the paper has no questions yet.
  if (questions.length === 0) {
    const assessment = await getPaper(ctx, args.assessmentId);
    await assertInPaperClass(ctx, assessment, [args]);
    return;
  }
  await enterMarks(
    ctx,
    args.assessmentId,
    questions.map((q) => ({
      studentId: args.studentId,
      enrollmentId: args.enrollmentId,
      questionId: q._id,
      marksObtained: 0,
      isAbsent: true,
    })),
  );
}

// ── Questions ────────────────────────────────────────────────────────────────

export type NewQuestion = {
  questionNumber: number;
  marksAllocated: number;
  questionText?: string;
  learningObjective?: string;
  conceptTag?: string;
  displayOrder?: number;
};

/** Add questions to a paper. Returns their ids, in order. */
export async function addQuestions(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  questions: NewQuestion[],
): Promise<Id<"assessmentQuestions">[]> {
  const assessment = await getPaper(ctx, assessmentId);
  for (const q of questions) assertPositiveAllocation(q.marksAllocated);
  const existing = await paperQuestions(ctx, assessmentId);
  assertAllocationFits(
    assessment.totalMarks,
    questionTotal(existing) + questionTotal(questions),
  );
  const ids: Id<"assessmentQuestions">[] = [];
  for (const [i, q] of questions.entries()) {
    ids.push(
      await ctx.db.insert("assessmentQuestions", {
        assessmentId,
        questionNumber: q.questionNumber,
        marksAllocated: q.marksAllocated,
        questionText: q.questionText,
        learningObjective: q.learningObjective,
        conceptTag: q.conceptTag,
        displayOrder: q.displayOrder ?? existing.length + i + 1,
        isActive: true,
        createdAt: Date.now(),
      }),
    );
  }
  await recomputeClass(ctx, assessment);
  return ids;
}

/** Change a question's allocation or text. Returns the question as it was. */
export async function updateQuestion(
  ctx: MutationCtx,
  questionId: Id<"assessmentQuestions">,
  updates: { marksAllocated?: number; questionText?: string },
): Promise<Doc<"assessmentQuestions">> {
  const question = await getQuestion(ctx, questionId);
  const { marksAllocated } = updates;
  if (
    marksAllocated === undefined ||
    marksAllocated === question.marksAllocated
  ) {
    await ctx.db.patch(questionId, defined(updates));
    return question;
  }

  assertPositiveAllocation(marksAllocated);
  const assessment = await getPaper(ctx, question.assessmentId);
  const [siblings, answers] = await Promise.all([
    paperQuestions(ctx, question.assessmentId),
    ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_question", (q) => q.eq("questionId", questionId))
      .take(MAX_ANSWERS),
  ]);
  assertAllocationFits(
    assessment.totalMarks,
    questionTotal(siblings) - question.marksAllocated + marksAllocated,
  );
  // A mark above the new allocation would score the student over 100%.
  const highest = Math.max(0, ...answers.map((a) => a.marksObtained));
  if (marksAllocated < highest) {
    throw new ConvexError(
      `A student already has ${highest} marks on this question. Lower those marks before reducing it below ${highest}.`,
    );
  }
  await ctx.db.patch(questionId, defined(updates));
  await recomputeClass(ctx, assessment);
  return question;
}

/** Delete a question and the marks entered on it. Returns the question. */
export async function deleteQuestion(
  ctx: MutationCtx,
  questionId: Id<"assessmentQuestions">,
): Promise<Doc<"assessmentQuestions">> {
  const question = await getQuestion(ctx, questionId);
  const assessment = await ctx.db.get(question.assessmentId);
  if (assessment) await recomputeClass(ctx, assessment);
  const answers = await ctx.db
    .query("studentAssessmentAnswers")
    .withIndex("by_question", (q) => q.eq("questionId", questionId))
    .take(MAX_ANSWERS);
  await Promise.all(answers.map((a) => ctx.db.delete(a._id)));
  await ctx.db.delete(questionId);
  return question;
}

// ── Papers ───────────────────────────────────────────────────────────────────

export type NewPaper = {
  name: string;
  assessmentNumber: 1 | 2 | 3;
  totalMarks: number;
  passingMarks?: number;
  assessmentDate?: number;
};

/**
 * Create CA papers for one subject + term + level + year. A CA-N that is
 * still active blocks a second one; a deactivated CA-N does not, so a paper
 * can be recreated after it was deactivated.
 */
export async function createPapers(
  ctx: MutationCtx,
  key: ClassSubjectKey,
  papers: NewPaper[],
): Promise<Id<"assessments">[]> {
  const taken = new Set(
    (await activeAssessmentsFor(ctx, key)).map((a) => a.assessmentNumber),
  );
  const ids: Id<"assessments">[] = [];
  for (const paper of papers) {
    if (taken.has(paper.assessmentNumber)) {
      throw new ConvexError(
        `CA-${paper.assessmentNumber} already exists for this subject, term, level and year.`,
      );
    }
    taken.add(paper.assessmentNumber);
    ids.push(
      await ctx.db.insert("assessments", {
        ...paper,
        semester: key.semester,
        subjectId: key.subjectId,
        standardLevelId: key.standardLevelId,
        academicYearId: key.academicYear,
        isActive: true,
        createdAt: Date.now(),
      }),
    );
  }
  // A new paper raises every classmate's expected CA count. It has no marks
  // yet, so there is no paper to name: the existing grade rows are everyone.
  await scheduleClassRecompute(ctx, key);
  return ids;
}

/**
 * Edit a paper's display fields. None of them enters the grade (ADR-0004), so
 * nothing is recomputed. Returns the paper as it was.
 */
export async function updatePaper(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  updates: {
    name?: string;
    totalMarks?: number;
    passingMarks?: number;
    assessmentDate?: number;
  },
): Promise<Doc<"assessments">> {
  const assessment = await getPaper(ctx, assessmentId);
  const { totalMarks } = updates;
  if (totalMarks !== undefined && totalMarks < assessment.totalMarks) {
    assertAllocationFits(
      totalMarks,
      questionTotal(await paperQuestions(ctx, assessmentId)),
    );
  }
  await ctx.db.patch(assessmentId, defined(updates));
  return assessment;
}

/** Soft-delete a paper. Returns it, and how many grades were queued. */
export async function deactivatePaper(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<{ assessment: Doc<"assessments">; queued: number }> {
  const assessment = await getPaper(ctx, assessmentId);
  await ctx.db.patch(assessmentId, { isActive: false });
  return { assessment, queued: await recomputeClass(ctx, assessment) };
}

/** Hard-delete a paper with its questions and the marks entered on it. */
export async function deletePaper(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
): Promise<{
  assessment: Doc<"assessments">;
  deletedAnswers: number;
  deletedQuestions: number;
}> {
  const assessment = await getPaper(ctx, assessmentId);
  // Gathered before the cascade so students with marks on this paper are
  // found; the batch itself runs after the deletes commit.
  await recomputeClass(ctx, assessment);
  const [answers, questions] = await Promise.all([
    ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
      .take(MAX_ANSWERS),
    paperQuestions(ctx, assessmentId),
  ]);
  await Promise.all(
    [...answers, ...questions].map((doc) => ctx.db.delete(doc._id)),
  );
  await ctx.db.delete(assessmentId);
  return {
    assessment,
    deletedAnswers: answers.length,
    deletedQuestions: questions.length,
  };
}
