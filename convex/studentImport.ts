import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";
import { getCurrentPlacement, placeFromImport } from "./lib/placement";

/**
 * The write path for the Excel student import
 * (`docs/wayfinder/excel-import/IMPLEMENTATION-SPEC.md` §5).
 *
 * Deliberately not a reuse of `createStudent` / `createEnrollment`: those take
 * the strict pre-widening argument shape, write one audit document per row
 * (400 rows ⇒ 400 extra writes), and hard-set an admission date and an active
 * status this import must not assert.
 *
 * The rows arrive as client-supplied JSON — the browser parse is not a trust
 * boundary, so every field is re-validated here: types and shape by the args
 * validator, reference names by lookup against the seeded tables, and the
 * identity key by the duplicate guard.
 *
 * What is deliberately *not* re-checked here are §3.2's per-row data-quality
 * rejections (the `S{MM}{YY}-{seq}` number format, the ~1990–today date range).
 * Those decide which rows the admin commits, and the preview owns them because
 * it is the only place that can hand back a per-row reject list; duplicating
 * them here would turn one bad row into a whole-batch throw the moment the two
 * copies drift.
 */

/**
 * Nothing the sheet legitimately carries is longer than this. Batch *size* is
 * deliberately not capped here: §4.4 makes batching client-driven and §4.3
 * sizes the whole school at one mutation, so the binding ceiling is Convex's
 * own index-range limit, not a number invented in this file.
 */
const MAX_TEXT = 500;

/**
 * One parsed row: the mapped `students` fields only (§1.2), with reference
 * data still as names — resolving them to ids is this module's job. Dates are
 * epoch ms, converted at the browser boundary (§5.5).
 */
export const importRowValidator = v.object({
  studentNumber: v.string(),
  studentFullName: v.optional(v.string()),
  gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
  dateOfBirth: v.optional(v.float64()),
  citizenship: v.optional(v.string()),
  religion: v.optional(v.string()),
  birthCertificateNumber: v.optional(v.string()),
  passportNumber: v.optional(v.string()),
  /** `standardLevels.name`, from CURRENT CLASS — the one required column. */
  standardLevel: v.string(),
  /** `campuses.name`. */
  campus: v.optional(v.string()),
  /** `standardLevels.name`, from ADMITTED CLASS. */
  admittedLevel: v.optional(v.string()),
  /** `academicYears.name`, from the sheet's ACADEMIC YEAR column. */
  admissionAcademicYear: v.optional(v.string()),
  admissionSemester: v.optional(v.string()),
  classStartDate: v.optional(v.float64()),
  /** R5: mirrors `classStartDate`, never `Date.now()` — an imported record
   * must not claim it was admitted on the day of the import. */
  admissionDate: v.optional(v.float64()),
  fatherName: v.optional(v.string()),
  motherName: v.optional(v.string()),
  fatherPhoneNumber: v.optional(v.string()),
  motherPhoneNumber: v.optional(v.string()),
  presentAddress: v.optional(v.string()),
  permanentAddress: v.optional(v.string()),
  fatherEmail: v.optional(v.string()),
  /** The sheet's only status value is OPEN → active (§1.2). */
  status: v.optional(v.literal("active")),
});

export type ImportRow = Infer<typeof importRowValidator>;

type StudentFields = Partial<
  Omit<
    Doc<"students">,
    "_id" | "_creationTime" | "standardLevel" | "academicYear" | "campus"
  >
> & {
  studentNumber: string;
};

/** The row's class — written to the enrollment, never the student record. */
type RowPlacement = {
  standardLevelId: Id<"standardLevels">;
  campus?: Id<"campuses">;
};

type Reference = {
  levels: Map<string, Id<"standardLevels">>;
  years: Map<string, Id<"academicYears">>;
  campuses: Map<string, Id<"campuses">>;
};

/**
 * The three lookup tables, once per call — never per row (§4.3). They are
 * seeded reference data (~30 documents in total), so a full read is bounded.
 */
async function loadReference(ctx: MutationCtx): Promise<Reference> {
  const [levels, years, campuses] = await Promise.all([
    ctx.db.query("standardLevels").collect(),
    ctx.db.query("academicYears").collect(),
    ctx.db.query("campuses").collect(),
  ]);
  return {
    levels: new Map(levels.map((l) => [l.name, l._id])),
    years: new Map(years.map((y) => [y.name, y._id])),
    campuses: new Map(campuses.map((c) => [c.name, c._id])),
  };
}

/** Trim + collapse internal whitespace runs, matching the browser's §1.5. */
const normalise = (value: string) => value.replace(/\s+/g, " ").trim();

/** Normalise; empty becomes absent. Anything absurdly long is hostile. */
function cleanText(
  value: string | undefined,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = normalise(value);
  if (trimmed === "") return undefined;
  if (trimmed.length > MAX_TEXT) throw new Error(`${label}: value too long`);
  return trimmed;
}

/** `v.float64()` admits NaN and Infinity; a date is neither. */
function epochMs(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error(`${label}: invalid date`);
  return value;
}

/** Resolve a name against seeded reference data, or reject the row (D6). */
function lookup<T>(
  map: Map<string, T>,
  name: string | undefined,
  what: string,
  label: string,
): T | undefined {
  if (name === undefined) return undefined;
  const id = map.get(name);
  if (!id) throw new Error(`${label}: unknown ${what} "${name}"`);
  return id;
}

/**
 * Re-validate one row and resolve its names to ids. Fields the row does not
 * carry are simply absent from the result — never `undefined`, which
 * `ctx.db.patch` would read as "delete this field" and so would wipe a value
 * an admin set in the app between uploads.
 */
function resolveRow(row: ImportRow, ref: Reference, label: string) {
  const studentNumber = cleanText(row.studentNumber, label);
  if (!studentNumber) throw new Error(`${label}: missing student number`);

  const standardLevel = lookup(
    ref.levels,
    cleanText(row.standardLevel, label),
    "class",
    label,
  );
  if (!standardLevel) throw new Error(`${label}: missing class`);

  const placement: RowPlacement = {
    standardLevelId: standardLevel,
    campus: lookup(ref.campuses, cleanText(row.campus, label), "campus", label),
  };

  const draft: StudentFields = {
    studentNumber,
    admittedLevel: lookup(
      ref.levels,
      cleanText(row.admittedLevel, label),
      "class",
      label,
    ),
    admissionAcademicYear: lookup(
      ref.years,
      cleanText(row.admissionAcademicYear, label),
      "academic year",
      label,
    ),
    studentFullName: cleanText(row.studentFullName, label),
    gender: row.gender,
    dateOfBirth: epochMs(row.dateOfBirth, label),
    citizenship: cleanText(row.citizenship, label),
    religion: cleanText(row.religion, label),
    birthCertificateNumber: cleanText(row.birthCertificateNumber, label),
    passportNumber: cleanText(row.passportNumber, label),
    admissionSemester: cleanText(row.admissionSemester, label),
    classStartDate: epochMs(row.classStartDate, label),
    admissionDate: epochMs(row.admissionDate, label),
    fatherName: cleanText(row.fatherName, label),
    motherName: cleanText(row.motherName, label),
    fatherPhoneNumber: cleanText(row.fatherPhoneNumber, label),
    motherPhoneNumber: cleanText(row.motherPhoneNumber, label),
    presentAddress: cleanText(row.presentAddress, label),
    permanentAddress: cleanText(row.permanentAddress, label),
    fatherEmail: cleanText(row.fatherEmail, label)?.toLowerCase(),
    status: row.status,
  };

  // The strip is the whole point — see the doc comment above.
  const fields = Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== undefined),
  ) as StudentFields;
  return { fields, placement };
}

/**
 * Read → insert|patch, for one row. Rows are independent: nothing here touches
 * another row's documents, which is what makes an arbitrary batch boundary
 * safe. If sibling linking is ever revived it runs as a separate pass after
 * all batches commit, never inside one.
 *
 * The row's class goes to the enrollment through the Placement module, which
 * never leaves two open enrollments (`placeFromImport`).
 */
async function upsertRow(
  ctx: MutationCtx,
  row: ImportRow,
  ref: Reference,
  academicYear: Id<"academicYears">,
  now: number,
  label: string,
): Promise<{
  studentNumber: string;
  action: "inserted" | "updated";
  reactivated: boolean;
}> {
  const { fields, placement } = resolveRow(row, ref, label);
  const place = { ...placement, academicYear };

  const existing = await ctx.db
    .query("students")
    .withIndex("by_student_number", (q) =>
      q.eq("studentNumber", fields.studentNumber),
    )
    .first();

  if (existing) {
    // Placement first, from the pre-patch doc: the row's own
    // `status: "active"` must not hide that the student had left.
    // enrollmentDate is a record-creation stamp — an amended enrollment keeps it.
    const reactivated = await placeFromImport(ctx, existing, place, now, label);
    await ctx.db.patch(existing._id, fields);
    return {
      studentNumber: fields.studentNumber,
      action: "updated",
      reactivated,
    };
  }

  const studentId = await ctx.db.insert("students", {
    ...fields,
    createdAt: new Date(now).toISOString(),
  });
  // Brand-new student: no enrollment exists, so this just opens one.
  const student = await ctx.db.get(studentId);
  if (student) await placeFromImport(ctx, student, place, now, label);
  return {
    studentNumber: fields.studentNumber,
    action: "inserted",
    reactivated: false,
  };
}

/**
 * Commits one batch of parsed import rows. Admin-only. Upserts each student on
 * `studentNumber` and upserts that student's enrollment for `academicYear`,
 * then writes a single audit document for the batch.
 *
 * @param runId Client-generated id stitching a run's batches together.
 * @param batch Which batch of the run this is, 1-based — the only thing that
 *   orders a run's audit documents, since nothing server-side tracks a run.
 * @param rows Parsed rows, at most one batch's worth.
 * @param academicYear The year every row is placed in — the admin's pick,
 *   the same one the preview was built for (D4). Never guessed here.
 * @returns What each student number did — inserted or updated.
 */
export const commitImportBatch = mutation({
  args: {
    runId: v.string(),
    batch: v.float64(),
    rows: v.array(importRowValidator),
    academicYear: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const runId = args.runId.trim();
    if (!runId) throw new Error("Missing run id");

    // Two rows for the same student in one batch would each miss the read and
    // mint a document. The preview rejects the file for this; the server does
    // not take the browser's word for it. Normalised the same way the write
    // is, or the two disagree and the guard passes rows that then collide.
    const numbers = args.rows.map((row) => normalise(row.studentNumber));
    const duplicate = numbers.find((n, i) => numbers.indexOf(n) !== i);
    if (duplicate) {
      throw new Error(`Student number "${duplicate}" appears twice`);
    }

    const ref = await loadReference(ctx);
    const { academicYear } = args;
    if (!(await ctx.db.get(academicYear))) {
      throw new ConvexError("That academic year no longer exists");
    }

    const now = Date.now();
    const results = await Promise.all(
      args.rows.map((row, i) =>
        upsertRow(ctx, row, ref, academicYear, now, `Row ${i + 1}`),
      ),
    );

    // One audit document per batch, not per row. The two number lists are the
    // reversal path for a wrong-file import (§5.4) — the only thing about a
    // run that is persisted.
    const inserted = results
      .filter((r) => r.action === "inserted")
      .map((r) => r.studentNumber);
    const updated = results
      .filter((r) => r.action === "updated")
      .map((r) => r.studentNumber);
    // Leavers the sheet lists, set back to active with a new enrollment.
    const reactivated = results
      .filter((r) => r.reactivated)
      .map((r) => r.studentNumber);
    await logAudit(ctx, {
      user,
      action: "upload",
      entityType: "students",
      entityId: runId,
      description: `Student import: ${inserted.length} added, ${updated.length} updated`,
      metadata: { runId, batch: args.batch, inserted, updated, reactivated },
    });

    return results.map(({ studentNumber, action }) => ({
      studentNumber,
      action,
    }));
  },
});

/** The three lookup tables the other way round — id → name, for the preview. */
async function loadNames(ctx: QueryCtx) {
  const [levels, years, campuses] = await Promise.all([
    ctx.db.query("standardLevels").collect(),
    ctx.db.query("academicYears").collect(),
    ctx.db.query("campuses").collect(),
  ]);
  return {
    levels: new Map(levels.map((l) => [l._id, l.name])),
    years: new Map(years.map((y) => [y._id, y.name])),
    campuses: new Map(campuses.map((c) => [c._id, c.name])),
  };
}

/** Epoch ms → the `YYYY-MM-DD` the preview shows, read in UTC (§5.5). */
const dateText = (ms: number | undefined) =>
  ms === undefined ? null : new Date(ms).toISOString().slice(0, 10);

/**
 * The students among the given numbers that already exist, each with the
 * current value of every field the import writes. Admin-only.
 * `academicYear` is the import's year, so `placedInOtherYear` matches what
 * `commitImportBatch` will refuse for that same year.
 *
 * Two jobs, one round trip: the returned numbers drive the new-vs-update split
 * (§5.2), and the field values are what the inspector renders as `old → new`
 * (§7.3) — the entire overwrite mitigation. Values are formatted the way the
 * preview formats them (ids as names, dates as `YYYY-MM-DD`) so an unchanged
 * field never reads as a change. Fields the import does not write are left
 * out: showing a diff for one would promise an overwrite that never happens.
 *
 * One index range per number, so the caller chunks at 250 alongside the commit
 * batches — the ceiling that actually binds is Convex's own, not one invented
 * here.
 */
export const getExistingStudents = query({
  args: {
    studentNumbers: v.array(v.string()),
    academicYear: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const unique = [...new Set(args.studentNumbers.map(normalise))];
    const [found, names] = await Promise.all([
      Promise.all(
        unique.map((studentNumber) =>
          ctx.db
            .query("students")
            .withIndex("by_student_number", (q) =>
              q.eq("studentNumber", studentNumber),
            )
            .first(),
        ),
      ),
      loadNames(ctx),
    ]);

    const students = found.filter((s) => s !== null);
    const placements = await Promise.all(
      students.map((s) => getCurrentPlacement(ctx, s._id)),
    );

    return students.map((s, i) => {
      const placement = placements[i];
      return {
        studentNumber: s.studentNumber,
        // In a class in another year: the commit would refuse the row (no
        // second open enrollment), so the preview rejects it up front.
        placedInOtherYear:
          !!placement && placement.academicYear !== args.academicYear,
        fields: {
          studentFullName: s.studentFullName ?? null,
          gender: s.gender ?? null,
          dateOfBirth: dateText(s.dateOfBirth),
          citizenship: s.citizenship ?? null,
          religion: s.religion ?? null,
          birthCertificateNumber: s.birthCertificateNumber ?? null,
          passportNumber: s.passportNumber ?? null,
          standardLevel: placement
            ? (names.levels.get(placement.standardLevelId) ?? null)
            : null,
          campus: placement?.campus
            ? (names.campuses.get(placement.campus) ?? null)
            : null,
          admittedLevel: s.admittedLevel
            ? (names.levels.get(s.admittedLevel) ?? null)
            : null,
          admissionAcademicYear: s.admissionAcademicYear
            ? (names.years.get(s.admissionAcademicYear) ?? null)
            : null,
          admissionSemester: s.admissionSemester ?? null,
          classStartDate: dateText(s.classStartDate),
          admissionDate: dateText(s.admissionDate),
          fatherName: s.fatherName ?? null,
          motherName: s.motherName ?? null,
          fatherPhoneNumber: s.fatherPhoneNumber ?? null,
          motherPhoneNumber: s.motherPhoneNumber ?? null,
          presentAddress: s.presentAddress ?? null,
          permanentAddress: s.permanentAddress ?? null,
          fatherEmail: s.fatherEmail ?? null,
          status: s.status ?? null,
        },
      };
    });
  },
});
