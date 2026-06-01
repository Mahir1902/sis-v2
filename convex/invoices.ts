import { type PaginationResult, paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  computeInvoiceAggregates,
  matchesInvoiceSearch,
} from "../lib/invoiceAggregates";
import {
  computeInvoiceTotals,
  formatInvoiceNumber,
  nextInvoiceSequence,
} from "../lib/invoiceUtils";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

// Maximum number of existing invoices we scan in the year bucket when
// computing the next sequence. Generous upper bound — a single year is very
// unlikely to exceed this. If it does, the retry path on collision still
// guarantees correctness; we just lose the "single-scan" optimisation.
const INVOICE_SCAN_CAP = 10000;

/**
 * Builds a human-readable line-item description from a fee structure and the
 * underlying studentFee. For monthly fees, the billing period is appended so
 * the same fee structure across multiple months remains distinguishable.
 */
function buildLineItemDescription(
  feeStructure: Doc<"feeStructure">,
  studentFee: Doc<"studentFees">,
): string {
  if (
    feeStructure.frequency === "monthly" &&
    studentFee.billingPeriod &&
    studentFee.billingPeriod.length > 0
  ) {
    return `${feeStructure.name} — ${studentFee.billingPeriod}`;
  }
  return feeStructure.name;
}

/**
 * Generates a new invoice in `draft` status for a set of studentFees.
 *
 * Admin-only. The mutation:
 *   1. Validates that the student exists and that every fee belongs to the
 *      student and academic year.
 *   2. Refuses to invoice fees that are already attached to a non-voided invoice.
 *   3. Snapshots fee amounts and structure names into `lineItems` so the
 *      invoice is immutable even if the source records change.
 *   4. Computes a unique invoice number using the `by_year` index. On the
 *      vanishingly rare event of an in-flight collision (Convex transactions
 *      serialise, but as a defense-in-depth measure), retries once with
 *      sequence+1.
 *   5. Prefers the student's current enrollment for level/campus snapshot;
 *      falls back to the student's denormalised level/campus if none.
 *   6. Writes a `create` audit log.
 *
 * @returns `{ invoiceId, invoiceNumber }` for the newly created draft invoice.
 */
export const generateInvoice = mutation({
  args: {
    studentId: v.id("students"),
    academicYearId: v.id("academicYears"),
    studentFeeIds: v.array(v.id("studentFees")),
    dueDate: v.float64(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    if (args.studentFeeIds.length === 0) {
      throw new Error("At least one fee is required to generate an invoice");
    }
    if (!Number.isFinite(args.dueDate) || args.dueDate <= 0) {
      throw new Error("Invalid due date");
    }

    // 1. Load the student. Generic error so we don't leak whether the id existed.
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // 2. Load the academic year (needed for invoice numbering).
    const academicYear = await ctx.db.get(args.academicYearId);
    if (!academicYear) throw new Error("Academic year not found");

    // 3. De-duplicate the input fee ids defensively — callers may pass the
    // same id twice; we should never double-bill.
    const uniqueFeeIds = Array.from(new Set(args.studentFeeIds));

    // 4. Load every fee in parallel, validating ownership and academic year.
    const fees = await Promise.all(
      uniqueFeeIds.map(async (id) => {
        const fee = await ctx.db.get(id);
        if (!fee) throw new Error("Fee record not found");
        if (fee.studentId !== args.studentId) {
          throw new Error("Fees do not belong to this student");
        }
        if (fee.academicYear !== args.academicYearId) {
          throw new Error("Fees do not belong to this academic year");
        }
        return fee;
      }),
    );

    // 5. Reject any fee that is already on a non-voided invoice for this
    // student + year. Scan via the by_student_year composite index.
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_student_year", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("academicYearId", args.academicYearId),
      )
      .take(INVOICE_SCAN_CAP);

    const reservedFeeIds = new Set<string>();
    for (const inv of existingInvoices) {
      if (inv.status === "voided") continue;
      for (const li of inv.lineItems) {
        reservedFeeIds.add(li.studentFeeId);
      }
    }
    for (const fee of fees) {
      if (reservedFeeIds.has(fee._id)) {
        throw new Error("One or more fees are already on an active invoice");
      }
    }

    // 6. Load fee structures for descriptions (parallel — no N+1).
    const structures = await Promise.all(
      fees.map((fee) => ctx.db.get(fee.feeStructureId)),
    );

    const lineItems = fees.map((fee, idx) => {
      const structure = structures[idx];
      if (!structure) {
        // Defensive: studentFee references a missing structure. Use a generic
        // description rather than crashing the invoice generation.
        return {
          studentFeeId: fee._id,
          feeStructureId: fee.feeStructureId,
          description: fee.billingPeriod ?? "Fee",
          amount: fee.balance,
        };
      }
      return {
        studentFeeId: fee._id,
        feeStructureId: fee.feeStructureId,
        description: buildLineItemDescription(structure, fee),
        amount: fee.balance,
      };
    });

    const { totalAmount, balance } = computeInvoiceTotals(lineItems, 0);

    // 7. Resolve current enrollment for level + campus snapshot.
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("academicYear", args.academicYearId),
      )
      .take(50);
    const currentEnrollment = enrollments.find((e) => e.exitDate === undefined);

    const standardLevelId =
      currentEnrollment?.standardLevelId ?? student.standardLevel;
    const campusId = currentEnrollment?.campus ?? student.campus;

    // 8. Generate the invoice number via the by_year index. Cap the scan at
    // INVOICE_SCAN_CAP — generous, and the by_year index keeps it cheap.
    const yearBucket = await ctx.db
      .query("invoices")
      .withIndex("by_year", (q) => q.eq("academicYearId", args.academicYearId))
      .take(INVOICE_SCAN_CAP);
    const existingNumbers = yearBucket.map((i) => i.invoiceNumber);

    const yearLabel = academicYear.name;
    let sequence = nextInvoiceSequence(existingNumbers, yearLabel.slice(0, 4));
    let invoiceNumber = formatInvoiceNumber(yearLabel, sequence);

    // 9. Defense-in-depth: detect a collision on the chosen number and retry
    // once with sequence+1. Convex mutations serialise writes, so a true race
    // is improbable — this protects against test-time or seed-time collisions
    // and any future schema/data scenario we have not foreseen.
    const collision = await ctx.db
      .query("invoices")
      .withIndex("by_invoice_number", (q) =>
        q.eq("invoiceNumber", invoiceNumber),
      )
      .first();
    if (collision) {
      sequence += 1;
      invoiceNumber = formatInvoiceNumber(yearLabel, sequence);
      const stillColliding = await ctx.db
        .query("invoices")
        .withIndex("by_invoice_number", (q) =>
          q.eq("invoiceNumber", invoiceNumber),
        )
        .first();
      if (stillColliding) {
        throw new Error(
          "Unable to allocate invoice number — please retry the request",
        );
      }
    }

    // 10. Insert the invoice.
    const now = Date.now();
    const invoiceId = await ctx.db.insert("invoices", {
      invoiceNumber,
      studentId: args.studentId,
      academicYearId: args.academicYearId,
      standardLevelId,
      campusId,
      lineItems,
      totalAmount,
      paidAmount: 0,
      balance,
      status: "draft",
      issueDate: now,
      dueDate: args.dueDate,
      notes: args.notes,
      createdBy: user._id,
      createdAt: now,
    });

    // 11. Audit log.
    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "invoices",
      entityId: invoiceId,
      description: `Generated invoice ${invoiceNumber} for ${totalAmount}`,
      metadata: {
        invoiceNumber,
        totalAmount,
        studentId: args.studentId,
        lineItemCount: lineItems.length,
      },
    });

    return { invoiceId, invoiceNumber };
  },
});

/**
 * Voids an invoice. Admin-only.
 *
 * Voiding is non-destructive — the record persists with `status: "voided"`,
 * `voidedAt`, `voidedBy`, and an optional `voidReason`. This preserves the
 * audit trail.
 *
 * A `paid` invoice cannot be voided (any reversal must go through the payment
 * refund flow). An already-voided invoice cannot be voided again.
 */
export const voidInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    if (invoice.status === "paid") {
      throw new Error("Cannot void a paid invoice");
    }
    if (invoice.status === "voided") {
      throw new Error("Invoice is already voided");
    }

    const previousStatus = invoice.status;
    const now = Date.now();

    await ctx.db.patch(args.invoiceId, {
      status: "voided",
      voidedAt: now,
      voidedBy: user._id,
      voidReason: args.reason,
    });

    await logAudit(ctx, {
      user,
      action: "void",
      entityType: "invoices",
      entityId: args.invoiceId,
      description: `Voided invoice ${invoice.invoiceNumber}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        reason: args.reason,
        previousStatus,
      },
    });
  },
});

// ─── List / Detail Queries ──────────────────────────────────────────────────

/**
 * Maximum number of invoices the aggregate query will scan in a single call.
 * The aggregate is computed off the un-paginated filtered set so the summary
 * cards stay correct as the user pages through results. 2k is a generous
 * ceiling — well above expected single-year invoice volume — and respects the
 * "no unbounded collect" rule.
 */
const AGGREGATE_SCAN_CAP = 2000;

/**
 * Maximum number of `sent` invoices the daily overdue cron will scan per run.
 * `by_status` keeps the read narrow; if the school ever produces more than 1k
 * outstanding sent invoices the cron will simply process the next batch the
 * following day. The cap is documented here so it isn't accidentally removed.
 */
const OVERDUE_SCAN_CAP = 1000;

const statusFilterValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("voided"),
  v.literal("all"),
);

type InvoiceFilters = {
  academicYearId?: Id<"academicYears">;
  status?: "draft" | "sent" | "paid" | "overdue" | "voided" | "all";
  standardLevelId?: Id<"standardLevels">;
  campusId?: Id<"campuses">;
};

/**
 * Resolves the academic year that should anchor an unfiltered invoice list:
 * the most recently created academic year. Returns `null` if there are no
 * academic years at all (a fresh deployment) so the caller can short-circuit
 * to an empty result rather than throwing.
 */
async function getMostRecentAcademicYearId(
  ctx: QueryCtx,
): Promise<Id<"academicYears"> | null> {
  // No `.collect()` — academicYears is small (one row per year) but we still
  // cap defensively. `.order("desc")` walks the system `_creationTime` index.
  const recent = await ctx.db.query("academicYears").order("desc").take(1);
  return recent[0]?._id ?? null;
}

/**
 * Applies the in-memory secondary filters that cannot be pushed into a single
 * index. Status === "all" is a no-op. Used by the aggregate query AND by the
 * cron telemetry — kept private to this module.
 */
function applySecondaryFilters(
  invoices: Doc<"invoices">[],
  filters: { status?: InvoiceFilters["status"]; campusId?: Id<"campuses"> },
): Doc<"invoices">[] {
  let out = invoices;
  if (filters.status && filters.status !== "all") {
    out = out.filter((inv) => inv.status === filters.status);
  }
  if (filters.campusId) {
    out = out.filter((inv) => inv.campusId === filters.campusId);
  }
  return out;
}

/**
 * Shared enrichment for invoice list rows. Resolves student name + number,
 * level name, campus name, and academic-year name in a single batched pass.
 * No N+1 — every per-id read goes through Promise.all.
 */
async function enrichInvoices(
  ctx: QueryCtx,
  invoices: Doc<"invoices">[],
): Promise<
  Array<{
    _id: Id<"invoices">;
    _creationTime: number;
    invoiceNumber: string;
    studentId: Id<"students">;
    studentName: string;
    studentNumber: string;
    standardLevelId: Id<"standardLevels">;
    standardLevelName: string;
    campusId: Id<"campuses">;
    campusName: string;
    academicYearId: Id<"academicYears">;
    academicYearName: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: Doc<"invoices">["status"];
    issueDate: number;
    dueDate: number;
    sentAt: number | undefined;
    createdAt: number;
  }>
> {
  const studentIds = [...new Set(invoices.map((i) => i.studentId))];
  const levelIds = [...new Set(invoices.map((i) => i.standardLevelId))];
  const campusIds = [...new Set(invoices.map((i) => i.campusId))];
  const yearIds = [...new Set(invoices.map((i) => i.academicYearId))];

  const [students, levels, campuses, years] = await Promise.all([
    Promise.all(studentIds.map((id) => ctx.db.get(id))),
    Promise.all(levelIds.map((id) => ctx.db.get(id))),
    Promise.all(campusIds.map((id) => ctx.db.get(id))),
    Promise.all(yearIds.map((id) => ctx.db.get(id))),
  ]);

  const studentMap = new Map<
    Id<"students">,
    { name: string; number: string }
  >();
  for (const s of students) {
    if (s) {
      studentMap.set(s._id, {
        name: s.studentFullName,
        number: s.studentNumber,
      });
    }
  }
  const levelMap = new Map<Id<"standardLevels">, string>();
  for (const l of levels) if (l) levelMap.set(l._id, l.name);
  const campusMap = new Map<Id<"campuses">, string>();
  for (const c of campuses) if (c) campusMap.set(c._id, c.name);
  const yearMap = new Map<Id<"academicYears">, string>();
  for (const y of years) if (y) yearMap.set(y._id, y.name);

  return invoices.map((inv) => {
    const student = studentMap.get(inv.studentId);
    return {
      _id: inv._id,
      _creationTime: inv._creationTime,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.studentId,
      studentName: student?.name ?? "Unknown Student",
      studentNumber: student?.number ?? "—",
      standardLevelId: inv.standardLevelId,
      standardLevelName: levelMap.get(inv.standardLevelId) ?? "Unknown Level",
      campusId: inv.campusId,
      campusName: campusMap.get(inv.campusId) ?? "Unknown Campus",
      academicYearId: inv.academicYearId,
      academicYearName: yearMap.get(inv.academicYearId) ?? "Unknown Year",
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balance: inv.balance,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      sentAt: inv.sentAt,
      createdAt: inv.createdAt,
    };
  });
}

/**
 * Paginated, enriched invoice list for the admin invoices page. Admin-only.
 *
 * Index selection (CLAUDE.md "Index-First Design"):
 *   - `academicYearId` + `standardLevelId` → `by_year_level`
 *   - `academicYearId` only                → `by_year`
 *   - `status` only (specific value)       → `by_status`
 *   - otherwise → `by_year` anchored to the most recent academic year. If there
 *     are no academic years yet, returns an empty page.
 *
 * Remaining narrow filters (status when an index is already in use, campus)
 * are applied via `.filter()`. The free-text `search` term matches against
 * the invoice number, student name, or student admission number — and is
 * applied AFTER enrichment and AFTER pagination, so a single page may return
 * fewer than `paginationOpts.numItems` results. This is intentional: the
 * search box is a within-page filter for the UI, NOT a cross-page query. Do
 * not "fix" this by collecting everything first — that would defeat the
 * pagination cap.
 *
 * `aggregates` reflects the CURRENT page only and is intended for debug; the
 * full filter-set aggregates live on `getInvoiceAggregates`.
 */
export const getInvoices = query({
  args: {
    academicYearId: v.optional(v.id("academicYears")),
    status: v.optional(statusFilterValidator),
    standardLevelId: v.optional(v.id("standardLevels")),
    campusId: v.optional(v.id("campuses")),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    // Resolve an anchor academic year if none was supplied AND no status was
    // supplied. This keeps the read off `by_status` only when the user is
    // explicitly filtering by status — otherwise we want the year window.
    let anchorYearId: Id<"academicYears"> | undefined = args.academicYearId;
    const hasSpecificStatus = args.status && args.status !== "all";
    if (!anchorYearId && !args.standardLevelId && !hasSpecificStatus) {
      const fallback = await getMostRecentAcademicYearId(ctx);
      if (!fallback) {
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          aggregates: computeInvoiceAggregates([], Date.now()),
        };
      }
      anchorYearId = fallback;
    }

    // Capture narrowed local copies so TypeScript's flow analysis carries the
    // refinement into the index callback (where the outer `args.x` would be
    // re-widened to optional).
    const yearForIndex = anchorYearId;
    const levelForIndex = args.standardLevelId;
    const campusForFilter = args.campusId;
    const statusForFilter = hasSpecificStatus
      ? (args.status as Exclude<NonNullable<typeof args.status>, "all">)
      : undefined;

    // Build the query against the best index. Convex requires `withIndex`
    // ranges to be expressed at chain time, so each branch is its own query.
    // The `.filter()` callback always returns a single expression — when no
    // narrowing applies it returns a tautology, which Convex collapses.
    let pageResult: PaginationResult<Doc<"invoices">>;
    if (yearForIndex && levelForIndex) {
      pageResult = await ctx.db
        .query("invoices")
        .withIndex("by_year_level", (q) =>
          q
            .eq("academicYearId", yearForIndex)
            .eq("standardLevelId", levelForIndex),
        )
        .order("desc")
        .filter((q) => {
          const parts = [];
          if (statusForFilter)
            parts.push(q.eq(q.field("status"), statusForFilter));
          if (campusForFilter)
            parts.push(q.eq(q.field("campusId"), campusForFilter));
          if (parts.length === 0)
            return q.eq(q.field("status"), q.field("status"));
          if (parts.length === 1) return parts[0];
          return q.and(...parts);
        })
        .paginate(args.paginationOpts);
    } else if (yearForIndex) {
      pageResult = await ctx.db
        .query("invoices")
        .withIndex("by_year", (q) => q.eq("academicYearId", yearForIndex))
        .order("desc")
        .filter((q) => {
          const parts = [];
          if (statusForFilter)
            parts.push(q.eq(q.field("status"), statusForFilter));
          if (campusForFilter)
            parts.push(q.eq(q.field("campusId"), campusForFilter));
          if (parts.length === 0)
            return q.eq(q.field("status"), q.field("status"));
          if (parts.length === 1) return parts[0];
          return q.and(...parts);
        })
        .paginate(args.paginationOpts);
    } else if (statusForFilter) {
      // Status-only filter — by_status walks the whole table for that status.
      pageResult = await ctx.db
        .query("invoices")
        .withIndex("by_status", (q) => q.eq("status", statusForFilter))
        .order("desc")
        .filter((q) => {
          if (campusForFilter) {
            return q.eq(q.field("campusId"), campusForFilter);
          }
          return q.eq(q.field("status"), q.field("status"));
        })
        .paginate(args.paginationOpts);
    } else {
      // Defensive fallback: should be unreachable given the anchor logic above.
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        aggregates: computeInvoiceAggregates([], Date.now()),
      };
    }

    // Enrich the page before applying the free-text search.
    const enriched = await enrichInvoices(ctx, pageResult.page);

    const searchTerm = args.search ?? "";
    const visible = enriched.filter((inv) =>
      matchesInvoiceSearch(inv, searchTerm),
    );

    return {
      page: visible,
      isDone: pageResult.isDone,
      continueCursor: pageResult.continueCursor,
      // Page-only aggregates (cheap, mostly informational). The summary cards
      // use `getInvoiceAggregates` which scans the full filtered set.
      aggregates: computeInvoiceAggregates(pageResult.page, Date.now()),
    };
  },
});

/**
 * Returns the full-filter-set aggregates and per-status counts for the
 * invoice list page header. Admin-only.
 *
 * Scans up to `AGGREGATE_SCAN_CAP` (2000) matching invoices via the same
 * index-selection rules as `getInvoices`, then computes:
 *   - `aggregates` (via `computeInvoiceAggregates`) over the full filtered
 *     set with the STATUS filter applied.
 *   - `statusCounts` IGNORING the status filter — so the user always sees how
 *     many invoices land in each status tab for the current year/level/campus
 *     filter combination. An invoice counts as "overdue" if its stored status
 *     is `overdue` OR if it is `sent` AND its `dueDate` has passed.
 *
 * The search term is intentionally NOT applied here — the UI uses the
 * unscoped status counts to label tabs, and search is a within-page tool.
 */
export const getInvoiceAggregates = query({
  args: {
    academicYearId: v.optional(v.id("academicYears")),
    status: v.optional(statusFilterValidator),
    standardLevelId: v.optional(v.id("standardLevels")),
    campusId: v.optional(v.id("campuses")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    let anchorYearId: Id<"academicYears"> | undefined = args.academicYearId;
    const hasSpecificStatus = args.status && args.status !== "all";
    if (!anchorYearId && !args.standardLevelId && !hasSpecificStatus) {
      const fallback = await getMostRecentAcademicYearId(ctx);
      if (!fallback) {
        return {
          aggregates: computeInvoiceAggregates([], Date.now()),
          statusCounts: {
            all: 0,
            draft: 0,
            sent: 0,
            paid: 0,
            overdue: 0,
            voided: 0,
          },
        };
      }
      anchorYearId = fallback;
    }

    // Capture narrowed local copies so TypeScript's flow analysis flows into
    // the index callbacks.
    const yearForIndex = anchorYearId;
    const levelForIndex = args.standardLevelId;
    const statusForIndex = hasSpecificStatus
      ? (args.status as Exclude<NonNullable<typeof args.status>, "all">)
      : undefined;

    // Fetch the candidate set via the same index strategy as `getInvoices`,
    // but ignore status when picking the index — we need status counts for
    // every status tab. Status filter is applied later, only to `aggregates`.
    let candidates: Doc<"invoices">[];
    if (yearForIndex && levelForIndex) {
      candidates = await ctx.db
        .query("invoices")
        .withIndex("by_year_level", (q) =>
          q
            .eq("academicYearId", yearForIndex)
            .eq("standardLevelId", levelForIndex),
        )
        .take(AGGREGATE_SCAN_CAP);
    } else if (yearForIndex) {
      candidates = await ctx.db
        .query("invoices")
        .withIndex("by_year", (q) => q.eq("academicYearId", yearForIndex))
        .take(AGGREGATE_SCAN_CAP);
    } else if (statusForIndex) {
      candidates = await ctx.db
        .query("invoices")
        .withIndex("by_status", (q) => q.eq("status", statusForIndex))
        .take(AGGREGATE_SCAN_CAP);
    } else {
      candidates = [];
    }

    // Apply non-status narrow filters (campus) for both aggregates and counts.
    const baseFiltered = applySecondaryFilters(candidates, {
      campusId: args.campusId,
    });

    // For `aggregates` apply the status filter on top.
    const aggregateSet = applySecondaryFilters(baseFiltered, {
      status: args.status,
    });

    const now = Date.now();
    const aggregates = computeInvoiceAggregates(aggregateSet, now);

    // For `statusCounts` ignore the status filter. Counts respect the
    // dynamic "sent + past due → overdue" rule so the user sees the tab they
    // would land on if the cron had run.
    const statusCounts = {
      all: 0,
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      voided: 0,
    };
    for (const inv of baseFiltered) {
      statusCounts.all += 1;
      const dynamicallyOverdue = inv.status === "sent" && inv.dueDate < now;
      if (dynamicallyOverdue) {
        statusCounts.overdue += 1;
      } else if (inv.status in statusCounts) {
        statusCounts[inv.status as keyof typeof statusCounts] += 1;
      }
    }

    return { aggregates, statusCounts };
  },
});

/**
 * Returns the full detail of a single invoice for the InvoiceDocument view.
 * Admin-only. Returns `null` if the invoice does not exist (the UI handles
 * the missing case rather than throwing).
 *
 * Enrichments (each batched via Promise.all — no N+1):
 *   - student name + admission number
 *   - standardLevel name, campus name, academicYear name
 *   - per-line-item feeStructure name
 *   - createdBy / sentBy / voidedBy → user.name strings
 */
export const getInvoiceById = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    // Collect all distinct user ids referenced on the invoice for one batch.
    const userIds: Id<"users">[] = [invoice.createdBy];
    if (invoice.sentBy) userIds.push(invoice.sentBy);
    if (invoice.voidedBy) userIds.push(invoice.voidedBy);
    const uniqueUserIds = [...new Set(userIds)];

    const structureIds = [
      ...new Set(invoice.lineItems.map((li) => li.feeStructureId)),
    ];

    // Run all four single-doc reads and the two batched reads in parallel
    // (no N+1) — see CLAUDE.md backend rule 5.
    const [student, level, campus, year, structures, userDocs] =
      await Promise.all([
        ctx.db.get(invoice.studentId),
        ctx.db.get(invoice.standardLevelId),
        ctx.db.get(invoice.campusId),
        ctx.db.get(invoice.academicYearId),
        Promise.all(structureIds.map((id) => ctx.db.get(id))),
        Promise.all(uniqueUserIds.map((id) => ctx.db.get(id))),
      ]);

    const structureMap = new Map<Id<"feeStructure">, string>();
    for (const s of structures) if (s) structureMap.set(s._id, s.name);

    const userMap = new Map<Id<"users">, string>();
    for (const u of userDocs) if (u) userMap.set(u._id, u.name);

    const lineItems = invoice.lineItems.map((li) => ({
      studentFeeId: li.studentFeeId,
      feeStructureId: li.feeStructureId,
      feeStructureName: structureMap.get(li.feeStructureId) ?? li.description,
      description: li.description,
      amount: li.amount,
    }));

    return {
      _id: invoice._id,
      _creationTime: invoice._creationTime,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      studentId: invoice.studentId,
      studentName: student?.studentFullName ?? "Unknown Student",
      studentNumber: student?.studentNumber ?? "—",
      standardLevelId: invoice.standardLevelId,
      standardLevelName: level?.name ?? "Unknown Level",
      campusId: invoice.campusId,
      campusName: campus?.name ?? "Unknown Campus",
      academicYearId: invoice.academicYearId,
      academicYearName: year?.name ?? "Unknown Year",
      lineItems,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balance: invoice.balance,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      sentAt: invoice.sentAt,
      sentByName: invoice.sentBy ? (userMap.get(invoice.sentBy) ?? null) : null,
      notes: invoice.notes ?? null,
      createdAt: invoice.createdAt,
      createdByName: userMap.get(invoice.createdBy) ?? "Unknown",
      voidedAt: invoice.voidedAt ?? null,
      voidedByName: invoice.voidedBy
        ? (userMap.get(invoice.voidedBy) ?? null)
        : null,
      voidReason: invoice.voidReason ?? null,
    };
  },
});

// ─── Daily overdue transition cron ──────────────────────────────────────────

/**
 * Internal mutation invoked by the daily cron (see `convex/crons.ts`).
 * Walks up to `OVERDUE_SCAN_CAP` invoices in `sent` status via the `by_status`
 * index, and for each whose `dueDate < now` patches the status to `overdue`.
 *
 * Crucially, this does NOT touch `paid` or `voided` invoices — both can have
 * a past dueDate legitimately, and re-flipping them would corrupt audit
 * meaning.
 *
 * Returns `{ scanned, transitioned }` for telemetry (Convex surfaces the
 * return value in the dashboard cron log).
 */
export const transitionOverdueInvoices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const sentInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .take(OVERDUE_SCAN_CAP);

    let transitioned = 0;
    for (const inv of sentInvoices) {
      // Defensive: belt and suspenders. The index narrows to status="sent",
      // but guard against any future change in semantics.
      if (inv.status !== "sent") continue;
      if (inv.dueDate < now) {
        await ctx.db.patch(inv._id, { status: "overdue" });
        transitioned += 1;
      }
    }

    return { scanned: sentInvoices.length, transitioned };
  },
});
