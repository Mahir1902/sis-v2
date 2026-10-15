import { v } from "convex/values";
import {
  dhakaDate,
  isDateLabel,
  isWeekend,
  shiftDate,
} from "../lib/attendanceDate";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { closedDatesFor, loadClosures } from "./closures";
import { loadClassesForYear, loadClassRoster } from "./enrollments";
import {
  attendanceLockReason,
  requireAttendanceWrite,
} from "./lib/attendancePermissions";
import { requireRole } from "./lib/permissions";

/**
 * Daily student attendance (spec: issue #111). One row per student per
 * Dhaka-local day holding a status; the class is frozen at mark time.
 * All aggregates return RAW COUNTS — the division lives in
 * `lib/attendancePercentage.ts` so screens and any future report-card
 * generator share one arithmetic.
 */

const statusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
);

function assertDate(date: string) {
  if (!isDateLabel(date)) {
    throw new Error("Date must be a real calendar day as YYYY-MM-DD");
  }
}

const classArgs = {
  campus: v.id("campuses"),
  standardLevelId: v.id("standardLevels"),
  academicYear: v.id("academicYears"),
};
type ClassKey = {
  campus: Id<"campuses">;
  standardLevelId: Id<"standardLevels">;
  academicYear: Id<"academicYears">;
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Attendance rows for one class on an inclusive date range. */
async function loadClassRows(
  ctx: QueryCtx,
  cls: ClassKey,
  start: string,
  end: string,
) {
  return await ctx.db
    .query("attendance")
    .withIndex("by_class_date", (q) =>
      q
        .eq("campus", cls.campus)
        .eq("standardLevelId", cls.standardLevelId)
        .eq("academicYear", cls.academicYear)
        .gte("date", start)
        .lte("date", end),
    )
    .take(10000);
}

/** One student's rows (under any class) on an inclusive date range. */
async function loadStudentRows(
  ctx: QueryCtx,
  studentId: Id<"students">,
  start: string,
  end: string,
) {
  return await ctx.db
    .query("attendance")
    .withIndex("by_student_date", (q) =>
      q.eq("studentId", studentId).gte("date", start).lte("date", end),
    )
    .take(1000);
}

/**
 * The semester bounds as Dhaka-local "YYYY-MM-DD" labels (spec §7 A7).
 * Semester 1 = startDate → semester1EndDate; semester 2 = the day after →
 * endDate. Null when the year has no split date — never a guessed boundary.
 */
function semesterPeriod(
  year: Doc<"academicYears">,
  semester: 1 | 2 | undefined,
): { start: string; end: string } | null {
  if (semester === undefined) {
    return { start: dhakaDate(year.startDate), end: dhakaDate(year.endDate) };
  }
  if (year.semester1EndDate === undefined) return null;
  const split = dhakaDate(year.semester1EndDate);
  return semester === 1
    ? { start: dhakaDate(year.startDate), end: split }
    : { start: shiftDate(split, 1), end: dhakaDate(year.endDate) };
}

/** date → campuses closed on that date, for the loaded closure list. */
function closureMap(closures: Doc<"closures">[]) {
  const map = new Map<string, Set<Id<"campuses">>>();
  for (const c of closures) {
    const set = map.get(c.date) ?? new Set();
    for (const campus of c.campuses) set.add(campus);
    map.set(c.date, set);
  }
  return map;
}

/**
 * The percentage rule, §2.1. Denominator = union of dates the class was
 * marked and dates the student has a row, minus dates closed for the campus
 * frozen on that date (the student's own row's campus if they have one, else
 * the class's). A date in the denominator with no row counts as absent.
 */
function tallyStudent(opts: {
  classDates: Set<string>;
  classFirstMarked: string | null;
  classCampus: Id<"campuses">;
  studentRows: Doc<"attendance">[];
  closures: Map<string, Set<Id<"campuses">>>;
}) {
  const byDate = new Map(opts.studentRows.map((r) => [r.date, r]));
  const dates = new Set([...opts.classDates, ...byDate.keys()]);

  let present = 0;
  let late = 0;
  let denominator = 0;
  const missedDays: Array<{
    date: string;
    status: "absent" | "late";
    note: string | null;
  }> = [];

  for (const date of [...dates].sort()) {
    const row = byDate.get(date);
    const campus = row?.campus ?? opts.classCampus;
    if (opts.closures.get(date)?.has(campus)) continue;
    denominator += 1;
    if (row?.status === "present") present += 1;
    else if (row?.status === "late") {
      late += 1;
      missedDays.push({ date, status: "late", note: row.note ?? null });
    } else {
      missedDays.push({ date, status: "absent", note: row?.note ?? null });
    }
  }

  const firstRow = [...byDate.keys()].sort()[0] ?? null;
  const firstAppearance =
    firstRow !== null &&
    opts.classFirstMarked !== null &&
    firstRow > opts.classFirstMarked
      ? firstRow
      : null;

  return {
    present,
    late,
    absent: denominator - present - late,
    denominator,
    firstAppearance,
    missedDays,
  };
}

/** Class-side inputs every aggregate needs: marked dates and closures. */
async function loadClassPeriod(
  ctx: QueryCtx,
  cls: ClassKey,
  start: string,
  end: string,
) {
  const [classRows, closureDocs] = await Promise.all([
    loadClassRows(ctx, cls, start, end),
    loadClosures(ctx, start, end),
  ]);
  const closures = closureMap(closureDocs);
  const closedForClass = closedDatesFor(closureDocs, cls.campus);
  const classDates = new Set(
    classRows.map((r) => r.date).filter((d) => !closedForClass.has(d)),
  );
  const classFirstMarked = [...classDates].sort()[0] ?? null;
  return { classDates, classFirstMarked, closures, closedForClass };
}

// ─── getRegister ─────────────────────────────────────────────────────────────

/**
 * The register for one class on one date: roster, existing marks, who last
 * marked it and when, and the server's own verdict on whether the caller may
 * write this date (`canWrite` / `lockReason`), so the UI never re-derives
 * the rule.
 */
export const getRegister = query({
  args: { ...classArgs, date: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    assertDate(args.date);

    const [roster, marks, closureDocs] = await Promise.all([
      loadClassRoster(ctx, args),
      loadClassRows(ctx, args, args.date, args.date),
      loadClosures(ctx, args.date, args.date),
    ]);
    const closure =
      closureDocs.find((c) => c.campuses.includes(args.campus)) ?? null;

    const lockReason =
      attendanceLockReason(user.role, args.date) ??
      (closure ? ("closed" as const) : null);

    const latest = marks.reduce<Doc<"attendance"> | null>(
      (best, m) => (best === null || m.markedAt > best.markedAt ? m : best),
      null,
    );
    const marker = latest ? await ctx.db.get(latest.markedBy) : null;
    const statusByStudent = new Map(marks.map((m) => [m.studentId, m.status]));

    return {
      date: args.date,
      canWrite: lockReason === null,
      lockReason,
      closure: closure ? { reason: closure.reason } : null,
      markedAt: latest?.markedAt ?? null,
      markedBy: marker ? { name: marker.name } : null,
      students: roster.map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        studentNumber: s.studentNumber,
        status: statusByStudent.get(s.studentId) ?? null,
      })),
    };
  },
});

// ─── saveRegister ────────────────────────────────────────────────────────────

/**
 * Write a class's marks for one date. Last writer wins. Uniqueness is checked
 * per (student, date) on `by_student_date` — NEVER per class — so a student
 * who moved class mid-year never gets a second row for the same day; the
 * existing row re-freezes to the class that just marked them. One audit row
 * per record whose status actually changed, carrying old → new. `note` is
 * never touched here.
 */
export const saveRegister = mutation({
  args: {
    ...classArgs,
    date: v.string(),
    marks: v.array(
      v.object({ studentId: v.id("students"), status: statusValidator }),
    ),
  },
  handler: async (ctx, args) => {
    assertDate(args.date);
    const user = await requireAttendanceWrite(ctx, args.date);

    // Last entry wins if the same student appears twice in one batch.
    const marks = [
      ...new Map(args.marks.map((m) => [m.studentId, m.status])),
    ].map(([studentId, status]) => ({ studentId, status }));

    const existing = await Promise.all(
      marks.map((m) =>
        ctx.db
          .query("attendance")
          .withIndex("by_student_date", (q) =>
            q.eq("studentId", m.studentId).eq("date", args.date),
          )
          .unique(),
      ),
    );

    const now = Date.now();
    const cls = {
      campus: args.campus,
      standardLevelId: args.standardLevelId,
      academicYear: args.academicYear,
    };
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    await Promise.all(
      marks.map(async (m, i) => {
        const row = existing[i];
        if (!row) {
          await ctx.db.insert("attendance", {
            studentId: m.studentId,
            date: args.date,
            status: m.status,
            ...cls,
            markedBy: user._id,
            markedAt: now,
          });
          created += 1;
          return;
        }
        await ctx.db.patch(row._id, {
          status: m.status,
          ...cls,
          markedBy: user._id,
          markedAt: now,
        });
        if (row.status === m.status) {
          unchanged += 1;
          return;
        }
        updated += 1;
        const student = await ctx.db.get(m.studentId);
        await logAudit(ctx, {
          user,
          action: "update",
          entityType: "attendance",
          entityId: row._id,
          description: `Attendance changed for ${student?.studentFullName ?? "student"} on ${args.date}`,
          metadata: {
            studentId: m.studentId,
            date: args.date,
            from: row.status,
            to: m.status,
          },
        });
      }),
    );

    return { created, updated, unchanged };
  },
});

// ─── getDay ──────────────────────────────────────────────────────────────────

/**
 * The morning call list: every absent/late student on a date, grouped by
 * class with one contact phone each, plus which classes have been marked.
 * One `by_date` range; the marked classes are derived from those same rows.
 */
export const getDay = query({
  args: { date: v.string(), academicYear: v.id("academicYears") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    assertDate(args.date);

    const [rows, classes] = await Promise.all([
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .take(5000),
      loadClassesForYear(ctx, args.academicYear),
    ]);
    const yearRows = rows.filter((r) => r.academicYear === args.academicYear);
    const key = (c: { campus: string; standardLevelId: string }) =>
      `${c.campus}|${c.standardLevelId}`;
    const markedKeys = new Set(yearRows.map(key));

    const absentRows = yearRows.filter((r) => r.status !== "present");
    const students = await Promise.all(
      absentRows.map((r) => ctx.db.get(r.studentId)),
    );
    const absentees = absentRows.map((r, i) => {
      const s = students[i];
      const label = s?.primaryBillingContact ?? "guardian";
      const phone =
        label === "father"
          ? s?.fatherPhoneNumber
          : label === "mother"
            ? s?.motherPhoneNumber
            : s?.guardianPhoneNumber;
      return {
        classKey: key(r),
        studentId: r.studentId,
        studentName: s?.studentFullName ?? "Unknown",
        status: r.status as "absent" | "late",
        phone: phone ?? "",
        contactLabel: label,
        attendanceId: r._id,
        note: r.note ?? null,
      };
    });

    const groups = classes
      .map((c) => ({
        campus: c.campus,
        campusName: c.campusName,
        standardLevelId: c.standardLevelId,
        levelName: c.levelName,
        studentCount: c.studentCount,
        marked: markedKeys.has(key(c)),
        absentees: absentees
          .filter((a) => a.classKey === key(c))
          .sort((a, b) => a.studentName.localeCompare(b.studentName))
          .map(({ classKey: _k, ...a }) => a),
      }))
      .filter((g) => g.studentCount > 0 || g.absentees.length > 0);
    const countable = groups.filter((g) => g.studentCount > 0);

    return {
      date: args.date,
      classesMarked: countable.filter((g) => g.marked).length,
      classesTotal: countable.length,
      groups,
    };
  },
});

// ─── getClassReport ──────────────────────────────────────────────────────────

/**
 * Raw per-student counts for one class and semester — the figures the
 * report-card typist reads. `periodStart: null` means the year has no
 * semester-1 end date and the screen renders "—" for everyone.
 * `schoolDaysUnmarked` (flag 1) and `firstAppearance` (flag 2) are part of
 * the figure, not decoration (spec §2.3).
 */
export const getClassReport = query({
  args: { ...classArgs, semester: v.union(v.literal(1), v.literal(2)) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const year = await ctx.db.get(args.academicYear);
    if (!year) throw new Error("Academic year not found");

    const empty = {
      periodStart: null,
      periodEnd: null,
      classMarkedDays: 0,
      schoolDaysUnmarked: 0,
      classFirstMarked: null,
      students: [],
    };
    const period = semesterPeriod(year, args.semester);
    if (!period) return empty;

    const [roster, cls] = await Promise.all([
      loadClassRoster(ctx, args, { includeInactive: true }),
      loadClassPeriod(ctx, args, period.start, period.end),
    ]);
    const studentRows = await Promise.all(
      roster.map((s) =>
        loadStudentRows(ctx, s.studentId, period.start, period.end),
      ),
    );

    // Flag 1: school days (not Fri/Sat, not closed) the class never marked.
    // Capped at today — days that have not happened yet are not "unmarked".
    const today = dhakaDate();
    let schoolDaysUnmarked = 0;
    for (
      let d = period.start;
      d <= period.end && d <= today;
      d = shiftDate(d, 1)
    ) {
      if (isWeekend(d) || cls.closedForClass.has(d) || cls.classDates.has(d))
        continue;
      schoolDaysUnmarked += 1;
    }

    return {
      periodStart: period.start,
      periodEnd: period.end,
      classMarkedDays: cls.classDates.size,
      schoolDaysUnmarked,
      classFirstMarked: cls.classFirstMarked,
      students: roster.map((s, i) => {
        const { missedDays: _m, ...counts } = tallyStudent({
          classDates: cls.classDates,
          classFirstMarked: cls.classFirstMarked,
          classCampus: args.campus,
          studentRows: studentRows[i],
          closures: cls.closures,
        });
        return {
          studentId: s.studentId,
          studentName: s.studentName,
          studentNumber: s.studentNumber,
          ...counts,
        };
      }),
    };
  },
});

// ─── getStudentAttendance ────────────────────────────────────────────────────

/**
 * One student's raw counts and the dated list of every day missed, for the
 * student Attendance tab. The class-side marked dates come from the
 * student's enrollment in the year. A semester on a year with no split date
 * returns zero counts with `periodStart: null`.
 */
export const getStudentAttendance = query({
  args: {
    studentId: v.id("students"),
    academicYear: v.id("academicYears"),
    semester: v.optional(v.union(v.literal(1), v.literal(2))),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const year = await ctx.db.get(args.academicYear);
    if (!year) throw new Error("Academic year not found");

    const empty = {
      periodStart: null,
      periodEnd: null,
      present: 0,
      late: 0,
      absent: 0,
      denominator: 0,
      firstAppearance: null,
      missedDays: [],
    };
    const period = semesterPeriod(year, args.semester);
    if (!period) return empty;

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", args.studentId).eq("academicYear", args.academicYear),
      )
      .take(20);
    const enrollment =
      enrollments.find((e) => e.exitDate === undefined) ??
      enrollments.sort((a, b) => b.enrollmentDate - a.enrollmentDate)[0];
    if (!enrollment) return empty;

    const cls = {
      campus: enrollment.campus,
      standardLevelId: enrollment.standardLevelId,
      academicYear: args.academicYear,
    };
    const [classPeriod, studentRows] = await Promise.all([
      loadClassPeriod(ctx, cls, period.start, period.end),
      loadStudentRows(ctx, args.studentId, period.start, period.end),
    ]);

    return {
      periodStart: period.start,
      periodEnd: period.end,
      ...tallyStudent({
        classDates: classPeriod.classDates,
        classFirstMarked: classPeriod.classFirstMarked,
        classCampus: cls.campus,
        studentRows,
        closures: classPeriod.closures,
      }),
    };
  },
});

// ─── setNote ─────────────────────────────────────────────────────────────────

/**
 * The office's reason for an absence. Changes no number. Admin only; an
 * empty string clears the field. No audit row.
 */
export const setNote = mutation({
  args: { attendanceId: v.id("attendance"), note: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const row = await ctx.db.get(args.attendanceId);
    if (!row) throw new Error("Attendance record not found");
    const note = args.note.trim();
    await ctx.db.patch(args.attendanceId, {
      note: note.length > 0 ? note : undefined,
    });
    return null;
  },
});
