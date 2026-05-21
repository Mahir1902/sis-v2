# Transaction Log: Standard Level Filter + Date Range Presets

**Date**: 2026-05-18
**Status**: Approved
**Approach**: Denormalize `standardLevelId` onto `feeCollectionSessions` (Approach 2)

---

## Problem

Admins need to download transaction logs filtered by standard level (e.g., "all Grade 6 payments this month") and by common date ranges (monthly, quarterly, half-yearly, yearly). Currently the transaction log only supports filtering by academic year, campus, payment mode, student, date range (custom), and voided status. There is no way to filter by class/level or use preset date ranges.

## Design

### 1. Schema Change

Add `standardLevelId` to `feeCollectionSessions` as an optional field (for backward compatibility with existing records) and a compound index for efficient filtering.

```ts
// convex/schema.ts — feeCollectionSessions
standardLevelId: v.optional(v.id("standardLevels")),

// new index
.index("by_year_level", ["academicYear", "standardLevelId"])
```

### 2. Data Migration

A one-time Convex action (`backfillSessionStandardLevels`) that:

1. Queries all `feeCollectionSessions` where `standardLevelId` is `undefined`
2. For each session, looks up the student's enrollment for that session's `academicYear`
3. Patches the session with `standardLevelId` from the enrollment
4. Falls back to the student's current `standardLevel` field if no enrollment exists
5. Processes in batches to stay within Convex action limits

### 3. Mutation Update

In `convex/feeCollectionSessions.ts` — `collectFees` mutation:

The enrollment is already fetched at line 67-74. Add `standardLevelId` to the session insert:

```ts
standardLevelId: enrollment?.standardLevelId ?? student.standardLevel,
```

### 4. Query Update

In `convex/transactionLog.ts` — `getTransactionLog` query:

- New arg: `standardLevelId: v.optional(v.id("standardLevels"))`
- When `standardLevelId` is provided, filter sessions to only those matching that level
- Also batch-fetch the `standardLevels` table to return `standardLevelName` per session (for filename generation)
- Add a new query `getStandardLevels` (or reuse existing) to populate the filter dropdown

### 5. Date Range Presets

New UI component in the filter bar with a mode selector:

| Preset | Sub-picker | Computes |
|--------|-----------|----------|
| Monthly | Month + Year | 1st → last day of selected month |
| Quarterly | Q1/Q2/Q3/Q4 + Year | 3-month boundaries (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec) |
| Half-yearly | H1/H2 + Year | Jan-Jun or Jul-Dec |
| Yearly | None (clears date filter) | Full academic year coverage |
| Custom | Two date pickers | User-selected dateFrom/dateTo |

Preset selection computes `dateFrom` and `dateTo` as Unix timestamps and passes them to the existing query args. The custom option preserves the current behavior.

### 6. Filter Hook Changes

In `hooks/use-transaction-filters.ts`:

- New state: `standardLevelId: Id<"standardLevels"> | undefined`
- New state: `dateRangePreset: "monthly" | "quarterly" | "half-yearly" | "yearly" | "custom" | undefined`
- New state: `selectedPeriod` (stores the specific month/quarter/half selection)
- `dateFrom`/`dateTo` are computed from preset + selectedPeriod (or set directly for custom)
- `hasActiveFilters` updated to include `standardLevelId`
- `queryArgs` updated to include `standardLevelId`
- `resetAll` clears the new fields

### 7. CSV Export Changes

In `lib/csvExport.ts`:

- `generateTransactionFilename` updated to accept optional `levelName` and `dateRangeLabel`
- Filename format: `transactions-{levelName}-{dateRange}-{yearName}.csv`
  - With level filter: `transactions-Grade-6-May-2026-2025-2026.csv`
  - Without level filter: `transactions-All-May-2026-2025-2026.csv`
  - With yearly preset: `transactions-Grade-6-2025-2026.csv`
- No new CSV column (level is conveyed by filename per user preference)

### 8. UI Components

**Standard Level Dropdown** (in `TransactionFilters.tsx`):
- Fetches all standard levels via `useQuery`
- Shows as a Select dropdown with "All Levels" as default
- Placed alongside existing filter controls

**Date Range Preset Selector** (in `TransactionFilters.tsx`):
- A segmented control or Select with the 5 preset options
- Conditionally renders sub-pickers based on selected preset:
  - Monthly: month+year selectors
  - Quarterly: quarter+year selectors
  - Half-yearly: half+year selectors
  - Yearly: no sub-picker
  - Custom: existing date pickers (from/to)

## Edge Cases

- Sessions with no matching enrollment during backfill: fall back to `student.standardLevel`
- Students deleted after payment: `standardLevelId` already stored, no lookup needed
- Leap year February: use `date-fns` `endOfMonth` for correct month boundaries
- Academic year spanning two calendar years: presets use calendar year, not academic year
- Empty results for a level+date combo: existing empty state UI handles this

## Testing

- Unit tests for date range computation (month/quarter/half boundaries)
- Unit tests for CSV filename generation with level and date range
- Backend tests for the migration action
- Backend tests for the query with `standardLevelId` filter
- Manual testing of filter UI interactions and CSV download
