import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";
import { paginationOptsValidator } from "convex/server";

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
 * Get all students with pagination. Resolves photo URLs and refs.
 * Use paginationOpts from usePaginatedQuery on the client.
 */
export const getAllStudents = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);

    const result = await ctx.db
      .query("students")
      .paginate(args.paginationOpts);

    const enriched = await Promise.all(
      result.page.map(async (student) => {
        const [standardLevel, academicYear, campus, photoUrl] =
          await Promise.all([
            ctx.db.get(student.standardLevel),
            ctx.db.get(student.academicYear),
            ctx.db.get(student.campus),
            student.studentPhotoUrl
              ? ctx.storage.getUrl(student.studentPhotoUrl)
              : null,
          ]);
        return {
          ...student,
          studentPhotoUrl: photoUrl,
          standardLevelName: standardLevel?.name ?? "Unknown",
          academicYearName: academicYear?.name ?? "Unknown",
          campusName: campus?.name ?? "Unknown",
        };
      })
    );

    return { ...result, page: enriched };
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

    const [standardLevel, academicYear, campus, studentPhoto, fatherPhoto, motherPhoto] =
      await Promise.all([
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
      v.literal("expelled")
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
      })
    );

    return siblings.filter(Boolean);
  },
});
