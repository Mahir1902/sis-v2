# Handoff — Issue #36 (Money Receipts, Phase 1: Schema)

**For the next session.** Issue #35 (Phase 0 — Invoice domain rip-out) shipped on commit `7ffb09f` on branch `feature/money-receipts`. This document orients a fresh agent on where the work left off and where to look for full context. **It deliberately does not restate decisions already written elsewhere — read the linked artifacts.**

## State of the branch (start of next session)

- Branch: `feature/money-receipts`, one commit ahead of where this conversation started (`7ffb09f`).
- The Invoice domain is gone from the codebase. No `convex/invoices.ts`, no `app/(dashboard)/invoices/`, no `lib/invoice*`, no `Id<"invoices">` references, no invoice-related cron, no invoice-related PDF components.
- `convex/schema.ts` no longer has the `invoices` table. **`feeCollectionSessions.invoiceNumber` and its `by_invoice` index are still there** — they are Issue #36's job to remove via widen-migrate-narrow.
- `studentFees.status` still accepts `"partial"`. Same story — Issue #36's job to narrow.
- All carryover helpers preserved: `lib/composeEmailUrl.ts`, `lib/currency.ts`, `lib/dateFormat.ts`, `lib/schoolBrand.ts`, `lib/resolveBillingContact.ts`, `lib/applyBillingContactBackfill.ts`, both logo assets.
- Verification at end of #35: `npm run build` (16 routes), `npm run lint` (177 files, 0 errors), `npm test` (vitest 138/138), `npm run test:e2e` (Playwright 7 passed / 15 skipped / 0 failed, smoke 6/6).

## Read these first (full context — do not paraphrase, read them)

1. **`TASK_LOG.md`** — scroll to the bottom. The last two sections are *"Issue #35 — Phase 0: Money Receipts Rip-Out (2026-06-09)"* and *"▶ HANDOFF TO ISSUE #36 (Phase 1 — Schema)"*. The latter contains the complete Phase 1 sub-task list with exact field names, indexes, widen-migrate-narrow steps, and Devil's Advocate prompts. **It is the implementation contract.**
2. **`docs/adr/0002-receipt-first-billing-no-invoicing.md`** — the receipt-first model. Authoritative.
3. **`docs/adr/0003-receipt-corrections-edit-void-reissue.md`** — the three-mutation correction model (edit / void / void-and-reissue) and the `supersedes` / `supersededBy` cross-link.
4. **`CONTEXT.md`** — domain glossary (Receipt, Overdue Fee, Billing Contact, Fee Collection Session, Student Fee, WhatsApp Reminder, Compose Email). The Receipt entry codifies the full-snapshot rule and the Re-issue term. **Use this language in code, schema, error messages, and tests.**
5. **`plans/HANDOFF_money_receipts.md`** — original Phase 0–4 plan. The Phase 1 section is the high-level shape; `TASK_LOG.md`'s Issue #36 block has the fine detail.
6. **`plans/HANDOFF_money_receipts_implementation.md`** — the grilling-session decisions 1–4 are the schema-layer ones relevant to Issue #36 (everything else is later phases).
7. **`CLAUDE.md`** — the agent workflow and project conventions. Still in force. Do not skip the review gates.

## What Issue #36 must do (one-line summary per the long-form spec)

A schema-only PR — no business logic, no UI. Three discrete changes:

1. **Add `receipts` table** with snapshot fields + cross-link fields (see `TASK_LOG.md` Issue #36 block for exact validators and indexes).
2. **Add `receiptCounters` table** — one doc per year for atomic `RCP-YYYY-NNNNN` numbering.
3. **Drop `feeCollectionSessions.invoiceNumber` + `by_invoice` index** via widen-migrate-narrow (also delete `generateInvoiceNumber()` from `lib/feeCollectionUtils.ts` as part of the narrow step).
4. **Narrow `studentFees.status`** from `("unpaid","partial","paid")` to `("unpaid","paid")` via widen-migrate-narrow. Audit and delete every `"partial"` reader — **do not coalesce**.

Do **not** add `cancelled` to `studentFees.status`. Do **not** add any backend mutations, queries, or frontend in this PR — those are Phase 2 and Phase 3.

## Open landmines flagged for the Devil's Advocate Agent (re-read before approving Phase 1)

- Concurrent `collectFees` calls racing on the `receiptCounters` doc — verify the counter read-then-write happens inside the same mutation, never outside.
- Existing prod `feeCollectionSessions` rows with `invoiceNumber` currently set — the widen step (making it optional) is safe; the narrow step (removing it) fails if any row still carries the field, so the migration must scrub every row first.
- Existing `studentFees` rows with `status === "partial"` — query the dashboard before deploying. If zero in dev, the migration is a no-op; if any, decide on a per-row basis whether to flip to `unpaid` or `paid` based on `paidAmount` vs `originalAmount - sum(appliedDiscounts.amount)`.
- Audit-log entries referencing `entityType === "invoices"` — probably none (no real Invoice usage ever shipped), but grep `auditLogs` before assuming.

## Suggested skills (invoke as relevant)

- **`writing-plans`** (or `superpowers:writing-plans`) — turn the TASK_LOG Issue #36 block into a sub-tasked plan with explicit ownership (Backend Agent / Backend Review Agent) before touching code. The block is detailed but not yet broken into review-gated atomic tasks.
- **`convex-migration-helper`** — this is **the** skill for Issue #36. The schema reshape requires two separate widen-migrate-narrow cycles (`feeCollectionSessions.invoiceNumber`, `studentFees.status='partial'`). The skill walks through each phase, the deploy gate, and rollback safety. Do not freelance these.
- **`convex`** (umbrella) — secondary; routes to `convex-functions` etc. if the migration scripts need helper queries.
- **`convex-performance-audit`** — after the schema lands, run the checklist mentally on the proposed `receipts` indexes to confirm `by_supersedes` is not needed for v1 (it isn't until Phase 2's `listReceipts` exists).
- **`tdd`** — for the migration's transformation logic (e.g., `partial → paid|unpaid` decision rule). Write a unit test on a pure function before wiring it into a Convex migration.
- **`grill-with-docs`** — only if a design question surfaces that isn't already answered in ADR-0002, ADR-0003, or the two HANDOFFs. The Receipt model has been thoroughly grilled; do not re-litigate.
- **`commit`** — for the commit at the end of each widen / migrate / narrow step. Three commits expected, not one, because the Convex deploys gate them.
- **`verify`** — at the end, drive `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npx convex dev --once` before declaring done.

## What this handoff intentionally does NOT cover

- Receipt **business logic** (counter allocation, `collectFees` refactor, the three correction mutations) — Phase 2 / Issue #37+.
- Receipt **UI** (`ReceiptDocument.tsx`, `/receipts` list, `/overdue` list, action buttons + launcher disabled-state tooltips) — Phase 3.
- Phone normalisation (`lib/normalizeBdPhone.ts`) and WhatsApp launcher (`lib/whatsappLaunchUrl.ts`) — Phase 3.
- BD-year helper (`lib/receiptNumber.ts`) — Phase 2 (used by `collectFees`), but the helper itself is a pure-function TDD candidate.

If the next session finds itself touching any of those files, it has stepped outside Issue #36's scope — stop, re-read this doc and `TASK_LOG.md`, and confirm with the user before continuing.

## Conventions (from CLAUDE.md — non-negotiable)

- Planning → Devil's Advocate → Backend → Backend Review → (no Frontend in this issue) — review gates are mandatory; the Backend Review Agent must approve every Convex change before it's marked `[x]` in TASK_LOG.md.
- Every Convex mutation calls `requireRole()` first. (Note: a migration doesn't necessarily — internal mutations bypass it because they're not user-callable. Verify per `@convex-dev/migrations` patterns.)
- No `tailwind.config.ts`. No `any`. No hardcoded hex.
- Brand: `bg-school-green`, `text-school-yellow` (not relevant in Issue #36 — schema only — but still in force).
- Update `TASK_LOG.md` at the start and end of every sub-task. Mark `[x]` only after the relevant review agent approves.
