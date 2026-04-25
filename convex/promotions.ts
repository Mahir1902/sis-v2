import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/**
 * Returns promotion-eligible students for a given standard level and academic year.
 * Fetches active enrollments, enriches each with student info and next-level metadata,
 * and flags graduation candidates (no nextLevelId on current level).
 * Requires admin role.
 */
export const getPromotionCandidates = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    // Fetch current level and resolve next level if it exists
    const currentLevel = await ctx.db.get(args.standardLevelId);
    if (!currentLevel) {
      throw new Error("Selected level not found");
    }

    const nextLevel = currentLevel.nextLevelId
      ? await ctx.db.get(currentLevel.nextLevelId)
      : null;

    // Query active enrollments for this level, filtered to the selected year.
    // Uses existing by_standard_level index; year + status filtered in .filter().
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_standard_level", (q) =>
        q.eq("standardLevelId", args.standardLevelId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("academicYear"), args.academicYearId),
          q.eq(q.field("status"), "active"),
        ),
      )
      .take(200);

    // Batch-enrich each enrollment with student data (no N+1 — Promise.all)
    const candidates = await Promise.all(
      enrollments.map(async (enrollment) => {
        const student = await ctx.db.get(enrollment.studentId);
        if (!student) return null;

        // Resolve student photo storage ID to a URL
        const photoUrl = student.studentPhotoUrl
          ? await ctx.storage.getUrl(student.studentPhotoUrl)
          : null;

        // Detect if student was already promoted (their current academicYear
        // on the student record differs from the source year we're querying)
        const alreadyPromoted = student.academicYear !== args.academicYearId;

        return {
          enrollmentId: enrollment._id,
          studentId: student._id,
          studentName: student.studentFullName,
          studentNumber: student.studentNumber,
          studentPhotoUrl: photoUrl,
          currentLevelName: currentLevel.name,
          currentLevelCode: currentLevel.code,
          nextLevelId: currentLevel.nextLevelId ?? null,
          nextLevelName: nextLevel?.name ?? null,
          nextLevelCode: nextLevel?.code ?? null,
          isGraduationCandidate: !currentLevel.nextLevelId,
          alreadyPromoted,
          campus: enrollment.campus,
        };
      }),
    );

    // Filter out any null entries (deleted students)
    return candidates.filter(Boolean);
  },
});

/**
 * Processes a batch of student promotions, graduations, and hold-backs.
 * For each student: closes the source enrollment, creates a new enrollment
 * (if not graduating), and patches the student record. Optionally auto-assigns
 * fee structures for the target academic year.
 * Requires admin role.
 */
export const bulkPromote = mutation({
  args: {
    sourceAcademicYearId: v.id("academicYears"),
    targetAcademicYearId: v.id("academicYears"),
    standardLevelId: v.id("standardLevels"),
    promotions: v.array(
      v.object({
        studentId: v.id("students"),
        enrollmentId: v.id("enrollments"),
        action: v.union(
          v.literal("promote"),
          v.literal("hold_back"),
          v.literal("graduate"),
        ),
      }),
    ),
    autoAssignFees: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    // ── Validation ─────────────────────────────────────────────────────
    if (args.sourceAcademicYearId === args.targetAcademicYearId) {
      throw new Error("Source and target academic years must be different");
    }

    const [sourceYear, targetYear] = await Promise.all([
      ctx.db.get(args.sourceAcademicYearId),
      ctx.db.get(args.targetAcademicYearId),
    ]);
    if (!sourceYear || !targetYear) {
      throw new Error("One or both academic years not found");
    }

    if (args.promotions.length === 0) {
      throw new Error("No students selected for promotion");
    }

    // ── Pre-fetch level data (once, outside loop) ──────────────────────
    const currentLevel = await ctx.db.get(args.standardLevelId);
    if (!currentLevel) {
      throw new Error("Selected level not found");
    }

    const nextLevel = currentLevel.nextLevelId
      ? await ctx.db.get(currentLevel.nextLevelId)
      : null;

    // Validate: no "promote" action when there is no next level
    const hasPromoteAction = args.promotions.some(
      (p) => p.action === "promote",
    );
    if (hasPromoteAction && !nextLevel) {
      throw new Error(
        "Cannot promote students from the highest level. Use graduate instead.",
      );
    }

    // ── Pre-fetch fee structures if auto-assign is enabled ─────────────
    // Promoted students get fees for the next level; held-back get fees
    // for the current level. Fetch both sets once, outside the loop.

    // Always query current level fees (needed for hold-backs)
    const allCurrentLevelFees = args.autoAssignFees
      ? await ctx.db
          .query("feeStructure")
          .withIndex("by_standard", (q) =>
            q.eq("standardLevel", args.standardLevelId),
          )
          .take(50)
      : [];

    // Query next level fees only if there is a next level
    const allNextLevelFees =
      args.autoAssignFees && nextLevel
        ? await ctx.db
            .query("feeStructure")
            .withIndex("by_standard", (q) =>
              q.eq("standardLevel", nextLevel._id),
            )
            .take(50)
        : [];

    // Only active fee structures
    const nextLevelFees = allNextLevelFees.filter(
      (fs) => fs.isActive !== false,
    );
    const currentLevelFees = allCurrentLevelFees.filter(
      (fs) => fs.isActive !== false,
    );

    // ── Process each promotion action ──────────────────────────────────
    let promoted = 0;
    let graduated = 0;
    let heldBack = 0;
    let feesAssigned = 0;
    let skipped = 0;

    for (const item of args.promotions) {
      const enrollment = await ctx.db.get(item.enrollmentId);
      if (!enrollment) {
        skipped++;
        continue;
      }

      // Skip already-completed enrollments (idempotency guard)
      // Uses exitDate convention per codebase standard (enrollments.ts:getCurrentEnrollment)
      if (enrollment.exitDate !== undefined) {
        skipped++;
        continue;
      }

      // Verify enrollment belongs to the claimed student
      if (enrollment.studentId !== item.studentId) {
        skipped++;
        continue;
      }

      switch (item.action) {
        case "promote": {
          if (!nextLevel) {
            skipped++;
            break;
          }

          // Close old enrollment
          await ctx.db.patch(item.enrollmentId, {
            status: "completed",
            exitDate: Date.now(),
            exitReason: "promotion",
          });

          // Guard: skip if student already has an enrollment in the target year
          const existingPromoteEnrollment = await ctx.db
            .query("enrollments")
            .withIndex("by_student_academic_year", (q) =>
              q
                .eq("studentId", item.studentId)
                .eq("academicYear", args.targetAcademicYearId),
            )
            .first();
          if (existingPromoteEnrollment) {
            skipped++;
            break;
          }

          // Create new enrollment at next level
          await ctx.db.insert("enrollments", {
            studentId: item.studentId,
            academicYear: args.targetAcademicYearId,
            standardLevelId: nextLevel._id,
            campus: enrollment.campus,
            enrollmentType: "promotion",
            enrollmentDate: Date.now(),
            status: "active",
            previousEnrollmentId: item.enrollmentId,
          });

          // Update student record to reflect new placement
          await ctx.db.patch(item.studentId, {
            standardLevel: nextLevel._id,
            academicYear: args.targetAcademicYearId,
          });

          // Auto-assign fees for the next level (with duplicate guard)
          if (args.autoAssignFees && nextLevelFees.length > 0) {
            const existingFees = await ctx.db
              .query("studentFees")
              .withIndex("by_student_year", (q) =>
                q
                  .eq("studentId", item.studentId)
                  .eq("academicYear", args.targetAcademicYearId),
              )
              .take(50);
            const existingFeeStructureIds = new Set(
              existingFees.map((f) => f.feeStructureId),
            );

            for (const structure of nextLevelFees) {
              if (existingFeeStructureIds.has(structure._id)) continue;
              await ctx.db.insert("studentFees", {
                studentId: item.studentId,
                feeStructureId: structure._id,
                academicYear: args.targetAcademicYearId,
                dueDate: structure.dueDate ?? Date.now(),
                originalAmount: structure.baseAmount,
                paidAmount: 0,
                balance: structure.baseAmount,
                status: "unpaid",
                appliedDiscounts: [],
                paymentDetails: [],
              });
              feesAssigned++;
            }
          }

          promoted++;
          break;
        }

        case "graduate": {
          // Close enrollment as graduated
          await ctx.db.patch(item.enrollmentId, {
            status: "completed",
            exitDate: Date.now(),
            exitReason: "graduated",
          });

          // Mark student as graduated — no new enrollment created
          await ctx.db.patch(item.studentId, {
            status: "graduated",
          });

          graduated++;
          break;
        }

        case "hold_back": {
          // Close old enrollment
          await ctx.db.patch(item.enrollmentId, {
            status: "completed",
            exitDate: Date.now(),
            exitReason: "hold_back",
          });

          // Guard: skip if student already has an enrollment in the target year
          const existingHoldBackEnrollment = await ctx.db
            .query("enrollments")
            .withIndex("by_student_academic_year", (q) =>
              q
                .eq("studentId", item.studentId)
                .eq("academicYear", args.targetAcademicYearId),
            )
            .first();
          if (existingHoldBackEnrollment) {
            skipped++;
            break;
          }

          // Create new enrollment at the SAME level for the target year
          await ctx.db.insert("enrollments", {
            studentId: item.studentId,
            academicYear: args.targetAcademicYearId,
            standardLevelId: args.standardLevelId,
            campus: enrollment.campus,
            enrollmentType: "repeat",
            enrollmentDate: Date.now(),
            status: "active",
            previousEnrollmentId: item.enrollmentId,
          });

          // Update student to target year but keep same level
          await ctx.db.patch(item.studentId, {
            academicYear: args.targetAcademicYearId,
          });

          // Auto-assign fees for the current level (repeating, with duplicate guard)
          if (args.autoAssignFees && currentLevelFees.length > 0) {
            const existingHoldBackFees = await ctx.db
              .query("studentFees")
              .withIndex("by_student_year", (q) =>
                q
                  .eq("studentId", item.studentId)
                  .eq("academicYear", args.targetAcademicYearId),
              )
              .take(50);
            const existingHoldBackFeeIds = new Set(
              existingHoldBackFees.map((f) => f.feeStructureId),
            );

            for (const structure of currentLevelFees) {
              if (existingHoldBackFeeIds.has(structure._id)) continue;
              await ctx.db.insert("studentFees", {
                studentId: item.studentId,
                feeStructureId: structure._id,
                academicYear: args.targetAcademicYearId,
                dueDate: structure.dueDate ?? Date.now(),
                originalAmount: structure.baseAmount,
                paidAmount: 0,
                balance: structure.baseAmount,
                status: "unpaid",
                appliedDiscounts: [],
                paymentDetails: [],
              });
              feesAssigned++;
            }
          }

          heldBack++;
          break;
        }
      }
    }

    return { promoted, graduated, heldBack, feesAssigned, skipped };
  },
});
