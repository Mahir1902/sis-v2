# Transaction Log: Standard Level Filter + Date Range Presets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard level filtering and date range presets (monthly, quarterly, half-yearly, yearly, custom) to the transaction log, with CSV export respecting all filters.

**Architecture:** Denormalize `standardLevelId` onto `feeCollectionSessions` for O(1) index-based filtering. Add date range utility functions that compute `dateFrom`/`dateTo` from preset + period selection. Wire new filters into existing hook → query → UI → CSV pipeline.

**Tech Stack:** Convex (schema, query, mutation, action), TypeScript, React, date-fns, vitest, shadcn/ui (Select, Popover)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/dateRangeUtils.ts` | Create | Date range preset computation (month/quarter/half boundaries) |
| `lib/dateRangeUtils.test.ts` | Create | Tests for all date range computations |
| `lib/csvExport.ts` | Modify | Update `generateTransactionFilename` for level + date range |
| `lib/csvExport.test.ts` | Modify | Tests for updated filename generation |
| `convex/schema.ts` | Modify | Add `standardLevelId` + index to `feeCollectionSessions` |
| `convex/feeCollectionSessions.ts` | Modify | Store `standardLevelId` in `collectFees` mutation |
| `convex/transactionLog.ts` | Modify | Add `standardLevelId` filter arg + `standardLevelName` in response |
| `convex/migrations.ts` | Create | Backfill action for existing sessions |
| `hooks/use-transaction-filters.ts` | Modify | Add `standardLevelId`, date preset state, computed dates |
| `app/(dashboard)/admin/transactions/_components/TransactionFilters.tsx` | Modify | Add standard level dropdown + date range preset UI |
| `app/(dashboard)/admin/transactions/_components/ExportButton.tsx` | Modify | Pass level name + date label to filename generator |
| `app/(dashboard)/admin/transactions/page.tsx` | Modify | Wire new filter props + pass level/date info to ExportButton |

---

## Task 1: Date Range Utility Functions (TDD)

**Files:**
- Create: `lib/dateRangeUtils.ts`
- Create: `lib/dateRangeUtils.test.ts`

- [ ] **Step 1: Write failing tests for `computeDateRange`**

```ts
// lib/dateRangeUtils.test.ts
import { describe, expect, it } from "vitest";
import {
  computeDateRange,
  formatDateRangeLabel,
  type DateRangePreset,
} from "./dateRangeUtils";

describe("computeDateRange", () => {
  describe("monthly", () => {
    it("returns first and last ms of January 2026", () => {
      const result = computeDateRange("monthly", { month: 0, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 0, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 0, 31, 23, 59, 59, 999).getTime());
    });

    it("handles February in a non-leap year (2025)", () => {
      const result = computeDateRange("monthly", { month: 1, year: 2025 });
      expect(result.dateFrom).toBe(new Date(2025, 1, 1).getTime());
      expect(result.dateTo).toBe(new Date(2025, 1, 28, 23, 59, 59, 999).getTime());
    });

    it("handles February in a leap year (2024)", () => {
      const result = computeDateRange("monthly", { month: 1, year: 2024 });
      expect(result.dateTo).toBe(new Date(2024, 1, 29, 23, 59, 59, 999).getTime());
    });
  });

  describe("quarterly", () => {
    it("Q1 covers Jan 1 to Mar 31", () => {
      const result = computeDateRange("quarterly", { quarter: 1, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 0, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 2, 31, 23, 59, 59, 999).getTime());
    });

    it("Q2 covers Apr 1 to Jun 30", () => {
      const result = computeDateRange("quarterly", { quarter: 2, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 3, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 5, 30, 23, 59, 59, 999).getTime());
    });

    it("Q3 covers Jul 1 to Sep 30", () => {
      const result = computeDateRange("quarterly", { quarter: 3, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 6, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 8, 30, 23, 59, 59, 999).getTime());
    });

    it("Q4 covers Oct 1 to Dec 31", () => {
      const result = computeDateRange("quarterly", { quarter: 4, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 9, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).getTime());
    });
  });

  describe("half-yearly", () => {
    it("H1 covers Jan 1 to Jun 30", () => {
      const result = computeDateRange("half-yearly", { half: 1, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 0, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 5, 30, 23, 59, 59, 999).getTime());
    });

    it("H2 covers Jul 1 to Dec 31", () => {
      const result = computeDateRange("half-yearly", { half: 2, year: 2026 });
      expect(result.dateFrom).toBe(new Date(2026, 6, 1).getTime());
      expect(result.dateTo).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).getTime());
    });
  });

  describe("yearly", () => {
    it("returns undefined for both dates (uses academic year filter)", () => {
      const result = computeDateRange("yearly", {});
      expect(result.dateFrom).toBeUndefined();
      expect(result.dateTo).toBeUndefined();
    });
  });
});

describe("formatDateRangeLabel", () => {
  it("formats monthly label", () => {
    expect(formatDateRangeLabel("monthly", { month: 0, year: 2026 })).toBe("Jan-2026");
  });

  it("formats quarterly label", () => {
    expect(formatDateRangeLabel("quarterly", { quarter: 2, year: 2026 })).toBe("Q2-2026");
  });

  it("formats half-yearly label", () => {
    expect(formatDateRangeLabel("half-yearly", { half: 1, year: 2026 })).toBe("H1-2026");
  });

  it("returns empty string for yearly", () => {
    expect(formatDateRangeLabel("yearly", {})).toBe("");
  });

  it("returns empty string for custom", () => {
    expect(formatDateRangeLabel("custom", {})).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/dateRangeUtils.test.ts`
Expected: FAIL — module `./dateRangeUtils` not found

- [ ] **Step 3: Implement `computeDateRange` and `formatDateRangeLabel`**

```ts
// lib/dateRangeUtils.ts
import { endOfMonth } from "date-fns";

export type DateRangePreset = "monthly" | "quarterly" | "half-yearly" | "yearly" | "custom";

type MonthlyPeriod = { month: number; year: number };
type QuarterlyPeriod = { quarter: number; year: number };
type HalfYearlyPeriod = { half: number; year: number };
type EmptyPeriod = Record<string, never>;

type PeriodForPreset =
  | MonthlyPeriod
  | QuarterlyPeriod
  | HalfYearlyPeriod
  | EmptyPeriod;

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const QUARTER_START_MONTH: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 9 };

export function computeDateRange(
  preset: DateRangePreset,
  period: PeriodForPreset,
): { dateFrom: number | undefined; dateTo: number | undefined } {
  if (preset === "yearly" || preset === "custom") {
    return { dateFrom: undefined, dateTo: undefined };
  }

  if (preset === "monthly") {
    const { month, year } = period as MonthlyPeriod;
    const start = new Date(year, month, 1);
    const end = endOfMonth(start);
    return { dateFrom: start.getTime(), dateTo: end.getTime() };
  }

  if (preset === "quarterly") {
    const { quarter, year } = period as QuarterlyPeriod;
    const startMonth = QUARTER_START_MONTH[quarter];
    const start = new Date(year, startMonth, 1);
    const end = endOfMonth(new Date(year, startMonth + 2, 1));
    return { dateFrom: start.getTime(), dateTo: end.getTime() };
  }

  // half-yearly
  const { half, year } = period as HalfYearlyPeriod;
  const startMonth = half === 1 ? 0 : 6;
  const start = new Date(year, startMonth, 1);
  const end = endOfMonth(new Date(year, startMonth + 5, 1));
  return { dateFrom: start.getTime(), dateTo: end.getTime() };
}

export function formatDateRangeLabel(
  preset: DateRangePreset,
  period: PeriodForPreset,
): string {
  if (preset === "monthly") {
    const { month, year } = period as MonthlyPeriod;
    return `${MONTH_NAMES[month]}-${year}`;
  }
  if (preset === "quarterly") {
    const { quarter, year } = period as QuarterlyPeriod;
    return `Q${quarter}-${year}`;
  }
  if (preset === "half-yearly") {
    const { half, year } = period as HalfYearlyPeriod;
    return `H${half}-${year}`;
  }
  return "";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/dateRangeUtils.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/dateRangeUtils.ts lib/dateRangeUtils.test.ts
git commit -m "feat: add date range preset utility functions with tests"
```

---

## Task 2: Update CSV Filename Generation (TDD)

**Files:**
- Modify: `lib/csvExport.ts:63-66`
- Modify: `lib/csvExport.test.ts:108-119`

- [ ] **Step 1: Write failing tests for updated `generateTransactionFilename`**

Add to `lib/csvExport.test.ts` — replace the existing `generateTransactionFilename` describe block:

```ts
describe("generateTransactionFilename", () => {
  it("produces filename with year only when no level or date range", () => {
    const filename = generateTransactionFilename("2024-2025");
    expect(filename).toMatch(/^transactions-All-2024-2025\.csv$/);
  });

  it("includes level name when provided", () => {
    const filename = generateTransactionFilename("2024-2025", "Grade 6");
    expect(filename).toBe("transactions-Grade-6-2024-2025.csv");
  });

  it("includes date range label when provided", () => {
    const filename = generateTransactionFilename("2024-2025", undefined, "Jan-2026");
    expect(filename).toBe("transactions-All-Jan-2026-2024-2025.csv");
  });

  it("includes both level and date range", () => {
    const filename = generateTransactionFilename("2024-2025", "Grade 3", "Q2-2026");
    expect(filename).toBe("transactions-Grade-3-Q2-2026-2024-2025.csv");
  });

  it("sanitizes spaces in level name to hyphens", () => {
    const filename = generateTransactionFilename("2025-2026", "KG 1");
    expect(filename).toBe("transactions-KG-1-2025-2026.csv");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/csvExport.test.ts`
Expected: FAIL — `generateTransactionFilename` signature mismatch / wrong output

- [ ] **Step 3: Update `generateTransactionFilename`**

Replace the function in `lib/csvExport.ts:63-66`:

```ts
export function generateTransactionFilename(
  yearName: string,
  levelName?: string,
  dateRangeLabel?: string,
): string {
  const level = levelName ? levelName.replace(/\s+/g, "-") : "All";
  const parts = ["transactions", level];
  if (dateRangeLabel) parts.push(dateRangeLabel);
  parts.push(yearName);
  return `${parts.join("-")}.csv`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/csvExport.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/csvExport.ts lib/csvExport.test.ts
git commit -m "feat: update CSV filename to include standard level and date range"
```

---

## Task 3: Schema Change — Add `standardLevelId` to `feeCollectionSessions`

**Files:**
- Modify: `convex/schema.ts:240-263`

- [ ] **Step 1: Add the field and index**

In `convex/schema.ts`, in the `feeCollectionSessions` table definition, add `standardLevelId` after the `feeCount` field (line 257), and add the new index after the existing `.index("by_campus", ["campus"])` line (line 263):

```ts
// Add this field after feeCount: v.float64(),
standardLevelId: v.optional(v.id("standardLevels")),

// Add this index after .index("by_campus", ["campus"])
.index("by_year_level", ["academicYear", "standardLevelId"])
```

- [ ] **Step 2: Verify Convex accepts the schema**

Run: `npx convex dev` (should push schema without errors since field is optional)
Expected: Schema pushed successfully, no validation errors

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add standardLevelId field and by_year_level index to feeCollectionSessions"
```

---

## Task 4: Update `collectFees` Mutation to Store `standardLevelId`

**Files:**
- Modify: `convex/feeCollectionSessions.ts:76-88`

- [ ] **Step 1: Add `standardLevelId` to the session insert**

In `convex/feeCollectionSessions.ts`, the enrollment is already fetched at lines 67-74. Modify the `ctx.db.insert("feeCollectionSessions", {...})` call at line 76-88 to include `standardLevelId`:

```ts
    const sessionId = await ctx.db.insert("feeCollectionSessions", {
      invoiceNumber,
      studentId: args.studentId,
      academicYear: student.academicYear,
      campus: enrollment?.campus,
      totalAmount,
      paymentMode: args.paymentMode,
      remarks: args.remarks,
      status: "completed",
      collectedBy: user._id,
      transactionDate: now,
      feeCount: fees.length,
      standardLevelId: enrollment?.standardLevelId ?? student.standardLevel,
    });
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit**

```bash
git add convex/feeCollectionSessions.ts
git commit -m "feat: store standardLevelId when collecting fees"
```

---

## Task 5: Backfill Migration Action

**Files:**
- Create: `convex/migrations.ts`

- [ ] **Step 1: Write the backfill action**

```ts
// convex/migrations.ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const backfillSessionStandardLevels = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const sessions = await ctx.db
      .query("feeCollectionSessions")
      .order("asc")
      .take(batchSize + 1);

    // Filter to only those missing standardLevelId
    const toFix = sessions.filter((s) => s.standardLevelId === undefined);

    let patched = 0;

    for (const session of toFix) {
      const enrollment = await ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q
            .eq("studentId", session.studentId)
            .eq("academicYear", session.academicYear),
        )
        .first();

      if (enrollment) {
        await ctx.db.patch(session._id, {
          standardLevelId: enrollment.standardLevelId,
        });
        patched++;
        continue;
      }

      const student = await ctx.db.get(session.studentId);
      if (student) {
        await ctx.db.patch(session._id, {
          standardLevelId: student.standardLevel,
        });
        patched++;
      }
    }

    return { patched, totalInBatch: sessions.length };
  },
});
```

- [ ] **Step 2: Verify Convex accepts the function**

Run: `npx convex dev` (should sync without errors)
Expected: Function registered successfully

- [ ] **Step 3: Run the migration from the Convex dashboard**

Navigate to Convex dashboard → Functions → `migrations:backfillSessionStandardLevels` → Run.
Verify by checking a few records in the dashboard that `standardLevelId` is now populated.

- [ ] **Step 4: Commit**

```bash
git add convex/migrations.ts
git commit -m "feat: add backfill migration for session standardLevelId"
```

---

## Task 6: Update `getTransactionLog` Query

**Files:**
- Modify: `convex/transactionLog.ts:20-139`

- [ ] **Step 1: Add `standardLevelId` arg and filter logic**

In `convex/transactionLog.ts`, make these changes:

1. Add to the `args` object (after `includeVoided`):
```ts
    standardLevelId: v.optional(v.id("standardLevels")),
```

2. Add standard level filter after the student IDs filter block (after line 76):
```ts
    // Standard level
    if (args.standardLevelId) {
      filtered = filtered.filter(
        (s) => s.standardLevelId === args.standardLevelId,
      );
    }
```

3. Fetch the standard level name for the response. After the `collectorMap` block (after line 119), add:
```ts
    // Resolve standard level name for filename generation
    let standardLevelName: string | null = null;
    if (args.standardLevelId) {
      const level = await ctx.db.get(args.standardLevelId);
      standardLevelName = level?.name ?? null;
    }
```

4. Update the return at the bottom (line 138) to include `standardLevelName`:
```ts
    return { sessions, aggregates, standardLevelName };
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add convex/transactionLog.ts
git commit -m "feat: add standardLevelId filter to getTransactionLog query"
```

---

## Task 7: Update Filter Hook

**Files:**
- Modify: `hooks/use-transaction-filters.ts`

- [ ] **Step 1: Add new state and wire into queryArgs**

Replace the entire file content:

```ts
import { useCallback, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  computeDateRange,
  formatDateRangeLabel,
  type DateRangePreset,
} from "@/lib/dateRangeUtils";

type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "Online";

type PeriodSelection = {
  month?: number;
  year?: number;
  quarter?: number;
  half?: number;
};

export interface TransactionFilterState {
  academicYearId: Id<"academicYears"> | undefined;
  dateFrom: number | undefined;
  dateTo: number | undefined;
  campusFilter: string | undefined;
  paymentMode: PaymentMode | undefined;
  studentIds: Id<"students">[] | undefined;
  includeVoided: boolean;
  standardLevelId: Id<"standardLevels"> | undefined;
  dateRangePreset: DateRangePreset | undefined;
}

export function useTransactionFilters(
  defaultYearId: Id<"academicYears"> | undefined,
) {
  const [academicYearId, setAcademicYearId] = useState<
    Id<"academicYears"> | undefined
  >(undefined);
  const [campusFilter, setCampusFilter] = useState<string | undefined>(
    undefined,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>(
    undefined,
  );
  const [studentIds, setStudentIds] = useState<Id<"students">[] | undefined>(
    undefined,
  );
  const [includeVoided, setIncludeVoided] = useState(false);
  const [standardLevelId, setStandardLevelId] = useState<
    Id<"standardLevels"> | undefined
  >(undefined);

  // Date range: either preset-driven or custom
  const [dateRangePreset, setDateRangePreset] = useState<
    DateRangePreset | undefined
  >(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>({});
  const [customDateFrom, setCustomDateFrom] = useState<number | undefined>(
    undefined,
  );
  const [customDateTo, setCustomDateTo] = useState<number | undefined>(
    undefined,
  );

  const effectiveYearId = academicYearId ?? defaultYearId;

  // Compute dateFrom/dateTo from preset or custom
  const { dateFrom, dateTo } = useMemo(() => {
    if (!dateRangePreset || dateRangePreset === "custom") {
      return { dateFrom: customDateFrom, dateTo: customDateTo };
    }
    return computeDateRange(dateRangePreset, selectedPeriod);
  }, [dateRangePreset, selectedPeriod, customDateFrom, customDateTo]);

  const dateRangeLabel = useMemo(() => {
    if (!dateRangePreset || dateRangePreset === "custom" || dateRangePreset === "yearly") {
      return "";
    }
    return formatDateRangeLabel(dateRangePreset, selectedPeriod);
  }, [dateRangePreset, selectedPeriod]);

  const resetAll = useCallback(() => {
    setAcademicYearId(undefined);
    setCampusFilter(undefined);
    setPaymentMode(undefined);
    setStudentIds(undefined);
    setIncludeVoided(false);
    setStandardLevelId(undefined);
    setDateRangePreset(undefined);
    setSelectedPeriod({});
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  }, []);

  const hasActiveFilters =
    dateFrom !== undefined ||
    dateTo !== undefined ||
    campusFilter !== undefined ||
    paymentMode !== undefined ||
    (studentIds !== undefined && studentIds.length > 0) ||
    includeVoided ||
    standardLevelId !== undefined;

  const queryArgs = effectiveYearId
    ? {
        academicYearId: effectiveYearId,
        ...(dateFrom !== undefined && { dateFrom }),
        ...(dateTo !== undefined && { dateTo }),
        ...(campusFilter && { campusFilter }),
        ...(paymentMode && { paymentMode }),
        ...(studentIds && studentIds.length > 0 && { studentIds }),
        ...(includeVoided && { includeVoided }),
        ...(standardLevelId && { standardLevelId }),
      }
    : ("skip" as const);

  return {
    effectiveYearId,
    academicYearId,
    setAcademicYearId,
    dateFrom,
    dateTo,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    dateRangePreset,
    setDateRangePreset,
    selectedPeriod,
    setSelectedPeriod,
    dateRangeLabel,
    campusFilter,
    setCampusFilter,
    paymentMode,
    setPaymentMode,
    studentIds,
    setStudentIds,
    includeVoided,
    setIncludeVoided,
    standardLevelId,
    setStandardLevelId,
    resetAll,
    hasActiveFilters,
    queryArgs,
  };
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (the page.tsx and TransactionFilters will have type errors — that's expected, we fix them in Tasks 8-9)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-transaction-filters.ts
git commit -m "feat: add standard level and date preset state to transaction filters hook"
```

---

## Task 8: Update TransactionFilters UI

**Files:**
- Modify: `app/(dashboard)/admin/transactions/_components/TransactionFilters.tsx`

- [ ] **Step 1: Update the component interface and add new filter controls**

Replace the entire file:

```tsx
"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon, RotateCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DateRangePreset } from "@/lib/dateRangeUtils";
import { cn } from "@/lib/utils";

const PAYMENT_MODES = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "UPI",
  "Online",
] as const;

type PaymentMode = (typeof PAYMENT_MODES)[number];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface TransactionFiltersProps {
  academicYears: Array<{ _id: Id<"academicYears">; name: string }>;
  effectiveYearId: Id<"academicYears"> | undefined;
  onYearChange: (id: Id<"academicYears">) => void;
  campusFilter: string | undefined;
  onCampusChange: (campus: string | undefined) => void;
  paymentMode: PaymentMode | undefined;
  onPaymentModeChange: (mode: PaymentMode | undefined) => void;
  studentIds: Id<"students">[] | undefined;
  onStudentIdsChange: (ids: Id<"students">[] | undefined) => void;
  includeVoided: boolean;
  onIncludeVoidedChange: (val: boolean) => void;
  standardLevelId: Id<"standardLevels"> | undefined;
  onStandardLevelChange: (id: Id<"standardLevels"> | undefined) => void;
  dateRangePreset: DateRangePreset | undefined;
  onDateRangePresetChange: (preset: DateRangePreset | undefined) => void;
  selectedPeriod: { month?: number; year?: number; quarter?: number; half?: number };
  onSelectedPeriodChange: (period: { month?: number; year?: number; quarter?: number; half?: number }) => void;
  customDateFrom: number | undefined;
  onCustomDateFromChange: (ts: number | undefined) => void;
  customDateTo: number | undefined;
  onCustomDateToChange: (ts: number | undefined) => void;
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function TransactionFilters({
  academicYears,
  effectiveYearId,
  onYearChange,
  campusFilter,
  onCampusChange,
  paymentMode,
  onPaymentModeChange,
  studentIds,
  onStudentIdsChange,
  includeVoided,
  onIncludeVoidedChange,
  standardLevelId,
  onStandardLevelChange,
  dateRangePreset,
  onDateRangePresetChange,
  selectedPeriod,
  onSelectedPeriodChange,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  hasActiveFilters,
  onReset,
}: TransactionFiltersProps) {
  const campuses = useQuery(api.campus.list);
  const standardLevels = useQuery(api.standardLevels.list);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Academic Year */}
        <div className="space-y-1.5">
          <Label htmlFor="year-filter">Academic Year</Label>
          <Select
            value={effectiveYearId}
            onValueChange={(val) => onYearChange(val as Id<"academicYears">)}
          >
            <SelectTrigger id="year-filter" aria-label="Filter by academic year">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (
                <SelectItem key={y._id} value={y._id}>
                  {y.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Standard Level */}
        <div className="space-y-1.5">
          <Label htmlFor="level-filter">Standard Level</Label>
          <Select
            value={standardLevelId ?? "__all__"}
            onValueChange={(val) =>
              onStandardLevelChange(val === "__all__" ? undefined : (val as Id<"standardLevels">))
            }
          >
            <SelectTrigger id="level-filter" aria-label="Filter by standard level">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Levels</SelectItem>
              {standardLevels?.map((l) => (
                <SelectItem key={l._id} value={l._id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Preset */}
        <div className="space-y-1.5">
          <Label htmlFor="date-preset">Date Range</Label>
          <Select
            value={dateRangePreset ?? "__none__"}
            onValueChange={(val) => {
              const preset = val === "__none__" ? undefined : (val as DateRangePreset);
              onDateRangePresetChange(preset);
              if (preset && preset !== "custom") {
                const now = new Date();
                onSelectedPeriodChange({
                  month: now.getMonth(),
                  year: now.getFullYear(),
                  quarter: Math.ceil((now.getMonth() + 1) / 3),
                  half: now.getMonth() < 6 ? 1 : 2,
                });
              }
            }}
          >
            <SelectTrigger id="date-preset" aria-label="Select date range type">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All Dates</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="half-yearly">Half-Yearly</SelectItem>
              <SelectItem value="yearly">Full Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional sub-pickers for date preset */}
        {dateRangePreset === "monthly" && (
          <>
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select
                value={String(selectedPeriod.month ?? 0)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, month: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((label, i) => (
                    <SelectItem key={label} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={String(selectedPeriod.year ?? currentYear)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, year: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {dateRangePreset === "quarterly" && (
          <>
            <div className="space-y-1.5">
              <Label>Quarter</Label>
              <Select
                value={String(selectedPeriod.quarter ?? 1)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, quarter: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Apr–Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul–Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Oct–Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={String(selectedPeriod.year ?? currentYear)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, year: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {dateRangePreset === "half-yearly" && (
          <>
            <div className="space-y-1.5">
              <Label>Half</Label>
              <Select
                value={String(selectedPeriod.half ?? 1)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, half: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select half-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1 (Jan–Jun)</SelectItem>
                  <SelectItem value="2">H2 (Jul–Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={String(selectedPeriod.year ?? currentYear)}
                onValueChange={(val) =>
                  onSelectedPeriodChange({ ...selectedPeriod, year: Number(val) })
                }
              >
                <SelectTrigger aria-label="Select year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {dateRangePreset === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label>Date From</Label>
              <DatePicker
                value={customDateFrom ? new Date(customDateFrom) : undefined}
                onChange={(d) => onCustomDateFromChange(d?.getTime())}
                aria-label="Filter from date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date To</Label>
              <DatePicker
                value={customDateTo ? new Date(customDateTo) : undefined}
                onChange={(d) => onCustomDateToChange(d?.getTime())}
                aria-label="Filter to date"
              />
            </div>
          </>
        )}

        {/* Campus */}
        <div className="space-y-1.5">
          <Label htmlFor="campus-filter">Campus</Label>
          <Select
            value={campusFilter ?? "__all__"}
            onValueChange={(val) =>
              onCampusChange(val === "__all__" ? undefined : val)
            }
          >
            <SelectTrigger id="campus-filter" aria-label="Filter by campus">
              <SelectValue placeholder="All Campuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Campuses</SelectItem>
              {campuses?.map((c) => (
                <SelectItem key={c._id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Mode */}
        <div className="space-y-1.5">
          <Label htmlFor="payment-filter">Payment Mode</Label>
          <Select
            value={paymentMode ?? "__all__"}
            onValueChange={(val) =>
              onPaymentModeChange(
                val === "__all__" ? undefined : (val as PaymentMode),
              )
            }
          >
            <SelectTrigger id="payment-filter" aria-label="Filter by payment mode">
              <SelectValue placeholder="All Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Modes</SelectItem>
              {PAYMENT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Student Search */}
        <div className="space-y-1.5">
          <Label>Student</Label>
          <StudentSearch
            selectedIds={studentIds}
            onSelectionChange={onStudentIdsChange}
          />
        </div>

        {/* Show Voided Toggle + Reset */}
        <div className="flex items-end gap-4 pb-0.5">
          <div className="flex items-center gap-2">
            <Switch
              id="voided-toggle"
              checked={includeVoided}
              onCheckedChange={onIncludeVoidedChange}
              aria-label="Show voided sessions"
            />
            <Label htmlFor="voided-toggle" className="cursor-pointer text-sm">
              Show Voided
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            aria-label="Reset all filters"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DatePicker (unchanged) ────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
          aria-label={ariaLabel}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MMM d, yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Student Search (unchanged) ────────────────────────────────────────────

function StudentSearch({
  selectedIds,
  onSelectionChange,
}: {
  selectedIds: Id<"students">[] | undefined;
  onSelectionChange: (ids: Id<"students">[] | undefined) => void;
}) {
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(nameQuery);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nameQuery]);

  const results = useQuery(
    api.transactionLog.searchStudents,
    debouncedQuery.trim().length > 0 ? { nameQuery: debouncedQuery } : "skip",
  );

  const selectedCount = selectedIds?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            selectedCount === 0 && "text-muted-foreground",
          )}
          aria-label="Search and filter by student"
        >
          <Search className="mr-2 h-4 w-4" />
          {selectedCount > 0
            ? `${selectedCount} student${selectedCount > 1 ? "s" : ""} selected`
            : "Search student..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Type student name..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              aria-label="Student name search"
            />
          </div>
          <CommandList>
            {selectedCount > 0 && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    onSelectionChange(undefined);
                    setNameQuery("");
                  }}
                >
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            {debouncedQuery.trim().length > 0 && (
              <>
                <CommandEmpty>No students found.</CommandEmpty>
                <CommandGroup heading="Results">
                  {results?.map((student) => {
                    const isSelected =
                      selectedIds?.includes(student._id) ?? false;
                    return (
                      <CommandItem
                        key={student._id}
                        onSelect={() => {
                          const current = selectedIds ?? [];
                          if (isSelected) {
                            const next = current.filter(
                              (id) => id !== student._id,
                            );
                            onSelectionChange(
                              next.length > 0 ? next : undefined,
                            );
                          } else {
                            onSelectionChange([...current, student._id]);
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "mr-2 h-4 w-4 rounded border flex items-center justify-center text-xs",
                            isSelected
                              ? "bg-school-green border-school-green text-white"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <div>
                          <p className="text-sm">{student.studentFullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentNumber}
                          </p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` (will likely have errors from page.tsx not passing new props yet — that's Task 9)

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/admin/transactions/_components/TransactionFilters.tsx
git commit -m "feat: add standard level dropdown and date range preset UI to transaction filters"
```

---

## Task 9: Wire Everything in the Page + ExportButton

**Files:**
- Modify: `app/(dashboard)/admin/transactions/page.tsx`
- Modify: `app/(dashboard)/admin/transactions/_components/ExportButton.tsx`

- [ ] **Step 1: Update ExportButton to accept level and date range label**

Replace `ExportButton.tsx`:

```tsx
"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CSVSessionRow } from "@/lib/csvExport";
import {
  buildTransactionCSVRows,
  downloadCSV,
  generateCSVContent,
  generateTransactionFilename,
} from "@/lib/csvExport";

const CSV_HEADERS = [
  "Date",
  "Invoice #",
  "Student Name",
  "Admission #",
  "Campus",
  "Amount",
  "Payment Mode",
  "Status",
  "Collected By",
];

interface ExportButtonProps {
  sessions: CSVSessionRow[] | undefined;
  yearName: string;
  levelName?: string;
  dateRangeLabel?: string;
}

export function ExportButton({
  sessions,
  yearName,
  levelName,
  dateRangeLabel,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isEmpty = !sessions || sessions.length === 0;

  const handleExport = () => {
    if (!sessions || sessions.length === 0) return;

    setIsExporting(true);
    try {
      const rows = buildTransactionCSVRows(sessions);
      const content = generateCSVContent(CSV_HEADERS, rows);
      const filename = generateTransactionFilename(yearName, levelName, dateRangeLabel);
      downloadCSV(content, filename);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isEmpty || isExporting}
      aria-label="Export transactions as CSV"
    >
      {isExporting ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      Export CSV
    </Button>
  );
}
```

- [ ] **Step 2: Update `page.tsx` to wire new filter props**

In `app/(dashboard)/admin/transactions/page.tsx`, replace the `TransactionLogContent` function body. The key changes:

1. Pass new filter props to `TransactionFilters`
2. Pass `levelName` and `dateRangeLabel` to `ExportButton`
3. Read `standardLevelName` from the query result

```tsx
function TransactionLogContent() {
  const academicYears = useQuery(api.academicYears.list);
  const defaultYearId =
    academicYears && academicYears.length > 0
      ? academicYears[0]._id
      : undefined;

  const filters = useTransactionFilters(defaultYearId);
  const [selectedSession, setSelectedSession] =
    useState<Id<"feeCollectionSessions"> | null>(null);

  const data = useQuery(
    api.transactionLog.getTransactionLog,
    filters.queryArgs === "skip" ? "skip" : filters.queryArgs,
  );

  const sessions = data?.sessions;
  const aggregates = data?.aggregates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-school-green" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Transaction Log
            </h1>
            <p className="text-sm text-muted-foreground">
              View and filter all fee collection sessions
            </p>
          </div>
        </div>
        <ExportButton
          sessions={
            sessions as
              | Array<{
                  transactionDate: number;
                  invoiceNumber: string;
                  studentName: string;
                  studentNumber: string;
                  campus: string | null;
                  totalAmount: number;
                  paymentMode: string;
                  status: string;
                  collectedByName: string;
                }>
              | undefined
          }
          yearName={
            academicYears?.find((y) => y._id === filters.effectiveYearId)
              ?.name ?? ""
          }
          levelName={data?.standardLevelName ?? undefined}
          dateRangeLabel={filters.dateRangeLabel || undefined}
        />
      </div>

      {/* Filter Bar */}
      {academicYears && academicYears.length > 0 && (
        <TransactionFilters
          academicYears={academicYears}
          effectiveYearId={filters.effectiveYearId}
          onYearChange={filters.setAcademicYearId}
          campusFilter={filters.campusFilter}
          onCampusChange={filters.setCampusFilter}
          paymentMode={filters.paymentMode}
          onPaymentModeChange={filters.setPaymentMode}
          studentIds={filters.studentIds}
          onStudentIdsChange={filters.setStudentIds}
          includeVoided={filters.includeVoided}
          onIncludeVoidedChange={filters.setIncludeVoided}
          standardLevelId={filters.standardLevelId}
          onStandardLevelChange={filters.setStandardLevelId}
          dateRangePreset={filters.dateRangePreset}
          onDateRangePresetChange={filters.setDateRangePreset}
          selectedPeriod={filters.selectedPeriod}
          onSelectedPeriodChange={filters.setSelectedPeriod}
          customDateFrom={filters.customDateFrom}
          onCustomDateFromChange={filters.setCustomDateFrom}
          customDateTo={filters.customDateTo}
          onCustomDateToChange={filters.setCustomDateTo}
          hasActiveFilters={filters.hasActiveFilters}
          onReset={filters.resetAll}
        />
      )}

      {/* Summary Cards */}
      <SummaryCards aggregates={aggregates} />

      {/* Content: Skeleton → Empty → Table */}
      {data === undefined ? (
        <TransactionLogSkeleton />
      ) : sessions && sessions.length === 0 ? (
        <TransactionLogEmpty />
      ) : (
        <DataTable<SessionRow, unknown>
          columns={columns}
          data={(sessions ?? []) as unknown as SessionRow[]}
          searchPlaceholder="Search transactions..."
          pageSize={25}
          pageSizeOptions={[10, 25, 50]}
          onRowClick={(row) => setSelectedSession(row._id)}
        />
      )}

      {/* Session Detail Sheet */}
      <SessionDetailSheet
        sessionId={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify full build passes**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/admin/transactions/page.tsx app/\(dashboard\)/admin/transactions/_components/ExportButton.tsx
git commit -m "feat: wire standard level and date range filters into transaction log page"
```

---

## Task 10: Update `transactionLogUtils` FilterState Type

**Files:**
- Modify: `lib/transactionLogUtils.ts:42-50`
- Modify: `lib/transactionLogUtils.test.ts:73-137`

- [ ] **Step 1: Update FilterState type to include `standardLevelId`**

In `lib/transactionLogUtils.ts`, update the `FilterState` type:

```ts
export type FilterState = {
  academicYearId: string | undefined;
  dateFrom: number | undefined;
  dateTo: number | undefined;
  campusFilter: string | undefined;
  paymentMode: string | undefined;
  studentIds: string[] | undefined;
  includeVoided: boolean;
  standardLevelId: string | undefined;
};
```

Then update `isFilterActive` to check the new field — add before the final `return false`:

```ts
  if (current.standardLevelId !== defaults.standardLevelId) return true;
```

- [ ] **Step 2: Update tests to cover `standardLevelId`**

In `lib/transactionLogUtils.test.ts`, update the `defaults` object in the `isFilterActive` describe block:

```ts
  const defaults: FilterState = {
    academicYearId: "default-year-id",
    dateFrom: undefined,
    dateTo: undefined,
    campusFilter: undefined,
    paymentMode: undefined,
    studentIds: undefined,
    includeVoided: false,
    standardLevelId: undefined,
  };
```

Add a new test:

```ts
  it("returns true when standardLevelId is set", () => {
    expect(
      isFilterActive({ ...defaults, standardLevelId: "some-level-id" }, defaults),
    ).toBe(true);
  });
```

- [ ] **Step 3: Run tests**

Run: `npm test -- lib/transactionLogUtils.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add lib/transactionLogUtils.ts lib/transactionLogUtils.test.ts
git commit -m "feat: add standardLevelId to FilterState type and isFilterActive check"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Manual smoke test**

1. Start dev: `npm run dev` + `npx convex dev`
2. Navigate to Transaction Log page
3. Verify standard level dropdown appears and populates with all levels
4. Select a standard level → verify table filters correctly
5. Select "Monthly" preset → verify month/year pickers appear
6. Select "Quarterly" → verify quarter/year pickers appear
7. Select "Half-Yearly" → verify H1/H2 pickers appear
8. Select "Yearly" → verify date filters clear
9. Select "Custom" → verify date pickers appear
10. Export CSV with level filter → verify filename includes level name
11. Export CSV with date preset → verify filename includes date range
12. Reset all filters → verify everything clears
13. Verify existing filters (campus, payment mode, student, voided) still work
