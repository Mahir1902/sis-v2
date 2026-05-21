import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

const paymentModeValidator = v.union(
  v.literal("Cash"),
  v.literal("Bank Transfer"),
  v.literal("Cheque"),
  v.literal("UPI"),
  v.literal("Online"),
);

/**
 * Returns a list of fee collection sessions for the given academic year,
 * enriched with student name/number and collector name.
 *
 * Supports optional filters: date range, campus, payment mode, student IDs,
 * and a toggle to include voided sessions. Defaults to completed only.
 */
export const getTransactionLog = query({
  args: {
    academicYearId: v.id("academicYears"),
    dateFrom: v.optional(v.float64()),
    dateTo: v.optional(v.float64()),
    campusFilter: v.optional(v.id("campuses")),
    paymentMode: v.optional(paymentModeValidator),
    studentIds: v.optional(v.array(v.id("students"))),
    includeVoided: v.optional(v.boolean()),
    standardLevelId: v.optional(v.id("standardLevels")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const rawSessions = await ctx.db
      .query("feeCollectionSessions")
      .withIndex("by_academic_year_date", (q) =>
        q.eq("academicYear", args.academicYearId),
      )
      .order("desc")
      .take(500);

    // ── Apply filters ─────────────────────────────────────────────────────
    let filtered = rawSessions;

    if (!args.includeVoided) {
      filtered = filtered.filter((s) => s.status === "completed");
    }

    if (args.dateFrom !== undefined) {
      const from = args.dateFrom;
      filtered = filtered.filter((s) => s.transactionDate >= from);
    }
    if (args.dateTo !== undefined) {
      const endOfDay = args.dateTo + 86400000 - 1;
      filtered = filtered.filter((s) => s.transactionDate <= endOfDay);
    }

    if (args.campusFilter) {
      filtered = filtered.filter((s) => s.campus === args.campusFilter);
    }

    if (args.paymentMode) {
      filtered = filtered.filter((s) => s.paymentMode === args.paymentMode);
    }

    if (args.studentIds && args.studentIds.length > 0) {
      const idSet = new Set(args.studentIds);
      filtered = filtered.filter((s) => idSet.has(s.studentId));
    }

    if (args.standardLevelId) {
      filtered = filtered.filter(
        (s) => s.standardLevelId === args.standardLevelId,
      );
    }

    // ── Batch-resolve campus IDs to names ────────────────────────────
    const campusIds = [
      ...new Set(
        filtered
          .map((s) => s.campus)
          .filter((c): c is NonNullable<typeof c> => c != null),
      ),
    ];
    const campusDocs = await Promise.all(campusIds.map((id) => ctx.db.get(id)));
    const campusNameMap = new Map<string, string>();
    for (const c of campusDocs) {
      if (c) campusNameMap.set(c._id, c.name);
    }

    // ── Compute aggregates from the filtered set ─────────────────────
    let totalAmount = 0;
    const byPaymentMode: Record<string, number> = {};
    const byCampus: Record<string, number> = {};

    for (const s of filtered) {
      totalAmount += s.totalAmount;
      byPaymentMode[s.paymentMode] =
        (byPaymentMode[s.paymentMode] ?? 0) + s.totalAmount;
      const campus = s.campus
        ? (campusNameMap.get(s.campus) ?? "Unknown")
        : "Unknown";
      byCampus[campus] = (byCampus[campus] ?? 0) + s.totalAmount;
    }

    const aggregates = {
      totalAmount,
      sessionCount: filtered.length,
      byPaymentMode,
      byCampus,
    };

    // ── Batch-enrich: collect unique IDs, then fetch all at once ───────
    const studentIds = [...new Set(filtered.map((s) => s.studentId))];
    const collectorIds = [...new Set(filtered.map((s) => s.collectedBy))];

    const [students, collectors] = await Promise.all([
      Promise.all(studentIds.map((id) => ctx.db.get(id))),
      Promise.all(collectorIds.map((id) => ctx.db.get(id))),
    ]);

    const studentMap = new Map<string, { name: string; number: string }>();
    for (const s of students) {
      if (s)
        studentMap.set(s._id, {
          name: s.studentFullName,
          number: s.studentNumber,
        });
    }

    const collectorMap = new Map<string, string>();
    for (const u of collectors) {
      if (u) collectorMap.set(u._id, u.name);
    }

    let standardLevelName: string | null = null;
    if (args.standardLevelId) {
      const level = await ctx.db.get(args.standardLevelId);
      standardLevelName = level?.name ?? null;
    }

    const sessions = filtered.map((session) => {
      const student = studentMap.get(session.studentId);
      return {
        _id: session._id,
        invoiceNumber: session.invoiceNumber,
        transactionDate: session.transactionDate,
        campus: session.campus
          ? (campusNameMap.get(session.campus) ?? null)
          : null,
        totalAmount: session.totalAmount,
        paymentMode: session.paymentMode,
        status: session.status,
        feeCount: session.feeCount,
        studentName: student?.name ?? "Unknown Student",
        studentNumber: student?.number ?? "—",
        collectedByName: collectorMap.get(session.collectedBy) ?? "Unknown",
      };
    });

    return { sessions, aggregates, standardLevelName };
  },
});

/**
 * Returns the full detail of a single fee collection session, including
 * enriched line items with fee structure names and billing periods.
 */
export const getSessionDetail = query({
  args: {
    sessionId: v.id("feeCollectionSessions"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    // Fetch line items (fee transactions for this session)
    const transactions = await ctx.db
      .query("feeTransactions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(50);

    // Batch-fetch student, collector, campus, and fee details
    const [student, collector, campusDoc] = await Promise.all([
      ctx.db.get(session.studentId),
      ctx.db.get(session.collectedBy),
      session.campus ? ctx.db.get(session.campus) : null,
    ]);

    // Two-hop fetch: feeTransactions → studentFees → feeStructure
    const feeIds = [...new Set(transactions.map((t) => t.feeId))];
    const studentFees = await Promise.all(feeIds.map((id) => ctx.db.get(id)));

    const structureIds = [
      ...new Set(
        studentFees
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => f.feeStructureId),
      ),
    ];
    const structures = await Promise.all(
      structureIds.map((id) => ctx.db.get(id)),
    );

    // Build lookup maps
    const feeMap = new Map<string, string>();
    for (const f of studentFees) {
      if (f) feeMap.set(f._id, f.feeStructureId);
    }

    const structureMap = new Map<string, string>();
    for (const s of structures) {
      if (s) structureMap.set(s._id, s.name);
    }

    const billingPeriodMap = new Map<string, string | undefined>();
    for (const f of studentFees) {
      if (f) billingPeriodMap.set(f._id, f.billingPeriod);
    }

    const lineItems = transactions.map((txn) => {
      const structureId = feeMap.get(txn.feeId);
      return {
        _id: txn._id,
        amount: txn.amount,
        feeStructureName: structureId
          ? (structureMap.get(structureId) ?? "Unknown Fee")
          : "Unknown Fee",
        billingPeriod: billingPeriodMap.get(txn.feeId) ?? undefined,
        referenceNumber: txn.referenceNumber ?? undefined,
      };
    });

    return {
      session: {
        _id: session._id,
        invoiceNumber: session.invoiceNumber,
        transactionDate: session.transactionDate,
        campus: campusDoc?.name ?? null,
        totalAmount: session.totalAmount,
        paymentMode: session.paymentMode,
        status: session.status,
        feeCount: session.feeCount,
        remarks: session.remarks ?? null,
        studentName: student?.studentFullName ?? "Unknown Student",
        studentNumber: student?.studentNumber ?? "—",
        collectedByName: collector?.name ?? "Unknown",
      },
      lineItems,
    };
  },
});

/**
 * Returns a flat list of fee line items for CSV export.
 * Each row represents a single feeTransaction, enriched with session-level
 * fields (invoice, student, payment mode) and fee-level fields (fee name,
 * billing period). Accepts the same filters as getTransactionLog.
 */
export const getTransactionLogExport = query({
  args: {
    academicYearId: v.id("academicYears"),
    dateFrom: v.optional(v.float64()),
    dateTo: v.optional(v.float64()),
    campusFilter: v.optional(v.id("campuses")),
    paymentMode: v.optional(paymentModeValidator),
    studentIds: v.optional(v.array(v.id("students"))),
    includeVoided: v.optional(v.boolean()),
    standardLevelId: v.optional(v.id("standardLevels")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const rawSessions = await ctx.db
      .query("feeCollectionSessions")
      .withIndex("by_academic_year_date", (q) =>
        q.eq("academicYear", args.academicYearId),
      )
      .order("desc")
      .take(500);

    let filtered = rawSessions;

    if (!args.includeVoided) {
      filtered = filtered.filter((s) => s.status === "completed");
    }
    if (args.dateFrom !== undefined) {
      const from = args.dateFrom;
      filtered = filtered.filter((s) => s.transactionDate >= from);
    }
    if (args.dateTo !== undefined) {
      const endOfDay = args.dateTo + 86400000 - 1;
      filtered = filtered.filter((s) => s.transactionDate <= endOfDay);
    }
    if (args.campusFilter) {
      filtered = filtered.filter((s) => s.campus === args.campusFilter);
    }
    if (args.paymentMode) {
      filtered = filtered.filter((s) => s.paymentMode === args.paymentMode);
    }
    if (args.studentIds && args.studentIds.length > 0) {
      const idSet = new Set(args.studentIds);
      filtered = filtered.filter((s) => idSet.has(s.studentId));
    }
    if (args.standardLevelId) {
      filtered = filtered.filter(
        (s) => s.standardLevelId === args.standardLevelId,
      );
    }

    // Batch-resolve campus IDs to names
    const campusIds = [
      ...new Set(
        filtered
          .map((s) => s.campus)
          .filter((c): c is NonNullable<typeof c> => c != null),
      ),
    ];
    const campusDocs = await Promise.all(campusIds.map((id) => ctx.db.get(id)));
    const campusNameMap = new Map<string, string>();
    for (const c of campusDocs) {
      if (c) campusNameMap.set(c._id, c.name);
    }

    // Batch-enrich students and collectors
    const studentIds = [...new Set(filtered.map((s) => s.studentId))];
    const collectorIds = [...new Set(filtered.map((s) => s.collectedBy))];

    const [students, collectors] = await Promise.all([
      Promise.all(studentIds.map((id) => ctx.db.get(id))),
      Promise.all(collectorIds.map((id) => ctx.db.get(id))),
    ]);

    const studentMap = new Map<string, { name: string; number: string }>();
    for (const s of students) {
      if (s)
        studentMap.set(s._id, {
          name: s.studentFullName,
          number: s.studentNumber,
        });
    }

    const collectorMap = new Map<string, string>();
    for (const u of collectors) {
      if (u) collectorMap.set(u._id, u.name);
    }

    // Fetch all feeTransactions for filtered sessions in parallel
    const sessionTransactions = await Promise.all(
      filtered.map((session) =>
        ctx.db
          .query("feeTransactions")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .take(50),
      ),
    );

    // Collect all unique feeIds across all transactions
    const allTransactions = sessionTransactions.flat();
    const feeIds = [...new Set(allTransactions.map((t) => t.feeId))];

    // Two-hop batch: feeTransactions → studentFees → feeStructure
    const studentFees = await Promise.all(feeIds.map((id) => ctx.db.get(id)));

    const structureIds = [
      ...new Set(
        studentFees
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => f.feeStructureId),
      ),
    ];
    const structures = await Promise.all(
      structureIds.map((id) => ctx.db.get(id)),
    );

    const feeToStructureId = new Map<string, string>();
    const feeToBillingPeriod = new Map<string, string | undefined>();
    for (const f of studentFees) {
      if (f) {
        feeToStructureId.set(f._id, f.feeStructureId);
        feeToBillingPeriod.set(f._id, f.billingPeriod);
      }
    }

    const structureNameMap = new Map<string, string>();
    for (const s of structures) {
      if (s) structureNameMap.set(s._id, s.name);
    }

    // Flatten: one row per line item, with session-level fields repeated
    const rows = filtered.flatMap((session, i) => {
      const student = studentMap.get(session.studentId);
      const txns = sessionTransactions[i];

      return txns.map((txn) => {
        const structureId = feeToStructureId.get(txn.feeId);
        return {
          transactionDate: session.transactionDate,
          invoiceNumber: session.invoiceNumber,
          studentName: student?.name ?? "Unknown Student",
          studentNumber: student?.number ?? "—",
          campus: session.campus
            ? (campusNameMap.get(session.campus) ?? null)
            : null,
          feeName: structureId
            ? (structureNameMap.get(structureId) ?? "Unknown Fee")
            : "Unknown Fee",
          billingPeriod: feeToBillingPeriod.get(txn.feeId) ?? null,
          amount: txn.amount,
          paymentMode: session.paymentMode,
          status: session.status,
          collectedByName: collectorMap.get(session.collectedBy) ?? "Unknown",
        };
      });
    });

    return { rows };
  },
});

/**
 * Searches students by name for the transaction log filter bar.
 * Returns up to 20 matching students with their ID, name, and admission number.
 */
export const searchStudents = query({
  args: {
    nameQuery: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    if (args.nameQuery.trim().length === 0) {
      return [];
    }

    const allStudents = await ctx.db.query("students").take(2000);
    const query = args.nameQuery.toLowerCase();

    return allStudents
      .filter((s) => s.studentFullName.toLowerCase().includes(query))
      .slice(0, 20)
      .map((s) => ({
        _id: s._id,
        studentFullName: s.studentFullName,
        studentNumber: s.studentNumber,
      }));
  },
});
