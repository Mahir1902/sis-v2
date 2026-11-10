import { v } from "convex/values";
import {
  gradeSpread,
  mean,
  rankStandardCompetition,
} from "../lib/gradeAnalytics";
import {
  type CaInput,
  computeRenormalizedGrade,
} from "../lib/gradeComputation";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireRole } from "./lib/permissions";

/**
 * Below this many graded peers a "class average" or "position" identifies a
 * specific classmate rather than a cohort, so it is suppressed (ADR-0005 / DA #5).
 */
const MIN_CLASS_PEERS = 5;

/** The Class (level + year) + subject + term that one set of CAs is defined for. */
export type ClassSubjectKey = {
  standardLevelId: Id<"standardLevels">;
  academicYear: Id<"academicYears">;
  subjectId: Id<"subjects">;
  semester: 1 | 2;
};

export function classKeyOf(a: Doc<"assessments">): ClassSubjectKey {
  return {
    standardLevelId: a.standardLevelId,
    academicYear: a.academicYearId,
    subjectId: a.subjectId,
    semester: a.semester,
  };
}

/**
 * The active CAs one subject runs for one Class + term (≤ 3). The single
 * lookup behind every recompute and the final/provisional gate.
 */
export function activeAssessmentsFor(
  ctx: QueryCtx | MutationCtx,
  key: ClassSubjectKey,
): Promise<Doc<"assessments">[]> {
  return ctx.db
    .query("assessments")
    .withIndex("by_subject_semester_level_year", (q) =>
      q
        .eq("subjectId", key.subjectId)
        .eq("semester", key.semester)
        .eq("standardLevelId", key.standardLevelId)
        .eq("academicYearId", key.academicYear),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .take(10);
}

/**
 * Recompute one student's grade for a (subject, semester) under the ADR-0004
 * renormalized model, and write the result.
 *
 * Present CA = the student has ≥1 answer row for the assessment AND the
 * assessment has a positive question-mark total. The grade is the renormalized
 * (equal-weight ⇒ mean) average of the present CAs' percentages; the pure math
 * lives in `lib/gradeComputation.ts`. When NO CA is present the subject is
 * ungraded: no row is written, and any stale row is deleted so an old "0 / F"
 * from the previous math cannot linger.
 *
 * Triggered by every write that can change the result: mark entry (inline, see
 * `studentAssessmentAnswers.ts`), question and assessment changes (class-wide,
 * via `scheduleClassRecompute`), and the repair migration. There is no manual
 * trigger any more. Takes a bare `MutationCtx` and does no permission check —
 * the calling mutation is responsible for `requireRole`.
 */
export async function recomputeGrade(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    enrollmentId: Id<"enrollments">;
    subjectId: Id<"subjects">;
    semester: 1 | 2;
  },
): Promise<Id<"computedGrades"> | null> {
  const enrollment = await ctx.db.get(args.enrollmentId);
  if (!enrollment) throw new Error("Enrollment not found");

  const assessments = await activeAssessmentsFor(ctx, {
    standardLevelId: enrollment.standardLevelId,
    academicYear: enrollment.academicYear,
    subjectId: args.subjectId,
    semester: args.semester,
  });
  // Any existing row for this (enrollment, subject, semester). We replace it
  // (never patch — Convex drops `undefined` keys, so patching would leave a
  // stale caN percentage when a CA goes present → unmarked), or delete it when
  // the subject is now ungraded.
  const existing = await ctx.db
    .query("computedGrades")
    .withIndex("by_enrollment_semester_subject", (q) =>
      q
        .eq("enrollmentId", args.enrollmentId)
        .eq("semester", args.semester)
        .eq("subjectId", args.subjectId),
    )
    .first();

  // One CaInput per assessment: denominator = Σ question `marksAllocated`,
  // presence + marks from the student's answer rows. Batched to avoid N+1.
  const cas: CaInput[] = await Promise.all(
    assessments.map(async (assessment) => {
      const [questions, answers] = await Promise.all([
        ctx.db
          .query("assessmentQuestions")
          .withIndex("by_assessment", (q) =>
            q.eq("assessmentId", assessment._id),
          )
          .collect(),
        ctx.db
          .query("studentAssessmentAnswers")
          .withIndex("by_student_assessment", (q) =>
            q
              .eq("studentId", args.studentId)
              .eq("assessmentId", assessment._id),
          )
          .collect(),
      ]);
      return {
        assessmentNumber: assessment.assessmentNumber,
        hasAnswers: answers.length > 0,
        marksObtained: answers.reduce((sum, a) => sum + a.marksObtained, 0),
        marksAllocated: questions.reduce((sum, q) => sum + q.marksAllocated, 0),
      };
    }),
  );

  const result = computeRenormalizedGrade(cas);

  // Zero present CAs → ungraded. Delete a stale row, write nothing new.
  if (!result) {
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }

  const gradeData = {
    studentId: args.studentId,
    enrollmentId: args.enrollmentId,
    // Denormalised from the enrollment so class-level analytics can index by
    // level + year + subject + semester (see schema). `placement.amend` keeps
    // `standardLevelId` in step when the enrollment's level changes.
    standardLevelId: enrollment.standardLevelId,
    academicYear: enrollment.academicYear,
    subjectId: args.subjectId,
    semester: args.semester,
    ca1Marks: result.ca1?.marks,
    ca1Percentage: result.ca1?.percentage,
    ca1TotalMarks: result.ca1?.totalMarks,
    ca2Marks: result.ca2?.marks,
    ca2Percentage: result.ca2?.percentage,
    ca2TotalMarks: result.ca2?.totalMarks,
    ca3Marks: result.ca3?.marks,
    ca3Percentage: result.ca3?.percentage,
    ca3TotalMarks: result.ca3?.totalMarks,
    weightedAverage: result.weightedAverage,
    letterGrade: result.letterGrade,
    totalMarksObtained: result.totalMarksObtained,
    totalPossibleMarks: result.totalPossibleMarks,
    // Provisional-grade signal (A.2): how many CAs the subject runs this term.
    // present count (derived from which caX percentage fields are set) <
    // expectedCaCount ⇒ provisional. Kept fresh: every CA add/remove schedules
    // a class-wide recompute, which rewrites this on every row.
    expectedCaCount: assessments.length,
    computedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.replace(existing._id, gradeData);
    return existing._id;
  }
  return await ctx.db.insert("computedGrades", gradeData);
}

/**
 * Guard for the mark-entry mutations: the enrollment must belong to the
 * student and sit in the Class the assessment is defined for, or the recompute
 * would write (or delete) a grade row in the wrong class. Returns the
 * `recomputeGrade` args for this student on this assessment's subject/term.
 */
export async function assertEnrollmentForAssessment(
  ctx: MutationCtx,
  assessment: Doc<"assessments">,
  studentId: Id<"students">,
  enrollmentId: Id<"enrollments">,
): Promise<GradeTarget & { subjectId: Id<"subjects">; semester: 1 | 2 }> {
  const enrollment = await ctx.db.get(enrollmentId);
  if (
    !enrollment ||
    enrollment.studentId !== studentId ||
    enrollment.standardLevelId !== assessment.standardLevelId ||
    enrollment.academicYear !== assessment.academicYearId
  ) {
    throw new Error("Enrollment does not match this assessment");
  }
  return {
    studentId,
    enrollmentId,
    subjectId: assessment.subjectId,
    semester: assessment.semester,
  };
}

// ─── Class-wide recompute (scheduled, chunked) ─────────────────────────────────
//
// A change to the CA set or a paper's denominator (question added / removed /
// re-marked, assessment created / deactivated / deleted) moves EVERY student's
// grade for that subject + term. A whole class × 20-question papers can
// approach Convex's per-transaction read ceiling, so the triggering mutation
// only gathers the targets and schedules `recomputeGradesBatch`, which handles
// RECOMPUTE_BATCH students per transaction and reschedules itself for the rest.
// Grades are therefore fresh within milliseconds of the change, not in the same
// transaction. Each target is isolated: a poison row (orphaned enrollment) is
// skipped and logged, never stalls the chain. The repair path for anything the
// chain missed is `migrations:runRecomputeAllGrades`.

export type GradeTarget = {
  studentId: Id<"students">;
  enrollmentId: Id<"enrollments">;
};

const RECOMPUTE_BATCH = 25;

/**
 * Students whose grade for this Class + subject + term may have changed:
 * everyone who already has a row, plus (when a paper changed) everyone with an
 * answer on it — a CA whose denominator went 0 → positive becomes present for
 * students who have no row yet.
 */
export async function gatherClassTargets(
  ctx: MutationCtx,
  key: ClassSubjectKey,
  changedAssessmentId?: Id<"assessments">,
): Promise<GradeTarget[]> {
  const rows = await ctx.db
    .query("computedGrades")
    .withIndex("by_level_year_subject_semester", (q) =>
      q
        .eq("standardLevelId", key.standardLevelId)
        .eq("academicYear", key.academicYear)
        .eq("subjectId", key.subjectId)
        .eq("semester", key.semester),
    )
    .collect();
  const targets = new Map<Id<"enrollments">, GradeTarget>();
  for (const r of rows) {
    targets.set(r.enrollmentId, {
      studentId: r.studentId,
      enrollmentId: r.enrollmentId,
    });
  }
  if (changedAssessmentId) {
    const answers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", changedAssessmentId),
      )
      .take(5000);
    for (const a of answers) {
      targets.set(a.enrollmentId, {
        studentId: a.studentId,
        enrollmentId: a.enrollmentId,
      });
    }
  }
  return [...targets.values()];
}

/** Schedule the chunked recompute for a list of students on one subject + term. */
export function scheduleRecompute(
  ctx: MutationCtx,
  key: Pick<ClassSubjectKey, "subjectId" | "semester">,
  targets: GradeTarget[],
) {
  if (targets.length === 0) return Promise.resolve();
  return ctx.scheduler.runAfter(
    0,
    internal.computedGrades.recomputeGradesBatch,
    { subjectId: key.subjectId, semester: key.semester, targets },
  );
}

/**
 * Gather + schedule for a whole Class after a CA-set or denominator change.
 * Returns how many students were queued (for audit descriptions).
 */
export async function scheduleClassRecompute(
  ctx: MutationCtx,
  key: ClassSubjectKey,
  changedAssessmentId?: Id<"assessments">,
): Promise<number> {
  const targets = await gatherClassTargets(ctx, key, changedAssessmentId);
  await scheduleRecompute(ctx, key, targets);
  return targets.length;
}

/** One chunk of a class-wide recompute; reschedules itself for the remainder. */
export const recomputeGradesBatch = internalMutation({
  args: {
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
    targets: v.array(
      v.object({
        studentId: v.id("students"),
        enrollmentId: v.id("enrollments"),
      }),
    ),
  },
  handler: async (ctx, { subjectId, semester, targets }) => {
    const chunk = targets.slice(0, RECOMPUTE_BATCH);
    const rest = targets.slice(RECOMPUTE_BATCH);
    await Promise.all(
      chunk.map((t) =>
        recomputeGrade(ctx, { ...t, subjectId, semester }).catch((err) => {
          console.warn(
            `recomputeGradesBatch: skipped enrollment ${t.enrollmentId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }),
      ),
    );
    if (rest.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.computedGrades.recomputeGradesBatch,
        { subjectId, semester, targets: rest },
      );
    }
  },
});

/** Get all computed grades for a student, grouped by enrollment+semester. */
export const getComputedGradesByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    return await Promise.all(
      grades.map(async (g) => ({
        ...g,
        subjectDoc: await ctx.db.get(g.subjectId),
      })),
    );
  },
});

/** Get computed grades for one enrollment+semester. */
export const getGradesByEnrollmentSemester = query({
  args: {
    enrollmentId: v.id("enrollments"),
    semester: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_enrollment_semester", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("semester", args.semester),
      )
      .collect();

    return await Promise.all(
      grades.map(async (g) => ({
        ...g,
        subjectDoc: await ctx.db.get(g.subjectId),
      })),
    );
  },
});

// ─── Phase B — Class analytics (ADR-0005) ──────────────────────────────────────
//
// All of these are difficulty-adjusted: a student is compared only to classmates
// who sat the same papers (same level + year + subject + semester). Each does ONE
// indexed range read on `by_level_year_subject_semester`, then filters to ACTIVE
// enrollments before any math — a withdrawn student's leftover grade must not pad
// the ≥5 floor or skew an average (DA B-1). All the ranking/averaging is pure and
// unit-tested in `lib/gradeAnalytics.ts`.
//
// ⚠️ These read `computedGrades` rows via the denormalised `standardLevelId` +
// `academicYear`. Rows written before the ADR-0004 A.4 backfill lack those fields
// and are invisible to the index; results are only complete once the backfill has
// run (it has, on dev — the table was emptied of orphans and repopulated).

/** How many of a row's three CAs are present (their percentage field is set). */
function presentCaCount(row: Doc<"computedGrades">): number {
  return (
    (row.ca1Percentage !== undefined ? 1 : 0) +
    (row.ca2Percentage !== undefined ? 1 : 0) +
    (row.ca3Percentage !== undefined ? 1 : 0)
  );
}

/**
 * Keep only rows whose enrollment is currently active (`exitDate === undefined`,
 * per the schema-improvement rule — not `status`). Batches the enrollment reads
 * over unique ids so this is O(unique enrollments), not N+1.
 */
async function activeRows<T extends { enrollmentId: Id<"enrollments"> }>(
  ctx: QueryCtx,
  rows: T[],
): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r.enrollmentId))];
  const enrollments = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const active = new Set(
    ids.filter((_, i) => {
      const e = enrollments[i];
      return e != null && e.exitDate === undefined;
    }),
  );
  return rows.filter((r) => active.has(r.enrollmentId));
}

/**
 * Every ACTIVE student's computed grade for one Class + subject + semester —
 * the raw material for Class Average and the per-CA baseline. One indexed read.
 */
async function classSubjectRows(
  ctx: QueryCtx,
  args: {
    standardLevelId: Id<"standardLevels">;
    academicYear: Id<"academicYears">;
    subjectId: Id<"subjects">;
    semester: 1 | 2;
  },
): Promise<Doc<"computedGrades">[]> {
  const rows = await ctx.db
    .query("computedGrades")
    .withIndex("by_level_year_subject_semester", (q) =>
      q
        .eq("standardLevelId", args.standardLevelId)
        .eq("academicYear", args.academicYear)
        .eq("subjectId", args.subjectId)
        .eq("semester", args.semester),
    )
    .collect();
  return activeRows(ctx, rows);
}

/**
 * Every ACTIVE student's grade for one Class across ALL subjects in a semester.
 * The index is [level, year, subject, semester] — subject sits before semester,
 * so we range on the [level, year] prefix and post-filter the semester in memory.
 * Bounded to one class's grades (dozens–low-hundreds of rows).
 */
async function classTermRows(
  ctx: QueryCtx,
  args: {
    standardLevelId: Id<"standardLevels">;
    academicYear: Id<"academicYears">;
    semester: 1 | 2;
  },
): Promise<Doc<"computedGrades">[]> {
  const rows = await ctx.db
    .query("computedGrades")
    .withIndex("by_level_year_subject_semester", (q) =>
      q
        .eq("standardLevelId", args.standardLevelId)
        .eq("academicYear", args.academicYear),
    )
    .filter((q) => q.eq(q.field("semester"), args.semester))
    .collect();
  return activeRows(ctx, rows);
}

/**
 * B.2 — Class Average for one subject + semester, and (if `studentId` given) that
 * student's value and signed delta from it. Suppressed below the ≥5-peer floor:
 * `sufficient: false` and `classAverage: null`, never a misleading small-sample
 * average. The delta is the difficulty-adjusted "above/below your class" signal.
 */
export const getClassAverages = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
    studentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const rows = await classSubjectRows(ctx, args);

    const gradedCount = rows.length;
    const sufficient = gradedCount >= MIN_CLASS_PEERS;
    const classAverage = sufficient
      ? mean(rows.map((r) => r.weightedAverage))
      : null;

    let student: { weightedAverage: number; delta: number | null } | null =
      null;
    if (args.studentId) {
      const own = rows.find((r) => r.studentId === args.studentId);
      if (own) {
        student = {
          weightedAverage: own.weightedAverage,
          delta:
            classAverage === null ? null : own.weightedAverage - classAverage,
        };
      }
    }

    return { classAverage, gradedCount, sufficient, student };
  },
});

/**
 * B.4 — Per-CA class baseline (mean of present students' CA-N percentages) for the
 * within-term you-vs-class line. The ≥5 floor is applied to each CA INDEPENDENTLY
 * (DA B-6): CA-1 may have 8 present students while CA-3 has only 2, so each CA is
 * `{ mean, n } | null` and a thin CA is suppressed on its own.
 */
export const getPerCaClassBaseline = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const rows = await classSubjectRows(ctx, args);

    const baseline = (
      pick: (r: Doc<"computedGrades">) => number | undefined,
    ): { mean: number; n: number } | null => {
      const pcts = rows.map(pick).filter((p): p is number => p !== undefined);
      const m = pcts.length >= MIN_CLASS_PEERS ? mean(pcts) : null;
      return m === null ? null : { mean: m, n: pcts.length };
    };

    return {
      ca1: baseline((r) => r.ca1Percentage),
      ca2: baseline((r) => r.ca2Percentage),
      ca3: baseline((r) => r.ca3Percentage),
    };
  },
});

/**
 * B.3 — One student's Class Positions for a term: a rank per subject plus the
 * overall (across-subjects) rank. All final-gated and tie-shared:
 *  - A grade is FINAL iff its present-CA count == its `expectedCaCount` (kept
 *    fresh by the class-wide recompute). Provisional grades are never ranked.
 *  - A per-subject position shows only with ≥5 final peers; ties share a rank.
 *  - The OVERALL rank ranks students by their across-subjects term average and is
 *    suppressed unless this student's whole graded term is final AND ≥5 peers are
 *    likewise term-complete — so it does not thrash mid-term.
 *    ponytail: "term-complete" = every subject the student has a grade in is final;
 *    it does not additionally require the student to have a grade in every subject
 *    the class offers (full-coverage check deferred to the Phase C decision).
 */
export const getClassPositions = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    semester: v.union(v.literal(1), v.literal(2)),
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const rows = await classTermRows(ctx, args);

    // "Expected CA" count = the stored `expectedCaCount`, which every CA
    // add/remove now refreshes class-wide. Rows written before the
    // `runRecomputeAllGrades` migration may lack the field; for those subjects
    // fall back to a live count (batched over the unique subjects). ponytail:
    // drop the fallback once the migration has run on every deployment.
    const legacySubjects = [
      ...new Set(
        rows
          .filter((r) => r.expectedCaCount === undefined)
          .map((r) => r.subjectId),
      ),
    ];
    const liveCounts = await Promise.all(
      legacySubjects.map(
        async (subjectId) =>
          (await activeAssessmentsFor(ctx, { ...args, subjectId })).length,
      ),
    );
    const liveBySubject = new Map(
      legacySubjects.map((id, i) => [id, liveCounts[i]] as const),
    );
    const expectedOf = (row: Doc<"computedGrades">): number =>
      row.expectedCaCount ?? liveBySubject.get(row.subjectId) ?? 0;
    const subjectIds = [...new Set(rows.map((r) => r.subjectId))];
    const isFinal = (row: Doc<"computedGrades">): boolean => {
      const expected = expectedOf(row);
      return expected > 0 && presentCaCount(row) === expected;
    };

    // Per-subject positions: rank the FINAL rows of each subject (≥5 peers only).
    const rankBySubject = new Map<
      Id<"subjects">,
      Map<Id<"students">, number>
    >();
    const finalCountBySubject = new Map<Id<"subjects">, number>();
    for (const subjectId of subjectIds) {
      const finals = rows.filter(
        (r) => r.subjectId === subjectId && isFinal(r),
      );
      finalCountBySubject.set(subjectId, finals.length);
      if (finals.length >= MIN_CLASS_PEERS) {
        const ranked = rankStandardCompetition(
          finals,
          (r) => r.weightedAverage,
        );
        rankBySubject.set(
          subjectId,
          new Map(ranked.map((x) => [x.item.studentId, x.rank])),
        );
      }
    }

    // Overall rank: each student's term average over their FINAL subjects, but
    // only for students whose every graded subject is final (term-complete).
    const byStudent = new Map<Id<"students">, Doc<"computedGrades">[]>();
    for (const r of rows) {
      const list = byStudent.get(r.studentId) ?? [];
      list.push(r);
      byStudent.set(r.studentId, list);
    }
    const termComplete: Array<{ studentId: Id<"students">; avg: number }> = [];
    for (const [studentId, grades] of byStudent) {
      if (grades.length === 0 || !grades.every(isFinal)) continue;
      const avg = mean(grades.map((g) => g.weightedAverage));
      if (avg !== null) termComplete.push({ studentId, avg });
    }
    let overall: { rank: number; outOf: number } | null = null;
    let overallSuppressedReason:
      | "not_graded"
      | "provisional"
      | "insufficient_peers"
      | null = null;
    const target = byStudent.get(args.studentId);
    if (!target || target.length === 0) {
      overallSuppressedReason = "not_graded";
    } else if (!target.every(isFinal)) {
      overallSuppressedReason = "provisional";
    } else if (termComplete.length < MIN_CLASS_PEERS) {
      overallSuppressedReason = "insufficient_peers";
    } else {
      const ranked = rankStandardCompetition(termComplete, (t) => t.avg);
      const mine = ranked.find((x) => x.item.studentId === args.studentId);
      if (mine) overall = { rank: mine.rank, outOf: termComplete.length };
    }

    // Assemble the target student's per-subject view (name-resolved).
    const myRows = target ?? [];
    const subjectDocs = await Promise.all(
      myRows.map((r) => ctx.db.get(r.subjectId)),
    );
    const bySubject = myRows.map((row, i) => {
      const provisional = !isFinal(row);
      const subjectRanks = rankBySubject.get(row.subjectId);
      const rank = subjectRanks?.get(row.studentId);
      return {
        subjectId: row.subjectId,
        subjectName: subjectDocs[i]?.name ?? "Unknown subject",
        weightedAverage: row.weightedAverage,
        provisional,
        position:
          !provisional && rank !== undefined
            ? {
                rank,
                outOf: finalCountBySubject.get(row.subjectId) ?? 0,
              }
            : null,
      };
    });

    return { bySubject, overall, overallSuppressedReason };
  },
});

/**
 * B.5a — A–F grade distribution across a Class (level + year), optionally narrowed
 * to one semester and/or subject. A cohort snapshot for the admin/teacher class
 * view; includes provisional grades (it shows where the cohort stands right now).
 * No ≥5 floor: an aggregate count of six buckets does not single out a peer.
 */
export const getGradeSpread = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    semester: v.optional(v.union(v.literal(1), v.literal(2))),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const raw = await ctx.db
      .query("computedGrades")
      .withIndex("by_level_year_subject_semester", (q) =>
        q
          .eq("standardLevelId", args.standardLevelId)
          .eq("academicYear", args.academicYear),
      )
      .collect();
    const rows = (await activeRows(ctx, raw)).filter(
      (r) =>
        (args.semester === undefined || r.semester === args.semester) &&
        (args.subjectId === undefined || r.subjectId === args.subjectId),
    );

    return {
      spread: gradeSpread(rows.map((r) => r.letterGrade)),
      total: rows.length,
    };
  },
});

/**
 * B.5b — Students below the 50% pass line in a Class + semester ("who needs help").
 * A per-row list (student + subject + grade), so no ≥5 floor applies — it is not an
 * average. Ordered lowest grade first so the most at-risk surface at the top.
 */
export const getStudentsNeedingHelp = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    semester: v.union(v.literal(1), v.literal(2)),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const rows = (await classTermRows(ctx, args)).filter(
      (r) =>
        r.weightedAverage < 50 &&
        (args.subjectId === undefined || r.subjectId === args.subjectId),
    );

    const studentIds = [...new Set(rows.map((r) => r.studentId))];
    const subjectIds = [...new Set(rows.map((r) => r.subjectId))];
    const [students, subjects] = await Promise.all([
      Promise.all(studentIds.map((id) => ctx.db.get(id))),
      Promise.all(subjectIds.map((id) => ctx.db.get(id))),
    ]);
    const studentMap = new Map(students.map((s, i) => [studentIds[i], s]));
    const subjectMap = new Map(subjects.map((s, i) => [subjectIds[i], s]));

    return rows
      .map((r) => ({
        studentId: r.studentId,
        studentName:
          studentMap.get(r.studentId)?.studentFullName ?? "Unknown student",
        subjectId: r.subjectId,
        subjectName: subjectMap.get(r.subjectId)?.name ?? "Unknown subject",
        weightedAverage: r.weightedAverage,
        letterGrade: r.letterGrade,
      }))
      .sort((a, b) => a.weightedAverage - b.weightedAverage);
  },
});
