import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

const paymentModeValidator = v.union(
  v.literal("Cash"),
  v.literal("Bank Transfer"),
  v.literal("Cheque"),
  v.literal("UPI"),
  v.literal("Online"),
);

/** Filters shared by the list, the totals and the export. */
const sessionFilterArgs = {
  academicYearId: v.id("academicYears"),
  dateFrom: v.optional(v.float64()),
  dateTo: v.optional(v.float64()),
  campusFilter: v.optional(v.id("campuses")),
  paymentMode: v.optional(paymentModeValidator),
  studentIds: v.optional(v.array(v.id("students"))),
  includeVoided: v.optional(v.boolean()),
  standardLevelId: v.optional(v.id("standardLevels")),
};

type SessionFilterArgs = {
  academicYearId: Id<"academicYears">;
  dateFrom?: number;
  dateTo?: number;
  campusFilter?: Id<"campuses">;
  paymentMode?: Doc<"feeCollectionSessions">["paymentMode"];
  studentIds?: Id<"students">[];
  includeVoided?: boolean;
  standardLevelId?: Id<"standardLevels">;
};

type Session = Doc<"feeCollectionSessions">;

/**
 * Year + date range go to the `by_academic_year_date` index so storage, not
 * JS, decides how many rows are read. Everything else is applied by
 * `matchesFilters` over that range — never over a fixed-size prefix of it.
 */
function sessionRange(ctx: QueryCtx, args: SessionFilterArgs) {
  return ctx.db
    .query("feeCollectionSessions")
    .withIndex("by_academic_year_date", (q) => {
      const byYear = q.eq("academicYear", args.academicYearId);
      const from =
        args.dateFrom !== undefined
          ? byYear.gte("transactionDate", args.dateFrom)
          : byYear;
      return args.dateTo !== undefined
        ? from.lte("transactionDate", args.dateTo + 86400000 - 1)
        : from;
    })
    .order("desc");
}

function matchesFilters(s: Session, args: SessionFilterArgs): boolean {
  if (!args.includeVoided && s.status !== "completed") return false;
  if (args.campusFilter && s.campus !== args.campusFilter) return false;
  if (args.paymentMode && s.paymentMode !== args.paymentMode) return false;
  if (args.standardLevelId && s.standardLevelId !== args.standardLevelId)
    return false;
  if (
    args.studentIds &&
    args.studentIds.length > 0 &&
    !args.studentIds.includes(s.studentId)
  )
    return false;
  return true;
}

/**
 * Exact totals over every session matching the filters.
 *
 * Streams the indexed range and never caps: an undercounted finance total is
 * worse than a slow one.
 * ponytail: full range read on a live subscription; the ceiling is Convex's
 * per-query read limit (loud error, not a silent drop). If a year outgrows
 * it, move the sums to `@convex-dev/aggregate` keyed by (year, date).
 */
export const getTransactionLogTotals = query({
  args: sessionFilterArgs,
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    let totalAmount = 0;
    let sessionCount = 0;
    const byPaymentMode: Record<string, number> = {};
    const byCampusId = new Map<string, number>();

    for await (const s of sessionRange(ctx, args)) {
      if (!matchesFilters(s, args)) continue;
      sessionCount += 1;
      totalAmount += s.totalAmount;
      byPaymentMode[s.paymentMode] =
        (byPaymentMode[s.paymentMode] ?? 0) + s.totalAmount;
      const key = s.campus ?? "";
      byCampusId.set(key, (byCampusId.get(key) ?? 0) + s.totalAmount);
    }

    const campusIds = [...byCampusId.keys()].filter((k) => k !== "");
    const campusDocs = await Promise.all(
      campusIds.map((id) => ctx.db.get(id as Id<"campuses">)),
    );
    const campusNameMap = new Map<string, string>();
    for (const c of campusDocs) {
      if (c) campusNameMap.set(c._id, c.name);
    }
    const byCampus: Record<string, number> = {};
    for (const [id, amount] of byCampusId) {
      const name = id === "" ? "Unknown" : (campusNameMap.get(id) ?? "Unknown");
      byCampus[name] = (byCampus[name] ?? 0) + amount;
    }

    let standardLevelName: string | null = null;
    if (args.standardLevelId) {
      const level = await ctx.db.get(args.standardLevelId);
      standardLevelName = level?.name ?? null;
    }

    return {
      aggregates: { totalAmount, sessionCount, byPaymentMode, byCampus },
      standardLevelName,
    };
  },
});

/**
 * Paginated fee collection sessions for the given academic year, newest
 * first, enriched with student name/number, campus and collector name.
 *
 * Year + date range are indexed; campus, payment mode, student IDs, level and
 * the voided toggle are applied to each page, so a page can come back short
 * (or empty) while `isDone` is still false — the client keeps loading.
 */
export const getTransactionLog = query({
  args: { ...sessionFilterArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts, ...args }) => {
    await requireRole(ctx, ["admin"]);

    const result = await sessionRange(ctx, args).paginate(paginationOpts);
    const filtered = result.page.filter((s) => matchesFilters(s, args));

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

    // ── Batch-enrich: collect unique IDs, then fetch all at once ───────
    const studentIds = [...new Set(filtered.map((s) => s.studentId))];
    const collectorIds = [...new Set(filtered.map((s) => s.collectedBy))];

    const [students, collectors] = await Promise.all([
      Promise.all(studentIds.map((id) => ctx.db.get(id))),
      Promise.all(collectorIds.map((id) => ctx.db.get(id))),
    ]);

    // `name` is nullable since the import widening (#93) — an unnamed student
    // falls through to the existing "Unknown Student" display fallback below
    // rather than having a name invented for it here.
    const studentMap = new Map<
      string,
      { name: string | undefined; number: string }
    >();
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

    const page = filtered.map((session) => {
      const student = studentMap.get(session.studentId);
      return {
        _id: session._id,
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

    return { ...result, page };
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
 *
 * Caps at EXPORT_MAX_SESSIONS and throws past it, so a too-wide export fails
 * with a message instead of a CSV that quietly omits rows.
 */
export const EXPORT_MAX_SESSIONS = 2000;

export const getTransactionLogExport = query({
  args: sessionFilterArgs,
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const filtered: Session[] = [];
    for await (const s of sessionRange(ctx, args)) {
      if (!matchesFilters(s, args)) continue;
      if (filtered.length === EXPORT_MAX_SESSIONS) {
        throw new ConvexError(
          `Export covers more than ${EXPORT_MAX_SESSIONS} sessions. Narrow the date range and try again.`,
        );
      }
      filtered.push(s);
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

    // `name` is nullable since the import widening (#93) — an unnamed student
    // falls through to the existing "Unknown Student" display fallback below
    // rather than having a name invented for it here.
    const studentMap = new Map<
      string,
      { name: string | undefined; number: string }
    >();
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
 *
 * Uses the `search_by_name` search index (word-prefix match), so a student
 * with no recorded name (#93) is simply never indexed.
 */
export const searchStudents = query({
  args: {
    nameQuery: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const nameQuery = args.nameQuery.trim();
    if (nameQuery.length === 0) {
      return [];
    }

    const students = await ctx.db
      .query("students")
      .withSearchIndex("search_by_name", (q) =>
        q.search("studentFullName", nameQuery),
      )
      .take(20);

    return students.map((s) => ({
      _id: s._id,
      studentFullName: s.studentFullName,
      studentNumber: s.studentNumber,
    }));
  },
});
