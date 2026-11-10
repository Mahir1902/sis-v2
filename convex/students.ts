import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";
import {
  admit,
  amend,
  changeStatus,
  getCurrentPlacement,
  readmit,
} from "./lib/placement";

const studentStatus = v.union(
  v.literal("active"),
  v.literal("graduated"),
  v.literal("transferred"),
  v.literal("withdrawn"),
  v.literal("suspended"),
  v.literal("expelled"),
);

/**
 * Generate a Convex storage upload URL for a student photo.
 * Client uploads the file directly, then passes the returned storageId to createStudent.
 */
export const generateStudentPhotoUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Admission: creates the student record and opens their first enrollment in
 * one transaction, so a student never exists without a class. The class
 * (level, year, campus) is stored on the enrollment only.
 * Returns the new student's ID.
 */
export const createStudent = mutation({
  args: {
    studentNumber: v.string(),
    studentFullName: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female")),
    dateOfBirth: v.float64(),
    placeOfBirth: v.string(),
    citizenship: v.string(),
    religion: v.string(),
    bloodGroup: v.string(),
    birthCertificateNumber: v.string(),
    passportNumber: v.optional(v.string()),
    passportValidTill: v.optional(v.float64()),
    standardLevel: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    campus: v.id("campuses"),
    classStartDate: v.float64(),
    presentAddress: v.string(),
    permanentAddress: v.optional(v.string()),
    previousSchoolName: v.optional(v.string()),
    previousSchoolAddress: v.optional(v.string()),
    healthIssue: v.object({
      hasHealthIssues: v.boolean(),
      issueDescription: v.optional(v.string()),
    }),
    studentPhotoUrl: v.optional(v.id("_storage")),
    fatherPhotoUrl: v.optional(v.id("_storage")),
    motherPhotoUrl: v.optional(v.id("_storage")),
    fatherName: v.string(),
    fatherOccupation: v.string(),
    fatherNidNumber: v.string(),
    fatherPhoneNumber: v.string(),
    motherName: v.string(),
    motherOccupation: v.string(),
    motherNidNumber: v.string(),
    motherPhoneNumber: v.string(),
    guardianName: v.string(),
    guardianRelation: v.string(),
    guardianNidNumber: v.string(),
    guardianPhoneNumber: v.string(),
    familyAnnualIncome: v.string(),
    siblingIds: v.optional(v.array(v.id("students"))),
    consultantName: v.string(),

    // Issue #33 fields. Currently optional in the mutation args because the
    // admission form (issue #31) has not yet wired them. The server defaults
    // `primaryBillingContact` to `"father"` so the schema stays satisfied —
    // matching the backfill rule used for pre-existing students.
    fatherEmail: v.optional(v.string()),
    motherEmail: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
    primaryBillingContact: v.optional(
      v.union(v.literal("father"), v.literal("mother"), v.literal("guardian")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const { standardLevel, academicYear, campus, ...studentFields } = args;
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      ...studentFields,
      // Default Billing Contact to "father" until the admission form (#31)
      // captures the caller's explicit choice. Stays consistent with the
      // backfill default applied to pre-existing students.
      primaryBillingContact: args.primaryBillingContact ?? "father",
      status: "active",
      admissionDate: now,
      createdAt: new Date(now).toISOString(),
    });
    await admit(
      ctx,
      studentId,
      { standardLevelId: standardLevel, academicYear, campus },
      now,
    );

    // Bidirectional sibling linking — both patches in the same mutation (atomic)
    if (args.siblingIds && args.siblingIds.length > 0) {
      for (const siblingId of args.siblingIds) {
        const sibling = await ctx.db.get(siblingId);
        if (sibling) {
          const existing = sibling.siblingIds ?? [];
          if (!existing.includes(studentId)) {
            await ctx.db.patch(siblingId, {
              siblingIds: [...existing, studentId],
            });
          }
        }
      }
    }

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "students",
      entityId: studentId,
      description: `Created student ${args.studentFullName}`,
    });

    return studentId;
  },
});

/**
 * Get all students with optional server-side filters.
 * Pre-fetches lookup tables to avoid N+1 reads.
 * Returns a slim projection for the list view.
 *
 * Class columns and the level / year filters come from each student's
 * Current Placement (open enrollment), read in one `by_exit_date` range. A
 * leaver has no placement: no level/year name, and no level/year filter
 * matches them.
 *
 * `status: ["unspecified"]` is a filter-only sentinel meaning "no status on
 * record" — it is never a stored value, so `updateStudentStatus` rejects it.
 */
export const getAllStudents = query({
  args: {
    standardLevel: v.optional(v.array(v.id("standardLevels"))),
    academicYear: v.optional(v.array(v.id("academicYears"))),
    gender: v.optional(
      v.array(v.union(v.literal("Male"), v.literal("Female"))),
    ),
    status: v.optional(
      v.array(
        v.union(
          v.literal("active"),
          v.literal("graduated"),
          v.literal("transferred"),
          v.literal("withdrawn"),
          v.literal("suspended"),
          v.literal("expelled"),
          // UI sentinel (#95) for "no status on record" — imported students
          // (#93) have no status and would otherwise be unfilterable.
          v.literal("unspecified"),
        ),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);

    // Pre-fetch ALL lookup tables (3 reads total, not 4 per student)
    const [allLevels, allYears] = await Promise.all([
      ctx.db.query("standardLevels").collect(),
      ctx.db.query("academicYears").collect(),
    ]);
    const levelMap = new Map(allLevels.map((l) => [l._id, l.name]));
    const yearMap = new Map(allYears.map((y) => [y._id, y.name]));

    // Every open enrollment, newest last so a (pre-migration) duplicate
    // resolves to the newest — same rule as `getCurrentPlacement`.
    const open = await ctx.db
      .query("enrollments")
      .withIndex("by_exit_date", (q) => q.eq("exitDate", undefined))
      .take(5000);
    open.sort((a, b) => a.enrollmentDate - b.enrollmentDate);
    const placementOf = new Map(open.map((e) => [e.studentId, e]));

    const levels = args.standardLevel ?? [];
    const years = args.academicYear ?? [];
    const genders = args.gender ?? [];
    const statuses = args.status ?? [];
    const matches = (s: Doc<"students">) =>
      (genders.length === 0 || (s.gender && genders.includes(s.gender))) &&
      (statuses.length === 0 ||
        // "unspecified" means the field is absent, not a stored value.
        statuses.includes(s.status ?? "unspecified"));

    let students: Doc<"students">[];
    if (levels.length > 0 || years.length > 0) {
      // Indexed path: the placement map picks the students, then we load them.
      const ids = [...placementOf.values()]
        .filter(
          (e) =>
            (levels.length === 0 || levels.includes(e.standardLevelId)) &&
            (years.length === 0 || years.includes(e.academicYear)),
        )
        .map((e) => e.studentId);
      const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
      students = docs.filter((s): s is Doc<"students"> => s !== null);
    } else {
      // ponytail: full scan capped at 2000 (school ~400); paginate past that.
      students = await ctx.db.query("students").take(2000);
    }
    students = students.filter(matches);

    // Resolve photo URLs + return slim projection
    const enriched = await Promise.all(
      students.map(async (s) => {
        const placement = placementOf.get(s._id);
        return {
          _id: s._id,
          studentNumber: s.studentNumber,
          studentFullName: s.studentFullName,
          studentPhotoUrl: s.studentPhotoUrl
            ? await ctx.storage.getUrl(s.studentPhotoUrl)
            : null,
          // Current Placement — all null for a leaver.
          standardLevel: placement?.standardLevelId ?? null,
          academicYear: placement?.academicYear ?? null,
          standardLevelName: placement
            ? (levelMap.get(placement.standardLevelId) ?? null)
            : null,
          academicYearName: placement
            ? (yearMap.get(placement.academicYear) ?? null)
            : null,
          gender: s.gender,
          classStartDate: s.classStartDate,
          status: s.status,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get a single student by ID with all refs and photo URLs resolved.
 */
export const getStudentById = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["admin", "teacher", "student"]);

    // Students can only view their own profile
    if (caller.role === "student") {
      if (!caller.studentId || caller.studentId !== args.studentId) {
        throw new Error("Unauthorized");
      }
    }

    const doc = await ctx.db.get(args.studentId);
    if (!doc) return null;
    // Drop the deprecated student-record copy of the class (narrow PR deletes
    // it); the class comes from the Current Placement below.
    const {
      standardLevel: _sl,
      academicYear: _ay,
      campus: _c,
      ...student
    } = doc;
    const open = await getCurrentPlacement(ctx, doc._id);

    const [
      standardLevel,
      academicYear,
      campus,
      studentPhoto,
      fatherPhoto,
      motherPhoto,
    ] = await Promise.all([
      open ? ctx.db.get(open.standardLevelId) : null,
      open ? ctx.db.get(open.academicYear) : null,
      // A leaver has no placement, and an imported enrollment may have no
      // campus (#93) — either way the doc is null and the UI shows an em-dash.
      open?.campus ? ctx.db.get(open.campus) : null,
      student.studentPhotoUrl
        ? ctx.storage.getUrl(student.studentPhotoUrl)
        : null,
      student.fatherPhotoUrl
        ? ctx.storage.getUrl(student.fatherPhotoUrl)
        : null,
      student.motherPhotoUrl
        ? ctx.storage.getUrl(student.motherPhotoUrl)
        : null,
    ]);

    const result = {
      ...student,
      studentPhotoUrl: studentPhoto,
      fatherPhotoUrl: fatherPhoto,
      motherPhotoUrl: motherPhoto,
      // Current Placement ids for the edit dialog; null for a leaver.
      placement: open
        ? {
            enrollmentId: open._id,
            standardLevelId: open.standardLevelId,
            academicYear: open.academicYear,
            campus: open.campus ?? null,
          }
        : null,
      standardLevelDoc: standardLevel,
      academicYearDoc: academicYear,
      campusDoc: campus,
    };

    // Strip sensitive fields for student callers
    if (caller.role === "student") {
      const {
        fatherNidNumber: _fn,
        motherNidNumber: _mn,
        guardianNidNumber: _gn,
        familyAnnualIncome: _fi,
        passportNumber: _pp,
        ...safe
      } = result;
      return safe;
    }

    return result;
  },
});

/**
 * Change a student's status. Leaving (graduated / withdrawn / transferred /
 * expelled) also closes the open enrollment in the same transaction;
 * suspended and active touch the status only. A leaver cannot be set back to
 * active or suspended — that is `readmitStudent` (ConvexError
 * `STUDENT_HAS_LEFT`).
 */
export const updateStudentStatus = mutation({
  args: {
    studentId: v.id("students"),
    status: studentStatus,
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const oldStatus = student.status;
    await changeStatus(ctx, student, args.status);

    await logAudit(ctx, {
      user,
      action: "status_change",
      entityType: "students",
      entityId: args.studentId,
      // Imported students (#93) may have neither a name nor a prior status,
      // and this is the flow that first sets one — never write "undefined".
      description: `Changed student ${student.studentFullName ?? student.studentNumber} status from ${oldStatus ?? "unspecified"} to ${args.status}`,
      metadata: { oldStatus, newStatus: args.status },
    });

    return args.studentId;
  },
});

/**
 * Re-admission: places a student who has no open enrollment (a leaver) in a
 * class again — opens a new enrollment and sets them active. ConvexError
 * `ALREADY_PLACED` if they already have one.
 */
export const readmitStudent = mutation({
  args: {
    studentId: v.id("students"),
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    campus: v.id("campuses"),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const { studentId, ...placement } = args;
    const enrollmentId = await readmit(ctx, student, placement);

    await logAudit(ctx, {
      user,
      action: "status_change",
      entityType: "students",
      entityId: studentId,
      description: `Re-admitted student ${student.studentFullName ?? student.studentNumber}`,
      metadata: {
        oldStatus: student.status,
        newStatus: "active",
        enrollmentId,
      },
    });

    return enrollmentId;
  },
});

/**
 * Sets the email for a single Billing Contact slot on a student record
 * (`father` → `fatherEmail`, `mother` → `motherEmail`, `guardian` →
 * `guardianEmail`). Admin-only.
 *
 * Used by the inline "Add Email" affordance on the invoice Compose Email
 * button (issue #31). Touches only the one email field — does not modify
 * `primaryBillingContact` or any other student fields, and never overwrites
 * a different slot than the one named.
 *
 * Errors loudly on an empty email; the form-level validation should catch
 * format issues before the mutation is called, but we re-check here so a
 * mis-wired caller cannot persist garbage.
 */
export const updateBillingContactEmail = mutation({
  args: {
    studentId: v.id("students"),
    contactType: v.union(
      v.literal("father"),
      v.literal("mother"),
      v.literal("guardian"),
    ),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const trimmed = args.email.trim();
    if (trimmed.length === 0) throw new Error("Email is required");

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const fieldByType = {
      father: "fatherEmail",
      mother: "motherEmail",
      guardian: "guardianEmail",
    } as const;
    const field = fieldByType[args.contactType];

    await ctx.db.patch(args.studentId, { [field]: trimmed });

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "students",
      entityId: args.studentId,
      description: `Updated ${args.contactType} email for ${student.studentFullName}`,
      metadata: { contactType: args.contactType, field },
    });

    return args.studentId;
  },
});

/**
 * Get sibling summaries for a student.
 */
export const getSiblingsByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);

    const student = await ctx.db.get(args.studentId);
    if (!student || !student.siblingIds?.length) return [];

    const siblings = await Promise.all(
      student.siblingIds.map(async (id) => {
        const sibling = await ctx.db.get(id);
        if (!sibling) return null;
        const open = await getCurrentPlacement(ctx, id);
        const [level, campus] = await Promise.all([
          open ? ctx.db.get(open.standardLevelId) : null,
          // No placement (leaver) or no campus (#93) — see `getStudentById`.
          open?.campus ? ctx.db.get(open.campus) : null,
        ]);
        return {
          _id: sibling._id,
          // `studentFullName`, `campusName` and `status` may be undefined for
          // imported records. They are returned as-is rather than filled with
          // an "Unknown" placeholder — the caller omits what it cannot show.
          studentFullName: sibling.studentFullName,
          studentNumber: sibling.studentNumber,
          standardLevelName: level?.name,
          campusName: campus?.name,
          status: sibling.status,
        };
      }),
    );

    return siblings.filter(Boolean);
  },
});

/**
 * Permanently delete a student and all related data (cascade delete).
 * Removes enrollments, grades, fees, transactions, discounts, advance payments,
 * report cards (including stored files), assessment answers, computed grades,
 * and stored photos. Also unlinks this student from any siblings.
 * Requires admin role.
 */
export const deleteStudent = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // Capture name before deletion for the audit log
    const studentName = student.studentFullName;

    // ── 1. Query all related records in parallel ────────────────────────
    const [
      enrollments,
      studentFees,
      feeTransactions,
      studentDiscounts,
      reportCards,
      assessmentAnswers,
      computedGrades,
    ] = await Promise.all([
      ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q.eq("studentId", args.studentId),
        )
        .collect(),
      ctx.db
        .query("studentFees")
        .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db
        .query("feeTransactions")
        .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db
        .query("studentDiscounts")
        .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db
        .query("reportCards")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db
        .query("studentAssessmentAnswers")
        .withIndex("by_student_assessment", (q) =>
          q.eq("studentId", args.studentId),
        )
        .collect(),
      ctx.db
        .query("computedGrades")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect(),
    ]);

    // ── 2. Delete all related records in parallel ───────────────────────
    await Promise.all([
      ...enrollments.map((doc) => ctx.db.delete(doc._id)),
      ...studentFees.map((doc) => ctx.db.delete(doc._id)),
      ...feeTransactions.map((doc) => ctx.db.delete(doc._id)),
      ...studentDiscounts.map((doc) => ctx.db.delete(doc._id)),
      ...assessmentAnswers.map((doc) => ctx.db.delete(doc._id)),
      ...computedGrades.map((doc) => ctx.db.delete(doc._id)),
    ]);

    // ── 3. Delete report card stored files, then the report card docs ───
    await Promise.all(
      reportCards.map(async (rc) => {
        await ctx.storage.delete(rc.fileUrl);
        await ctx.db.delete(rc._id);
      }),
    );

    // ── 4. Bidirectional sibling unlinking ──────────────────────────────
    if (student.siblingIds && student.siblingIds.length > 0) {
      await Promise.all(
        student.siblingIds.map(async (siblingId) => {
          const sibling = await ctx.db.get(siblingId);
          if (sibling?.siblingIds) {
            await ctx.db.patch(siblingId, {
              siblingIds: sibling.siblingIds.filter(
                (id) => id !== args.studentId,
              ),
            });
          }
        }),
      );
    }

    // ── 5. Delete stored student/parent photos ─────────────────────────
    const photoIds = [
      student.studentPhotoUrl,
      student.fatherPhotoUrl,
      student.motherPhotoUrl,
    ];
    await Promise.all(
      photoIds
        .filter((id): id is Id<"_storage"> => id !== undefined)
        .map((storageId) => ctx.storage.delete(storageId)),
    );

    // ── 6. Delete the student document ─────────────────────────────────
    await ctx.db.delete(args.studentId);

    await logAudit(ctx, {
      user,
      action: "delete",
      entityType: "students",
      entityId: args.studentId,
      description: `Deleted student ${studentName}`,
    });

    return args.studentId;
  },
});

/**
 * Update a student record with partial fields.
 * Handles bidirectional sibling re-linking when siblingIds changes.
 * `placement` (level + campus) amends the open enrollment in the same
 * transaction — ConvexError `NOT_PLACED` for a student with none.
 * Requires admin role.
 */
export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    studentFullName: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
    dateOfBirth: v.optional(v.float64()),
    placeOfBirth: v.optional(v.string()),
    citizenship: v.optional(v.string()),
    religion: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    birthCertificateNumber: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    passportValidTill: v.optional(v.float64()),
    placement: v.optional(
      v.object({
        standardLevelId: v.id("standardLevels"),
        campus: v.id("campuses"),
      }),
    ),
    presentAddress: v.optional(v.string()),
    permanentAddress: v.optional(v.string()),
    previousSchoolName: v.optional(v.string()),
    previousSchoolAddress: v.optional(v.string()),
    healthIssue: v.optional(
      v.object({
        hasHealthIssues: v.boolean(),
        issueDescription: v.optional(v.string()),
      }),
    ),
    studentPhotoUrl: v.optional(v.id("_storage")),
    fatherPhotoUrl: v.optional(v.id("_storage")),
    motherPhotoUrl: v.optional(v.id("_storage")),
    fatherName: v.optional(v.string()),
    fatherOccupation: v.optional(v.string()),
    fatherNidNumber: v.optional(v.string()),
    fatherPhoneNumber: v.optional(v.string()),
    motherName: v.optional(v.string()),
    motherOccupation: v.optional(v.string()),
    motherNidNumber: v.optional(v.string()),
    motherPhoneNumber: v.optional(v.string()),
    guardianName: v.optional(v.string()),
    guardianRelation: v.optional(v.string()),
    guardianNidNumber: v.optional(v.string()),
    guardianPhoneNumber: v.optional(v.string()),
    familyAnnualIncome: v.optional(v.string()),
    consultantName: v.optional(v.string()),
    siblingIds: v.optional(v.array(v.id("students"))),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // Extract studentId + placement, spread the rest as update fields
    const { studentId, placement, ...updateFields } = args;
    if (placement) await amend(ctx, studentId, placement);

    // ── Handle sibling re-linking if siblingIds changed ─────────────────
    if (args.siblingIds !== undefined) {
      const oldSiblingIds = student.siblingIds ?? [];
      const newSiblingIds = args.siblingIds;

      // Siblings removed — take this student out of their lists
      const removedSiblings = oldSiblingIds.filter(
        (id) => !newSiblingIds.includes(id),
      );
      // Siblings added — put this student into their lists
      const addedSiblings = newSiblingIds.filter(
        (id) => !oldSiblingIds.includes(id),
      );

      await Promise.all([
        ...removedSiblings.map(async (sibId) => {
          const sib = await ctx.db.get(sibId);
          if (sib?.siblingIds) {
            await ctx.db.patch(sibId, {
              siblingIds: sib.siblingIds.filter((id) => id !== studentId),
            });
          }
        }),
        ...addedSiblings.map(async (sibId) => {
          const sib = await ctx.db.get(sibId);
          if (sib) {
            const existing = sib.siblingIds ?? [];
            if (!existing.includes(studentId)) {
              await ctx.db.patch(sibId, {
                siblingIds: [...existing, studentId],
              });
            }
          }
        }),
      ]);
    }

    // Only patch with fields that were actually provided
    await ctx.db.patch(studentId, updateFields);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "students",
      entityId: studentId,
      description: `Updated student ${args.studentFullName ?? student.studentFullName}${placement ? " (class amended)" : ""}`,
      ...(placement ? { metadata: { placement } } : {}),
    });

    return studentId;
  },
});
