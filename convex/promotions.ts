import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";
import { changeStatus, moveToNextYear } from "./lib/placement";

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

    // Open enrollments for this level, filtered to the selected year.
    // Uses existing by_standard_level index; year + open filtered in .filter().
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_standard_level", (q) =>
        q.eq("standardLevelId", args.standardLevelId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("academicYear"), args.academicYearId),
          q.eq(q.field("exitDate"), undefined),
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
 * For each student, via the Placement module: promote / hold back run the
 * "already enrolled in the target year" guard first and only then close the
 * source and open the new enrollment — a skipped student keeps their class.
 * Graduate is the leave operation (status + close, one transaction).
 * Optionally auto-assigns fee structures for the target academic year.
 * Logs one audit entry per student inside the loop (not one for the whole batch).
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
    const user = await requireRole(ctx, ["admin"]);

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

      // Verify the enrollment is the claimed student's, in the source class
      // (hold-back writes `args.standardLevelId` as the target level).
      if (
        enrollment.studentId !== item.studentId ||
        enrollment.academicYear !== args.sourceAcademicYearId ||
        enrollment.standardLevelId !== args.standardLevelId
      ) {
        skipped++;
        continue;
      }

      // Look up student name for audit log descriptions
      const student = await ctx.db.get(item.studentId);
      const studentName = student?.studentFullName ?? "Unknown";

      switch (item.action) {
        case "promote": {
          if (!nextLevel) {
            skipped++;
            break;
          }

          const moved = await moveToNextYear(ctx, enrollment, {
            academicYear: args.targetAcademicYearId,
            standardLevelId: nextLevel._id,
            kind: "promotion",
          });
          if (!moved) {
            skipped++;
            break;
          }

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

          await logAudit(ctx, {
            user,
            action: "promote",
            entityType: "students",
            entityId: item.studentId,
            description: `Promoted student ${studentName}`,
          });

          promoted++;
          break;
        }

        case "graduate": {
          if (!student) {
            skipped++;
            break;
          }
          // The leave operation: status + close the open enrollment.
          await changeStatus(ctx, student, "graduated");

          await logAudit(ctx, {
            user,
            action: "promote",
            entityType: "students",
            entityId: item.studentId,
            description: `Graduated student ${studentName}`,
          });

          graduated++;
          break;
        }

        case "hold_back": {
          // Same level, target year.
          const moved = await moveToNextYear(ctx, enrollment, {
            academicYear: args.targetAcademicYearId,
            standardLevelId: args.standardLevelId,
            kind: "hold_back",
          });
          if (!moved) {
            skipped++;
            break;
          }

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

          await logAudit(ctx, {
            user,
            action: "promote",
            entityType: "students",
            entityId: item.studentId,
            description: `Held back student ${studentName}`,
          });

          heldBack++;
          break;
        }
      }
    }

    return { promoted, graduated, heldBack, feesAssigned, skipped };
  },
});
