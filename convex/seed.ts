import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const ADMIN_EMAIL = "admin@school.edu";

export const checkAdminExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", ADMIN_EMAIL))
      .first();
    return user !== null;
  },
});

export const insertAdminRecords = internalMutation({
  args: { hashedPassword: v.string() },
  handler: async (ctx, { hashedPassword }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", ADMIN_EMAIL))
      .first();
    if (existing !== null) return { status: "already_exists" as const };

    const userId = await ctx.db.insert("users", {
      name: "Admin",
      email: ADMIN_EMAIL,
      role: "admin",
      isActive: true,
    });

    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: ADMIN_EMAIL,
      secret: hashedPassword,
    });

    return { status: "created" as const };
  },
});

/**
 * Seeds all reference data (academic years, campuses, standard levels,
 * grade mapping, subjects, discount rules).
 * Idempotent — safe to run multiple times.
 */
export const seedReferenceData = mutation({
  args: {},
  handler: async (ctx) => {
    // Guard: skip if already seeded
    const existingYears = await ctx.db.query("academicYears").take(1);
    if (existingYears.length > 0) {
      return { status: "already_seeded" };
    }

    // ── Academic Years (2019-2020 through 2025-2026) ──────────────────────
    const yearDefs = [
      { name: "2019-2020", start: 2019, end: 2020 },
      { name: "2020-2021", start: 2020, end: 2021 },
      { name: "2021-2022", start: 2021, end: 2022 },
      { name: "2022-2023", start: 2022, end: 2023 },
      { name: "2023-2024", start: 2023, end: 2024 },
      { name: "2024-2025", start: 2024, end: 2025 },
      { name: "2025-2026", start: 2025, end: 2026 },
    ];
    for (const y of yearDefs) {
      await ctx.db.insert("academicYears", {
        name: y.name,
        startDate: new Date(`${y.start}-06-01`).getTime(),
        endDate: new Date(`${y.end}-07-31`).getTime(),
      });
    }

    // ── Campuses ──────────────────────────────────────────────────────────
    await ctx.db.insert("campuses", { name: "Main Campus", address: "123 Education Street" });
    await ctx.db.insert("campuses", { name: "East Campus", address: "456 East Avenue" });
    await ctx.db.insert("campuses", { name: "West Campus", address: "789 West Boulevard" });

    // ── Standard Levels ───────────────────────────────────────────────────
    const levelDefs = [
      { name: "Play Group", code: "PG" },
      { name: "Nursery", code: "NUR" },
      { name: "KG-1", code: "KG1" },
      { name: "KG-2", code: "KG2" },
      { name: "Grade 1", code: "01" },
      { name: "Grade 2", code: "02" },
      { name: "Grade 3", code: "03" },
      { name: "Grade 4", code: "04" },
      { name: "Grade 5", code: "05" },
      { name: "Grade 6", code: "06" },
      { name: "Grade 7", code: "07" },
      { name: "Grade 8", code: "08" },
      { name: "Grade 9", code: "09" },
      { name: "Grade 10", code: "10" },
      { name: "Grade 11", code: "11" },
      { name: "Grade 12", code: "12" },
    ];
    const levelIds: Promise<Id<"standardLevels">>[] = [];
    for (const l of levelDefs) {
      levelIds.push(ctx.db.insert("standardLevels", { name: l.name, code: l.code }));
    }
    const insertedIds = await Promise.all(levelIds);
    // Set nextLevelId chain
    for (let i = 0; i < insertedIds.length - 1; i++) {
      await ctx.db.patch(insertedIds[i], { nextLevelId: insertedIds[i + 1] });
    }

    // ── Grade Mapping ─────────────────────────────────────────────────────
    const gradeMappings = [
      { letterGrade: "A+", minPercentage: 90, maxPercentage: 100, order: 1, description: "Outstanding" },
      { letterGrade: "A", minPercentage: 80, maxPercentage: 89, order: 2, description: "Excellent" },
      { letterGrade: "B", minPercentage: 70, maxPercentage: 79, order: 3, description: "Good" },
      { letterGrade: "C", minPercentage: 60, maxPercentage: 69, order: 4, description: "Satisfactory" },
      { letterGrade: "D", minPercentage: 50, maxPercentage: 59, order: 5, description: "Pass" },
      { letterGrade: "F", minPercentage: 0, maxPercentage: 49, order: 6, description: "Fail" },
    ];
    for (const g of gradeMappings) {
      await ctx.db.insert("gradeMapping", { ...g, isActive: true });
    }

    // ── Subjects ──────────────────────────────────────────────────────────
    const subjectDefs = [
      // Early childhood (PG/NUR/KG)
      { name: "English", code: "ENG", displayOrder: 1 },
      { name: "Mathematics", code: "MATH", displayOrder: 2 },
      { name: "Drawing", code: "DRAW", displayOrder: 3 },
      { name: "General Knowledge", code: "GK", displayOrder: 4 },
      // Elementary (Gr 1-5)
      { name: "Science", code: "SCI", displayOrder: 5 },
      { name: "Social Studies", code: "SS", displayOrder: 6 },
      { name: "Physical Education", code: "PE", displayOrder: 7 },
      // Middle / High school
      { name: "Computer Science", code: "CS", displayOrder: 8 },
      { name: "Physics", code: "PHY", displayOrder: 9 },
      { name: "Chemistry", code: "CHEM", displayOrder: 10 },
      { name: "Biology", code: "BIO", displayOrder: 11 },
      { name: "Advanced Mathematics", code: "AMATH", displayOrder: 12 },
    ];
    for (const s of subjectDefs) {
      await ctx.db.insert("subjects", { ...s, isActive: true });
    }

    // ── Discount Rules ────────────────────────────────────────────────────
    const discountDefs: Array<{
      name: string;
      discountType: "percentage" | "fixed";
      amount: number;
      description: string;
      maxDiscountAmount?: number;
    }> = [
      { name: "Sibling Discount", discountType: "percentage", amount: 10, description: "10% discount for siblings" },
      { name: "Early Admission Discount", discountType: "percentage", amount: 5, description: "5% discount for early admission" },
      { name: "Merit Scholarship", discountType: "percentage", amount: 15, maxDiscountAmount: 5000, description: "15% merit scholarship, max 5000" },
      { name: "Staff Child Discount", discountType: "percentage", amount: 25, description: "25% discount for staff children" },
    ];
    for (const d of discountDefs) {
      await ctx.db.insert("discountRules", { ...d, isActive: true });
    }

    return { status: "seeded" };
  },
});
