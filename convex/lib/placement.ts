import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The Placement module (CONTEXT.md "Enrollment", "Current Placement").
 *
 * Every enrollment write goes through here: admit, amend, change status
 * (leave / suspend / reactivate), re-admit, promote / hold back, and the
 * import upsert. It also owns the one read, `getCurrentPlacement`.
 *
 * Invariants:
 *  - an enrollment is open iff `exitDate === undefined` (no other flag);
 *  - a student has at most one open enrollment;
 *  - a leaver (graduated / withdrawn / transferred / expelled) has none;
 *  - a suspended student keeps theirs.
 */

export type EnrollmentType = Doc<"enrollments">["enrollmentType"];

/** What can be written; "suspended" is a legacy stored value only. */
export type ExitReason = Exclude<
  NonNullable<Doc<"enrollments">["exitReason"]>,
  "suspended"
>;

export type StudentStatus = NonNullable<Doc<"students">["status"]>;

export const LEAVER_STATUSES = [
  "graduated",
  "withdrawn",
  "transferred",
  "expelled",
] as const satisfies readonly (StudentStatus & ExitReason)[];
export type LeaverStatus = (typeof LEAVER_STATUSES)[number];

export function isLeaver(
  status: StudentStatus | undefined,
): status is LeaverStatus {
  return (LEAVER_STATUSES as readonly string[]).includes(status ?? "");
}

export type PlacementInput = {
  standardLevelId: Id<"standardLevels">;
  academicYear: Id<"academicYears">;
  campus: Id<"campuses">;
};

type Ctx = QueryCtx | MutationCtx;

/** A student's enrollments, any year. Bounded: one per year at most in practice. */
function enrollmentsOf(ctx: Ctx, studentId: Id<"students">) {
  return ctx.db
    .query("enrollments")
    .withIndex("by_student_academic_year", (q) => q.eq("studentId", studentId))
    .take(100);
}

/**
 * The student's open enrollment, or null. Never falls back to the last
 * (closed) placement — a leaver is in no class. If legacy data holds two open
 * enrollments, the most recent wins (the placement report lists them).
 */
export async function getCurrentPlacement(
  ctx: Ctx,
  studentId: Id<"students">,
): Promise<Doc<"enrollments"> | null> {
  const open = (await enrollmentsOf(ctx, studentId)).filter(
    (e) => e.exitDate === undefined,
  );
  return open.sort((a, b) => b.enrollmentDate - a.enrollmentDate)[0] ?? null;
}

/** Close every open enrollment of a student (normally zero or one). */
async function closeOpen(
  ctx: MutationCtx,
  studentId: Id<"students">,
  exitReason: ExitReason,
  now: number,
) {
  const open = (await enrollmentsOf(ctx, studentId)).filter(
    (e) => e.exitDate === undefined,
  );
  await Promise.all(
    open.map((e) => ctx.db.patch(e._id, { exitDate: now, exitReason })),
  );
}

/** Insert an open enrollment. Callers have already checked none is open. */
function insertOpen(
  ctx: MutationCtx,
  studentId: Id<"students">,
  placement: Omit<PlacementInput, "campus"> & { campus?: Id<"campuses"> },
  enrollmentType: EnrollmentType,
  now: number,
  previousEnrollmentId?: Id<"enrollments">,
) {
  return ctx.db.insert("enrollments", {
    studentId,
    ...placement,
    enrollmentType,
    enrollmentDate: now,
    ...(previousEnrollmentId ? { previousEnrollmentId } : {}),
  });
}

/** Opens the first enrollment of a just-created student (admission). */
export function admit(
  ctx: MutationCtx,
  studentId: Id<"students">,
  placement: PlacementInput,
  now = Date.now(),
) {
  return insertOpen(ctx, studentId, placement, "new_admission", now);
}

/**
 * Re-admission: opens a new enrollment for a student with none open (a
 * leaver, or legacy data left with no class) and sets them active. Only an
 * open enrollment blocks it — re-admitting into the year the student left
 * gives that year two enrollments (closed + open), which is intended.
 */
export async function readmit(
  ctx: MutationCtx,
  student: Doc<"students">,
  placement: PlacementInput,
  now = Date.now(),
) {
  if (await getCurrentPlacement(ctx, student._id)) {
    throw new ConvexError({ code: "ALREADY_PLACED" });
  }
  await ctx.db.patch(student._id, { status: "active" });
  return insertOpen(ctx, student._id, placement, "readmission", now);
}

/**
 * Mid-year change of level or campus (including correcting a mistaken
 * placement): patches the open enrollment in place so the year's grades,
 * attendance and report cards stay on it. Never opens a second enrollment.
 * The year is not amendable — fees and fee sessions are keyed by year, so a
 * year change is a promotion / hold-back, not an edit.
 */
export async function amend(
  ctx: MutationCtx,
  studentId: Id<"students">,
  placement: Omit<PlacementInput, "academicYear">,
) {
  const open = await getCurrentPlacement(ctx, studentId);
  if (!open) throw new ConvexError({ code: "NOT_PLACED" });
  await ctx.db.patch(open._id, placement);
  return open._id;
}

/**
 * The one status operation. Sets `students.status` and, in the same
 * transaction, keeps the enrollment consistent with it:
 *  - leaver status → close the open enrollment (exitReason = the status);
 *  - suspended / active → status only, the enrollment stays open;
 *  - a leaver going back to active or suspended → rejected: that is a
 *    re-admission, which opens a new enrollment (`readmit`).
 */
export async function changeStatus(
  ctx: MutationCtx,
  student: Doc<"students">,
  status: StudentStatus,
  now = Date.now(),
) {
  if (isLeaver(student.status) && !isLeaver(status)) {
    throw new ConvexError({ code: "STUDENT_HAS_LEFT" });
  }
  if (student.status !== status) {
    await ctx.db.patch(student._id, { status });
  }
  // Also when already a leaver: closes anything legacy data left open.
  if (isLeaver(status)) await closeOpen(ctx, student._id, status, now);
}

/**
 * Promotion or hold-back of one open enrollment into the target year. The
 * guard runs first: if the student already has any enrollment in the target
 * year, nothing is written and `false` is returned — the source stays open.
 */
export async function moveToNextYear(
  ctx: MutationCtx,
  source: Doc<"enrollments">,
  target: {
    academicYear: Id<"academicYears">;
    standardLevelId: Id<"standardLevels">;
    kind: "promotion" | "hold_back";
  },
  now = Date.now(),
): Promise<boolean> {
  if (source.exitDate !== undefined) return false;
  const existing = await ctx.db
    .query("enrollments")
    .withIndex("by_student_academic_year", (q) =>
      q
        .eq("studentId", source.studentId)
        .eq("academicYear", target.academicYear),
    )
    .first();
  if (existing) return false;

  await ctx.db.patch(source._id, { exitDate: now, exitReason: target.kind });
  await insertOpen(
    ctx,
    source.studentId,
    {
      academicYear: target.academicYear,
      standardLevelId: target.standardLevelId,
      campus: source.campus,
    },
    target.kind === "promotion" ? "promotion" : "repeat",
    now,
    source._id,
  );
  return true;
}

/**
 * The import's placement upsert for one student the sheet lists (so: is
 * enrolled, in the import year). Never leaves two open enrollments:
 *  - open in the import year → amend level (and campus, when the sheet has one);
 *  - open in another year → reject the row; promotion is a separate act;
 *  - none open → open one (a second row in the same year is fine — only an
 *    open one counts), and a leaver on the sheet becomes active again.
 * `student` must be the document as it was BEFORE this row's patch — the row
 * may itself carry `status: "active"`, which would hide that they had left.
 * Returns true when it re-activated a leaver, for the batch audit.
 */
export async function placeFromImport(
  ctx: MutationCtx,
  student: Doc<"students">,
  placement: {
    standardLevelId: Id<"standardLevels">;
    campus?: Id<"campuses">;
    academicYear: Id<"academicYears">;
  },
  now: number,
  label: string,
): Promise<boolean> {
  const open = await getCurrentPlacement(ctx, student._id);
  if (open) {
    if (open.academicYear !== placement.academicYear) {
      // The preview rejects such rows first (`getExistingStudents`
      // .placedInOtherYear); this is the backstop, and it aborts the batch.
      throw new ConvexError({
        code: "PLACED_IN_OTHER_YEAR",
        studentNumber: student.studentNumber,
        row: label,
      });
    }
    await ctx.db.patch(open._id, {
      standardLevelId: placement.standardLevelId,
      ...(placement.campus ? { campus: placement.campus } : {}),
    });
    return false;
  }
  const wasLeaver = isLeaver(student.status);
  await insertOpen(
    ctx,
    student._id,
    placement,
    wasLeaver ? "readmission" : "new_admission",
    now,
  );
  if (!wasLeaver) return false;
  await ctx.db.patch(student._id, { status: "active" });
  return true;
}
