import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

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
 * Create a new student record.
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
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const studentId = await ctx.db.insert("students", {
      ...args,
      status: "active",
      admissionDate: Date.now(),
      createdAt: new Date().toISOString(),
    });

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

    return studentId;
  },
});

/**
 * Get all students with optional server-side filters.
 * Pre-fetches lookup tables to avoid N+1 reads.
 * Returns a slim projection for the list view.
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

    // Build query with server-side filters
    let q = ctx.db.query("students");

    // Guard: only apply filter if array is non-empty (qb.or() with 0 args is undefined)
    if (args.standardLevel && args.standardLevel.length > 0) {
      const levels = args.standardLevel;
      q = q.filter((qb) =>
        qb.or(...levels.map((id) => qb.eq(qb.field("standardLevel"), id))),
      );
    }
    if (args.academicYear && args.academicYear.length > 0) {
      const years = args.academicYear;
      q = q.filter((qb) =>
        qb.or(...years.map((id) => qb.eq(qb.field("academicYear"), id))),
      );
    }
    if (args.gender && args.gender.length > 0) {
      const genders = args.gender;
      q = q.filter((qb) =>
        qb.or(...genders.map((g) => qb.eq(qb.field("gender"), g))),
      );
    }
    if (args.status && args.status.length > 0) {
      const statuses = args.status;
      q = q.filter((qb) =>
        qb.or(...statuses.map((s) => qb.eq(qb.field("status"), s))),
      );
    }

    const students = await q.take(2000);

    // Resolve photo URLs + return slim projection
    const enriched = await Promise.all(
      students.map(async (s) => ({
        _id: s._id,
        studentNumber: s.studentNumber,
        studentFullName: s.studentFullName,
        studentPhotoUrl: s.studentPhotoUrl
          ? await ctx.storage.getUrl(s.studentPhotoUrl)
          : null,
        standardLevel: s.standardLevel,
        academicYear: s.academicYear,
        standardLevelName: levelMap.get(s.standardLevel) ?? "Unknown",
        academicYearName: yearMap.get(s.academicYear) ?? "Unknown",
        gender: s.gender,
        classStartDate: s.classStartDate,
        status: s.status,
      })),
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

    const student = await ctx.db.get(args.studentId);
    if (!student) return null;

    const [
      standardLevel,
      academicYear,
      campus,
      studentPhoto,
      fatherPhoto,
      motherPhoto,
    ] = await Promise.all([
      ctx.db.get(student.standardLevel),
      ctx.db.get(student.academicYear),
      ctx.db.get(student.campus),
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
 * Update a student's status. Validates the status is a valid value.
 */
export const updateStudentStatus = mutation({
  args: {
    studentId: v.id("students"),
    status: v.union(
      v.literal("active"),
      v.literal("graduated"),
      v.literal("transferred"),
      v.literal("withdrawn"),
      v.literal("suspended"),
      v.literal("expelled"),
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    await ctx.db.patch(args.studentId, { status: args.status });
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
        const [level, campus] = await Promise.all([
          ctx.db.get(sibling.standardLevel),
          ctx.db.get(sibling.campus),
        ]);
        return {
          _id: sibling._id,
          studentFullName: sibling.studentFullName,
          studentNumber: sibling.studentNumber,
          standardLevelName: level?.name ?? "Unknown",
          campusName: campus?.name ?? "Unknown",
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
    await requireRole(ctx, ["admin"]);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // ── 1. Query all related records in parallel ────────────────────────
    const [
      enrollments,
      grades,
      studentFees,
      feeTransactions,
      studentDiscounts,
      advancePayments,
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
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
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
        .query("advancePayments")
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
      ...grades.map((doc) => ctx.db.delete(doc._id)),
      ...studentFees.map((doc) => ctx.db.delete(doc._id)),
      ...feeTransactions.map((doc) => ctx.db.delete(doc._id)),
      ...studentDiscounts.map((doc) => ctx.db.delete(doc._id)),
      ...advancePayments.map((doc) => ctx.db.delete(doc._id)),
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

    return args.studentId;
  },
});

/**
 * Update a student record with partial fields.
 * Handles bidirectional sibling re-linking when siblingIds changes.
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
    standardLevel: v.optional(v.id("standardLevels")),
    academicYear: v.optional(v.id("academicYears")),
    campus: v.optional(v.id("campuses")),
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
    await requireRole(ctx, ["admin"]);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // Extract studentId, spread the rest as update fields
    const { studentId, ...updateFields } = args;

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

    return studentId;
  },
});
