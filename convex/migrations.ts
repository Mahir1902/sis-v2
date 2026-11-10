import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";
import { applyBillingContactBackfill } from "../lib/applyBillingContactBackfill";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { recomputeGrade } from "./computedGrades";
import { isLeaver } from "./lib/placement";
import schema from "./schema";

// ─── Migrations component init ─────────────────────────────────────────────
//
// `@convex-dev/migrations` provides batched, resumable migrations with state
// tracking, dry runs, and resume-from-failure. Each `migrations.define(...)`
// call below registers a migration runnable via `npx convex run ...`. See
// `docs/adr/0001-invoice-delivery-launcher-architecture.md` for the
// motivation behind the issue-#33 migrations.

// Schema is passed so `customRange` can use indexed reads — required for the
// invoice status rename which scans only `status === "sent"` via `by_status`.
// `DataModel` is inferred from the schema generic; passing both `<DataModel>`
// explicitly and `schema` conflicts (the schema generic supersedes).
export const migrations = new Migrations(components.migrations, {
  schema,
});

/**
 * General-purpose runner. Use:
 *   npx convex run migrations:run '{"fn":"migrations:<name>"}'
 *   npx convex run migrations:run '{"fn":"migrations:<name>","dryRun":true}'
 */
export const run = migrations.runner();

// ─── Issue #33: widen → migrate → narrow ───────────────────────────────────

/**
 * Backfills `students.primaryBillingContact = "father"` for every student
 * that lacks the field. Idempotent — students already carrying the field are
 * left untouched.
 *
 * Default of `"father"` matches the issue #33 spec. The narrow phase that
 * follows this migration makes the field required.
 *
 * Run via:
 *   npx convex run migrations:runBackfillPrimaryBillingContact
 *   npx convex run migrations:runBackfillPrimaryBillingContact '{"dryRun":true}'
 */
export const backfillPrimaryBillingContact = migrations.define({
  table: "students",
  // `primaryBillingContact` is optional on the document since the import
  // widening (#93), so pass it explicitly rather than the whole doc — the
  // helper's parameter is a required-but-nullable property.
  migrateOne: (_ctx, student) =>
    applyBillingContactBackfill({
      primaryBillingContact: student.primaryBillingContact,
    }),
});

export const runBackfillPrimaryBillingContact = migrations.runner(
  internal.migrations.backfillPrimaryBillingContact,
);

// ─── ADR-0004 / A.4: recompute all grades under the renormalized model ──────

/**
 * Recomputes every existing `computedGrades` row under the ADR-0004
 * renormalized math (stored `weightedAverage`/`letterGrade` reflect the old,
 * deflated math). Also backfills the B.1 denormalised fields
 * (`standardLevelId`, `academicYear`) and `expectedCaCount` — which unblocks
 * narrowing those three from optional → required in a follow-up.
 *
 * Rows whose subject now has zero present CAs are DELETED: ungraded = no row.
 *
 * `batchSize` is deliberately small. Each row fans out to the enrollment, its
 * assessments, and (questions + the student's answers) per assessment, so a
 * large batch could approach Convex's per-transaction read ceiling. 25 keeps
 * the worst case well under it; raise only if the grades table is large and
 * papers are short.
 *
 * This only re-runs the math on rows that ALREADY exist — it does not compute
 * grades for subjects never computed before (those are created on demand by the
 * manual "Compute Grades" action). Safe to re-run; idempotent.
 *
 * Orphaned rows whose `enrollmentId` no longer resolves (a Computed Grade
 * cannot exist without its enrollment — CONTEXT.md) are deleted as a repair;
 * `recomputeGrade` itself keeps its strict "Enrollment not found" contract for
 * the UI path.
 *
 * Run via:
 *   npx convex run migrations:runRecomputeAllGrades
 *   npx convex run migrations:runRecomputeAllGrades '{"dryRun":true}'
 */
export const recomputeAllGrades = migrations.define({
  table: "computedGrades",
  batchSize: 25,
  migrateOne: async (ctx, grade) => {
    // Orphaned grade (enrollment deleted without cascading) — invalid, drop it.
    const enrollment = await ctx.db.get(grade.enrollmentId);
    if (!enrollment) {
      await ctx.db.delete(grade._id);
      return;
    }
    // recomputeGrade does its own replace/delete, so migrateOne returns void.
    await recomputeGrade(ctx, {
      studentId: grade.studentId,
      enrollmentId: grade.enrollmentId,
      subjectId: grade.subjectId,
      semester: grade.semester,
    });
  },
});

export const runRecomputeAllGrades = migrations.runner(
  internal.migrations.recomputeAllGrades,
);

// ─── ADR-0007: Class is per campus — widen → backfill → narrow ─────────────

/**
 * Copies the enrollment's `campus` onto every `computedGrades` row that lacks
 * it, so the per-campus analytics index (`by_class_subject_semester`) sees
 * every grade. A grade whose enrollment has no campus is left alone — it is in
 * no Class until the admin fixes the enrollment (`placementReport.noCampus`).
 * Idempotent.
 *
 * Run via:
 *   npx convex run migrations:runBackfillComputedGradeCampus '{"dryRun":true}'
 *   npx convex run migrations:runBackfillComputedGradeCampus
 */
export const backfillComputedGradeCampus = migrations.define({
  table: "computedGrades",
  migrateOne: async (ctx, grade) => {
    if (grade.campus !== undefined) return;
    const enrollment = await ctx.db.get(grade.enrollmentId);
    if (!enrollment?.campus) return;
    return { campus: enrollment.campus };
  },
});

export const runBackfillComputedGradeCampus = migrations.runner(
  internal.migrations.backfillComputedGradeCampus,
);

// ─── Placement module: widen → migrate → narrow (review candidates 1 + 2) ──
//
// Deploy 1 (this code) stopped reading/writing `students.standardLevel /
// academicYear / campus` and `enrollments.status`. Between deploys, on each
// deployment:
//
//   1. npx convex run migrations:placementReport          # read-only; keep it
//   2. npx convex run migrations:runPlacementMigrations '{"dryRun":true}'
//   3. npx convex run migrations:runPlacementMigrations
//   4. npx convex run migrations:placementReport          # unknown values == 0
//
// The series runs in order: close leavers → backfill → strip. The backfill
// needs the student-record copy, so it must run before the strip. Then the
// narrow PR (drop the fields + indexes, union-literal types) can deploy.
//
// These are one-off data repairs, so they write enrollments directly rather
// than through convex/lib/placement.ts.

const enrollmentsOfStudent = (
  ctx: Pick<QueryCtx, "db">,
  studentId: Id<"students">,
) =>
  ctx.db
    .query("enrollments")
    .withIndex("by_student_academic_year", (q) => q.eq("studentId", studentId))
    .take(100);

/** The enrollmentType / exitReason values the narrow PR's unions accept. */
const ENROLLMENT_TYPES = [
  "new_admission",
  "promotion",
  "repeat",
  "readmission",
];
const EXIT_REASONS = [
  "promotion",
  "hold_back",
  "graduated",
  "withdrawn",
  "transferred",
  "expelled",
  "suspended", // legacy — never written; kept for rows closed as suspended
];

/**
 * Read-only report for manual review. Run before the series (it needs the
 * student-record copy for `drift`) and after it (unknown values must be 0
 * before the narrow PR). Lists:
 *  - multipleOpen: students with more than one open enrollment;
 *  - closedAsSuspended: enrollments closed with reason "suspended" — NOT
 *    reopened automatically (suspension keeps the enrollment open);
 *  - leaversWithOpen: what `closeLeaverEnrollments` will close;
 *  - notPlaced: non-leavers with no open enrollment (`hasEnrollments: false`
 *    ones get one from `backfillMissingPlacements`);
 *  - drift: student-record class ≠ open enrollment. The enrollment wins once
 *    the copy is stripped — fix level/campus by hand via Edit Student, a
 *    year mismatch via promotion / hold-back (the year is not amendable);
 *  - unknownEnrollmentTypes / unknownExitReasons: values outside the unions
 *    ("regular" is mapped to "new_admission" by `stripEnrollmentStatus`);
 *  - noCampus: OPEN enrollments without a campus — in no Class (ADR-0007), so
 *    on no roster, register, promotion list or class statistic. Fix via Edit
 *    Student (campus). Must be empty after the per-campus deploy.
 *
 * ponytail: whole-table reads, fine at school size (~400 students); paginate
 * if the school grows past ~10k enrollments.
 */
export const placementReport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [students, enrollments] = await Promise.all([
      ctx.db.query("students").take(5000),
      ctx.db.query("enrollments").take(15000),
    ]);
    const byStudent = new Map<string, Doc<"enrollments">[]>();
    for (const e of enrollments) {
      byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), e]);
    }

    const report = {
      multipleOpen: [] as { studentNumber: string; enrollmentIds: string[] }[],
      closedAsSuspended: [] as {
        studentNumber: string;
        enrollmentId: string;
        status: string | null;
      }[],
      leaversWithOpen: [] as { studentNumber: string; status: string }[],
      notPlaced: [] as {
        studentNumber: string;
        status: string | null;
        hasEnrollments: boolean;
      }[],
      drift: [] as {
        studentNumber: string;
        studentRecord: Record<string, string | null>;
        enrollment: Record<string, string | null>;
      }[],
      unknownEnrollmentTypes: {} as Record<string, number>,
      unknownExitReasons: {} as Record<string, number>,
      noCampus: [] as {
        studentNumber: string;
        enrollmentId: Id<"enrollments">;
        academicYear: Id<"academicYears">;
      }[],
    };
    const studentNumberOf = new Map(
      students.map((s) => [s._id, s.studentNumber]),
    );

    for (const e of enrollments) {
      if (e.exitDate === undefined && e.campus === undefined) {
        report.noCampus.push({
          studentNumber: studentNumberOf.get(e.studentId) ?? "?",
          enrollmentId: e._id,
          academicYear: e.academicYear,
        });
      }
      if (!ENROLLMENT_TYPES.includes(e.enrollmentType)) {
        report.unknownEnrollmentTypes[e.enrollmentType] =
          (report.unknownEnrollmentTypes[e.enrollmentType] ?? 0) + 1;
      }
      if (e.exitReason !== undefined && !EXIT_REASONS.includes(e.exitReason)) {
        report.unknownExitReasons[e.exitReason] =
          (report.unknownExitReasons[e.exitReason] ?? 0) + 1;
      }
    }

    for (const s of students) {
      const mine = byStudent.get(s._id) ?? [];
      const open = mine.filter((e) => e.exitDate === undefined);
      for (const e of mine) {
        if (e.exitReason === "suspended") {
          report.closedAsSuspended.push({
            studentNumber: s.studentNumber,
            enrollmentId: e._id,
            status: s.status ?? null,
          });
        }
      }
      if (open.length > 1) {
        report.multipleOpen.push({
          studentNumber: s.studentNumber,
          enrollmentIds: open.map((e) => e._id),
        });
      }
      if (isLeaver(s.status)) {
        if (open.length > 0) {
          report.leaversWithOpen.push({
            studentNumber: s.studentNumber,
            status: s.status ?? "",
          });
        }
        continue;
      }
      const current = open.sort(
        (a, b) => b.enrollmentDate - a.enrollmentDate,
      )[0];
      if (!current) {
        report.notPlaced.push({
          studentNumber: s.studentNumber,
          status: s.status ?? null,
          hasEnrollments: mine.length > 0,
        });
        continue;
      }
      const studentRecord = {
        standardLevel: s.standardLevel ?? null,
        academicYear: s.academicYear ?? null,
        campus: s.campus ?? null,
      };
      const enrollment = {
        standardLevel: current.standardLevelId,
        academicYear: current.academicYear,
        campus: current.campus ?? null,
      };
      const hasCopy = studentRecord.standardLevel || studentRecord.academicYear;
      if (
        hasCopy &&
        (studentRecord.standardLevel !== enrollment.standardLevel ||
          studentRecord.academicYear !== enrollment.academicYear ||
          (studentRecord.campus !== null &&
            studentRecord.campus !== enrollment.campus))
      ) {
        report.drift.push({
          studentNumber: s.studentNumber,
          studentRecord,
          enrollment,
        });
      }
    }
    return report;
  },
});

/**
 * Leavers must have no open enrollment: close each one (run time as exit
 * date — the student carries no leave date; `exitNotes` marks the row).
 * Idempotent.
 */
export const closeLeaverEnrollments = migrations.define({
  table: "students",
  migrateOne: async (ctx, student) => {
    const status = student.status;
    if (!isLeaver(status)) return;
    const open = (await enrollmentsOfStudent(ctx, student._id)).filter(
      (e) => e.exitDate === undefined,
    );
    await Promise.all(
      open.map((e) =>
        ctx.db.patch(e._id, {
          exitDate: Date.now(),
          exitReason: status,
          exitNotes: "Closed by placement migration",
        }),
      ),
    );
  },
});

/**
 * A non-leaver with NO enrollment at all gets one from the student-record
 * copy (replaces the deleted `backfillEnrollments.ts`). A student whose
 * enrollments are all closed (e.g. closed as "suspended") is left alone and
 * reported. An open enrollment with no campus takes the student-record
 * campus, before the strip deletes that only copy. Idempotent.
 */
export const backfillMissingPlacements = migrations.define({
  table: "students",
  migrateOne: async (ctx, student) => {
    if (isLeaver(student.status)) return;
    if (!student.standardLevel || !student.academicYear) return;
    const mine = await enrollmentsOfStudent(ctx, student._id);
    if (mine.length > 0) {
      const campus = student.campus;
      const noCampus = mine.filter(
        (e) => e.exitDate === undefined && e.campus === undefined,
      );
      if (campus) {
        await Promise.all(noCampus.map((e) => ctx.db.patch(e._id, { campus })));
      }
      return;
    }
    await ctx.db.insert("enrollments", {
      studentId: student._id,
      academicYear: student.academicYear,
      standardLevelId: student.standardLevel,
      campus: student.campus,
      enrollmentType: "new_admission",
      enrollmentDate: student._creationTime,
    });
  },
});

/** Unsets the deprecated student-record copy of the class. Idempotent. */
export const stripStudentPlacement = migrations.define({
  table: "students",
  migrateOne: (_ctx, student) => {
    if (
      student.standardLevel === undefined &&
      student.academicYear === undefined &&
      student.campus === undefined
    ) {
      return;
    }
    return {
      standardLevel: undefined,
      academicYear: undefined,
      campus: undefined,
    };
  },
});

/**
 * Unsets `enrollments.status` (open/closed is `exitDate` only) and maps the
 * legacy enrollmentType "regular" to "new_admission". Idempotent.
 */
export const stripEnrollmentStatus = migrations.define({
  table: "enrollments",
  migrateOne: (_ctx, e) => {
    const regular = e.enrollmentType === "regular";
    if (e.status === undefined && !regular) return;
    return {
      status: undefined,
      ...(regular ? { enrollmentType: "new_admission" } : {}),
    };
  },
});

export const runPlacementMigrations = migrations.runner([
  internal.migrations.closeLeaverEnrollments,
  internal.migrations.backfillMissingPlacements,
  internal.migrations.stripStudentPlacement,
  internal.migrations.stripEnrollmentStatus,
]);

// ─── Removed migrations (issue #33 invoice-status rename; issue #36
//     invoiceNumber strip + studentFees partial-status narrow) ─────────────
//
// All ran cleanly on dev (hushed-bass-123) and were removed because the
// narrowed schema makes their literal patches untypeable. To re-run against a
// prod deployment still on the old shape, recover the bodies from git
// (`git log -p convex/migrations.ts`) and follow the widen-migrate-narrow
// sequence in docs/adr/0001-invoice-delivery-launcher-architecture.md.

// ─── Legacy one-shot migrations (kept for history / re-runnability) ────────

/**
 * Backfill migration: populates `standardLevelId` on existing
 * `feeCollectionSessions` that were created before the field was added.
 *
 * For each session missing `standardLevelId`, looks up the student's
 * enrollment for that session's academic year using the
 * `by_student_academic_year` index on `enrollments`; sessions with none are
 * left unset (the student-record fallback went with that copy of the class).
 *
 * Processes in batches (default 100). Run from the Convex dashboard:
 *   Functions → migrations:backfillSessionStandardLevels → Run
 *
 * Safe to re-run — sessions that already have `standardLevelId` are skipped.
 */
export const backfillSessionStandardLevels = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const sessions = await ctx.db
      .query("feeCollectionSessions")
      .order("asc")
      .take(batchSize + 1);

    // Filter to only those missing standardLevelId
    const toFix = sessions.filter((s) => s.standardLevelId === undefined);

    let patched = 0;

    for (const session of toFix) {
      const enrollment = await ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q
            .eq("studentId", session.studentId)
            .eq("academicYear", session.academicYear),
        )
        .first();

      if (enrollment) {
        await ctx.db.patch(session._id, {
          standardLevelId: enrollment.standardLevelId,
        });
        patched++;
      }
    }

    return { patched, totalInBatch: sessions.length };
  },
});

/**
 * One-shot migration: renames the seeded campuses to Campus 01/02/03 and
 * patches their addresses to the real Dhaka addresses provided by the school.
 *
 * Maps by current name so this handles both the original seed defaults
 * (Main/East/West) and any partially-renamed live rows (Campus 1/2/3).
 * Anything that does not match is left alone and reported back so the operator
 * can decide whether to patch by id.
 *
 * Run once via:
 *   npx convex run migrations:renameCampusesToNumberedDhaka
 *
 * Idempotent — re-running after a successful pass is a no-op.
 */
export const renameCampusesToNumberedDhaka = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CAMPUS_01 = {
      name: "Campus 01",
      address: "Sector 11, Road 05/A, House 30/A, Uttara, Dhaka-1230",
    };
    const CAMPUS_02 = {
      name: "Campus 02",
      address: "House 32, Road 28, Sector 7, Dhaka-1230",
    };
    const CAMPUS_03 = {
      name: "Campus 03",
      address: "Sector 7, Road 32, House 1, Uttara",
    };

    const TARGETS: Record<string, { name: string; address: string }> = {
      "Main Campus": CAMPUS_01,
      "Campus 1": CAMPUS_01,
      "Campus 01": CAMPUS_01,
      "East Campus": CAMPUS_02,
      "Campus 2": CAMPUS_02,
      "Campus 02": CAMPUS_02,
      "West Campus": CAMPUS_03,
      "Campus 3": CAMPUS_03,
      "Campus 03": CAMPUS_03,
    };

    const campuses = await ctx.db.query("campuses").take(100);
    const patched: { id: string; from: string; to: string }[] = [];
    const skipped: { id: string; name: string; reason: string }[] = [];

    for (const campus of campuses) {
      const target = TARGETS[campus.name];
      if (!target) {
        skipped.push({
          id: campus._id,
          name: campus.name,
          reason: "no-mapping",
        });
        continue;
      }
      if (campus.name === target.name && campus.address === target.address) {
        skipped.push({
          id: campus._id,
          name: campus.name,
          reason: "already-correct",
        });
        continue;
      }
      await ctx.db.patch(campus._id, {
        name: target.name,
        address: target.address,
      });
      patched.push({ id: campus._id, from: campus.name, to: target.name });
    }

    return { patched, skipped, total: campuses.length };
  },
});
