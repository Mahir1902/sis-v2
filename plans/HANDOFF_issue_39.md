# Handoff — Issue #39 (Slice 6: Receipts list page `/receipts`)

**For the next session.** Read top to bottom, finish issue #39 in **one pass**. Scope is one Convex query + one new admin-gated list page. Single PR / single commit.

## TL;DR

- Issue #38 is **fully shipped** (cosmetic-edit `editReceipt` mutation + `CosmeticEditDialog`). Branch `feature/money-receipts` includes the commit. Tests 190/190, lint clean.
- Issue #39 adds the **top-level receipts list page**. Admin opens `/receipts`, filters by date range / student / status, clicks a row → goes to `/receipts/[receiptId]`.
- No schema change. No new tables, no new indexes. The two indexes you need already exist:
  - `receipts.by_status_and_payment_date` (`["status", "paymentDate"]`)
  - `receipts.by_student` (`["studentId"]`)
- `supersedes` / `supersededBy` are already on the row (schema lines 425-426). This slice just reads them; the badges they enable are wired in slice 9 (Void & Re-issue).

## State of the branch (start of next session)

- Branch: `feature/money-receipts`, HEAD = `feat(receipts): cosmetic-edit correction (issue #38)`.
- Dev deployment `hushed-bass-123.convex.cloud` has `getReceipt`, `getBySession`, `editReceipt`, `collectFees`. **No `listReceipts` yet.**
- Frontend:
  - `/receipts/[receiptId]` works — Email Receipt, Edit (cosmetic), Print buttons all live.
  - **`/receipts` (the list) does not exist yet** — that's this slice.
- Reusable pieces already in the codebase:
  - `components/DataTable.tsx` — TanStack Table wrapper used everywhere.
  - `app/(dashboard)/admin/transactions/page.tsx` — the closest existing pattern: `RoleGate` → content → filter hook → `useQuery` → DataTable. Mirror its shape; do NOT copy its query (different table).
  - `components/shared/RoleGate.tsx` — admin gating at the page level.
  - `lib/currency.ts` (`formatCurrency`), `lib/dateFormat.ts` (`fmtDayMonthYear`).
  - shadcn `DateRangePicker` / `Select` / `Combobox` primitives (check `components/ui/`).

## What issue #39 must do

Read `gh issue view 39` for the canonical spec. Summary:

**One new Convex query** — `convex/receipts.ts`:

```ts
listReceipts({
  dateRange: { start: number; end: number }, // paymentDate ms-epoch window
  studentId?: Id<"students">,
  status?: "issued" | "voided",
})
```

- `requireRole(ctx, ["admin"])` as the first line.
- Indexed reads — choose the index by which filter is most selective:
  - If `studentId` is provided → `withIndex("by_student", q => q.eq("studentId", studentId))`, then filter by `paymentDate` window and (optional) `status` in-memory on the narrow result.
  - Otherwise → `withIndex("by_status_and_payment_date", q => q.eq("status", status ?? "issued").gte("paymentDate", start).lte("paymentDate", end))`. Status is the index prefix, so if `status` is omitted we run two indexed reads (one for `"issued"`, one for `"voided"`) and merge — still bounded, no `.collect()` on the whole table.
- **Bound the result.** `.take(500)` per index read is plenty for a school-scale dataset and matches the existing patterns. Do NOT paginate in v1 unless you find perf issues — adding `usePaginatedQuery` is overkill for slice 6.
- Return each row as-is (it already includes `supersedes` / `supersededBy`). Don't strip them — the list reads those fields per the AC.
- No N+1: this is a single indexed read + sort. Do **not** fan out to `students` for names — `studentNameSnapshot` is already on the receipt row. That's the whole point of the snapshot model (ADR-0002).

**One new page** — `app/(dashboard)/receipts/page.tsx`:

- `RoleGate allowedRoles={["admin"]}` wrapping the content (mirror `app/(dashboard)/admin/transactions/page.tsx`).
- Filter toolbar in a `_components/ReceiptsFilters.tsx`:
  - **Date range picker** — default to current month. Use the same shadcn primitives the transactions page uses.
  - **Student picker** — Combobox over students (probably reuse the same query the transactions filter uses). Optional.
  - **Status select** — `All` / `Issued` / `Voided`. `All` = omit the param.
- Filter state in a small hook `hooks/use-receipts-filters.ts` mirroring `use-transaction-filters.ts`. Build the `queryArgs` object there so the page just calls `useQuery(api.receipts.listReceipts, filters.queryArgs)`.
- TanStack Table via `components/DataTable.tsx`. Columns in `app/(dashboard)/receipts/columns.tsx`:
  - Receipt # (`receiptNumber`)
  - Date (`paymentDate` via `fmtDayMonthYear`)
  - Student (`studentNameSnapshot` — sortable)
  - Payer (`payerName`)
  - Amount (`formatCurrency(totalAmount)`)
  - Status badge (`issued` green, `voided` red — use the existing status badge color palette in CLAUDE.md)
- **Row click → `router.push('/receipts/' + row._id)`**. Make the whole row a link target, not just one column.
- Loading skeleton, empty state with CTA (`"No receipts match these filters. Adjust the date range or clear filters."`), error state — per CLAUDE.md frontend rules.

**Sidebar entry** (small — easy to miss):
- Add a "Receipts" link to the admin sidebar so the page is reachable. Check `components/layout/` for the sidebar component. If the project doesn't link it, log a TODO instead — don't go down a refactor rabbit hole.

## Out of scope (do NOT touch)

- Pagination beyond `.take(500)`.
- Badging the `supersedes` / `supersededBy` chain visually — slice 9 ships that once `voidAndReissueReceipt` actually populates those fields. For slice 6, the query must return the fields; the columns can ignore them.
- `voidReceipt` / `voidAndReissueReceipt` mutations — separate slices.
- Exporting the list (CSV/PDF) — not in the AC.
- Adding more indexes — the two existing ones are sufficient.
- Receipt PDF / Email / Edit affordances on rows — those live on the detail page already.

## Suggested approach (one pass)

1. `gh issue view 39` to re-read the spec.
2. **Backend first.** Add `listReceipts` to `convex/receipts.ts`. Test it in the Convex dashboard by running it with various filter combos against existing data on `hushed-bass-123`.
3. **Frontend.** Build the filter hook, then the toolbar, then `columns.tsx`, then `page.tsx`. Keep the columns file thin — no business logic.
4. **Run** `npm test && npm run lint && npm run build`. Must all pass.
5. **Manual Playwright verification:**
   - Log in as admin → navigate to `/receipts` → see the table populated with existing receipts.
   - Set date range to last 7 days → list narrows.
   - Pick a student in the picker → list narrows further.
   - Set status = Voided → list shows the voided rows (if any exist; if not, switch to a status that has rows).
   - Click a row → lands on `/receipts/[receiptId]` with the Receipt PDF rendered.
   - Empty state: pick a date range that has no receipts → see CTA copy.
6. **Run `graphify update .`** before committing so the new code is indexed for the next session.
7. Single commit: `feat(receipts): list page with filter toolbar (issue #39)`.

Time budget: 90–120 minutes. If past 2.5h, stop and ask.

## Key references

- `convex/schema.ts` lines 378-431 — receipts table + indexes.
- `app/(dashboard)/admin/transactions/page.tsx` — closest existing list-page pattern. Page shape, hook pattern, DataTable usage.
- `hooks/use-transaction-filters.ts` — pattern for the filter hook.
- `convex/receipts.ts` — where the new query lives. Existing `getReceipt`/`getBySession`/`editReceipt` show the style.
- `components/DataTable.tsx` — TanStack wrapper.
- ADR-0002 — snapshot model. Don't join receipts to students; use `studentNameSnapshot`.
- CLAUDE.md → "STATUS BADGE COLORS" — green for issued, use a red palette for voided.

## Conventions still in force

- No `any`. Use `Doc<"receipts">` / `Id<"students">` from `convex/_generated/dataModel`.
- Brand colors: `bg-school-green`, `text-school-yellow`. No hardcoded hex.
- shadcn primitives for everything shadcn covers.
- Sonner toast on any mutation success/error (this slice is read-only — likely no toast needed).
- TDD for any pure utility (e.g. filter-arg builder). The Convex query is exercised through the UI flow + Convex dashboard.
- No N+1 in the query. Single indexed read; do not fan out to other tables.
- Mobile-first — the filter toolbar should stack on 375px.

## Hand-off to the slice after this

Once #39 ships, the natural next slice is `voidReceipt` (issue likely numbered after #39 — check the board). That slice will start populating `supersededBy`, after which slice 9 can wire the chain badges on the list view shipped here.
