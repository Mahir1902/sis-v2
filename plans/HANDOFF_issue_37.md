# Handoff — Issue #37 (Money Receipts, Phase 2: Business Logic)

**For the next session.** Issue #36 (Phase 1 — Schema) shipped as two commits on `feature/money-receipts`:

- `e16bb87` — widen schema, add `receipts` + `receiptCounters` tables, add migrations
- `38d919e` — narrow schema, drop `invoiceNumber` + `partial`, clean up readers

This document orients a fresh agent on where to pick up. **It deliberately does not restate decisions already written elsewhere — read the linked artifacts.**

## State of the branch (start of next session)

- Branch: `feature/money-receipts`, HEAD = `38d919e`.
- Dev deployment `hushed-bass-123.convex.cloud` already has:
  - `receipts` and `receiptCounters` tables defined (empty — no rows ever inserted yet).
  - `feeCollectionSessions.invoiceNumber` field gone, `by_invoice` index gone.
  - `studentFees.status` two-state, every row already `"paid"` or `"unpaid"`.
- `convex/feeCollectionSessions.ts:collectFees` returns `{ sessionId, totalAmount, transactions }` (no `receiptNumber` yet — that's your job to wire up).
- `lib/migratePartialStatus.ts` carries over from Phase 1 and is still used by `lib/feeCollectionUtils.ts` (and the test file). Don't touch it in Phase 2.
- `lib/resolveBillingContact.ts`, `lib/composeEmailUrl.ts`, `lib/currency.ts`, `lib/dateFormat.ts`, `lib/schoolBrand.ts`, both logo assets — all carryover, untouched.
- Verification at end of Phase 1: `npx convex dev --once`, `npx tsc --noEmit`, `npm run lint` (178 files), `npm test` (13 files / 143 tests), `npm run build` (15 routes), `npm run test:e2e` (7 passed / 15 skipped) — all green.

## Read these first (full context — do not paraphrase, read them)

1. **`docs/adr/0002-receipt-first-billing-no-invoicing.md`** — the receipt-first model. Authoritative.
2. **`docs/adr/0003-receipt-corrections-edit-void-reissue.md`** — the three-mutation correction model and the `supersedes` / `supersededBy` cross-link semantics. Authoritative.
3. **`TASK_LOG.md`** — scroll to the bottom. The section *"Issue #36 — Phase 1: Schema (2026-06-09)"* documents what shipped, the dev migration results, every decision made, and the Phase 2 hand-off bullets.
4. **`plans/HANDOFF_money_receipts.md`** — Phase 2 section starts at line 66. High-level shape of the backend phase; this document is the fine detail.
5. **`plans/HANDOFF_money_receipts_implementation.md`** — grilling-session decisions 5+ are the runtime-layer ones relevant to Issue #37.
6. **`plans/HANDOFF_issue_36.md`** — what Phase 1 was and wasn't. Read for the Devil's Advocate landmines that may still bite Phase 2.
7. **`CONTEXT.md`** — domain glossary (Receipt, Re-issue, Billing Contact, Fee Collection Session, Student Fee). Use this language in code, mutations, error messages, audit-log descriptions, and tests.
8. **`CLAUDE.md`** — the agent workflow and project conventions. Still in force. Do not skip the review gates.

## What Issue #37 must do (one-line summary per the long-form spec)

A backend-only PR — no UI, no PDF rendering. Five discrete pieces of work:

1. **`lib/receiptNumber.ts`** — pure helper that formats `RCP-YYYY-NNNNN` given `(year, sequence)`. TDD candidate. Cases: zero-padding to 5 digits, year as 4-digit string, edge cases around year transition (e.g. is "year" the calendar year of the payment, or of the moment the receipt was issued? — clarify in the unit test, lock it down).

2. **Refactor `collectFees`** in `convex/feeCollectionSessions.ts` to atomically:
   - Allocate the receipt number by reading-then-incrementing the `receiptCounters` doc for the current calendar year (`Number(new Date().getFullYear())`). Create the counter doc on first use of a new year (insert with `nextNumber: 2`, use 1 for the receipt being issued). All inside the same mutation as the session/transaction writes so Convex's per-document serialization gives race safety.
   - Insert one `receipts` row snapshotting every parent-visible PDF field. Use `lib/resolveBillingContact.ts` to pick `payerName` and `payerRole` from `students.primaryBillingContact`. Snapshot `studentNameSnapshot`, `studentNumberSnapshot`, `issuerName` (the collecting user's `name`), and the `lineItems` array (one entry per `studentFee` covered, with `feeStructureName`, `billingPeriod`, `originalAmount`, sum of applied discount amounts, and `paidAmount` for this transaction).
   - Decide whether to add a `standardLevelSnapshot` field for the PDF header — TASK_LOG and ADR-0002 don't require it; either snapshot it (requires a schema widen first, separate widen-migrate-narrow cycle for one field — probably overkill) or render the standard level from the live join at PDF time (acceptable because Standard Level renames are rare and not financial). **Recommendation:** skip the snapshot; render from live join in the Phase 3 PDF component. Document the decision in the Phase 2 TASK_LOG entry.
   - Re-add the Receipt identifier to the return value: `{ sessionId, receiptId, receiptNumber, totalAmount, transactions }`.
   - Update `app/(dashboard)/students/[studentId]/_components/CollectFeesDialog.tsx` to read `result.receiptNumber` and surface it: `Payment recorded. Receipt: RCP-YYYY-NNNNN. Total: ৳N`.

3. **Three correction mutations in a NEW `convex/receipts.ts` file** (per ADR-0003):
   - **`editReceipt`** — admin-only, `requireRole(ctx, ["admin"])`. Args: `{ receiptId, payerName?, payerRole?, remarks? }`. Patches ONLY cosmetic fields. Financial snapshot fields (lineItems, totalAmount, paymentMethod, paymentDate) MUST be rejected at the arg-validator level. Audit-log entry with `action: "update"`, `entityType: "receipts"`, description summarising which cosmetic fields changed.
   - **`voidReceipt`** — admin-only. Args: `{ receiptId, reason: string }`. Flips Receipt to `"voided"` with `voidedAt: Date.now()` and `voidedBy: user._id`. Flips the underlying Session to `"voided"`. For every `studentFee` covered by the Session's `feeTransactions`: subtract the transaction's `amount` from `fee.paidAmount`, add it back to `fee.balance`, flip `status` to `"unpaid"`, remove the matching `paymentDetails` entry. NO `supersedes`/`supersededBy` is set. Audit-log entry with `action: "void"`, `entityType: "receipts"`.
   - **`voidAndReissueReceipt`** — admin-only. Args: equivalent to `voidReceipt` + a fresh `collectFees`-shaped payload (`feeIds`, `paymentMode`, `remarks`, plus any cosmetic changes that motivated the re-issue). Atomically: voids the old Receipt (without writing audit yet), runs the equivalent of `collectFees` to create a new Session + Receipt + Transactions, writes `supersedes` on the new Receipt pointing at the old one, writes `supersededBy` on the old Receipt pointing at the new one. Then writes ONE audit-log entry covering the re-issue (referencing both receipt IDs in metadata).

4. **`getReceiptById` query in `convex/receipts.ts`** — admin-only. Returns the full snapshot plus resolved `supersedes` / `supersededBy` receipt numbers (point lookups via `ctx.db.get(supersedesId)` — no scan, no index needed). Returns `null` for missing IDs (frontend renders an error state).

5. **Tests** — both Convex mutations (`convex-test`) and the pure helper (vitest):
   - `lib/receiptNumber.test.ts` — pad-zero, year format, sequence > 99999 behavior (fail loudly? wrap? document the decision).
   - `convex/receipts.test.ts` — uses `convex-test` to spin up an in-memory deployment. Cover: editReceipt rejects financial-field mutation attempts; voidReceipt correctly reverses balances across multiple covered fees; voidAndReissueReceipt sets both `supersedes` and `supersededBy` in one mutation; counter doc is created on first 2027 receipt (or whatever year is next).
   - Counter race semantics: hard to test directly. Document the invariant ("read-then-write inside the same mutation; Convex serialises per-doc") in the `collectFees` JSDoc and in the test file's preamble. Don't try to force a race — Convex's runtime guarantees it.

## Open landmines flagged for the Devil's Advocate Agent (re-read before approving Phase 2)

- **Counter race ordering.** The counter doc is read-then-incremented inside `collectFees`. If two concurrent `collectFees` mutations both touch the SAME counter doc, Convex retries one of them (its OCC) — the loser sees the post-write state, increments again, gets `nextNumber + 1`. Numbers are monotonic but not contiguous in time across collectors. That's the expected behaviour. **Verify** in the `collectFees` JSDoc that this is documented so future readers don't try to fix the "non-determinism."
- **Counter doc creation race.** First receipt of a new year: two concurrent mutations both see no counter doc, both try to insert. Convex's OCC kicks in — the second one fails with a conflict on `by_year`, retries, sees the now-existing doc, increments. Verify the code reads the doc again after the first insert attempt fails, rather than swallowing the error.
- **voidReceipt edge case: studentFees edited after payment.** If an admin applied a discount to a `studentFee` AFTER the Receipt was issued, the Receipt's `lineItems` snapshot is now stale relative to the live fee. Voiding the Receipt must restore the LIVE fee balance to what it was at issue time MINUS the post-issue discount, which is non-trivial. **Decision needed**: either (a) refuse to void if the live fee has been edited since payment (safest), or (b) trust the transaction log as the source of truth and restore using `feeTransactions` amounts only (matches the schema invariant). Lean toward (b) but document the decision.
- **voidReceipt edge case: subsequent payment on the same fee.** If a Receipt covers `studentFee` X, then a SECOND payment is collected on X (new Session, new Receipt, X is `"paid"`), then the first Receipt is voided — X cannot flip back to `"unpaid"` because the second payment still applies. **Decision needed**: refuse to void if the covered fees have other completed transactions after this Session's `transactionDate`. Almost certainly the right call. Document.
- **voidAndReissueReceipt under retry.** Convex retries mutations on OCC. If the void half succeeds but the re-issue half fails, the retry sees the Receipt already voided. Make the mutation idempotent by checking lifecycle state up front (if `supersededBy` is already set, throw "already re-issued"; if `status === "voided"` but no `supersededBy`, this is a normal void — distinguish carefully).
- **Audit-log entity type.** Existing audit logs use `entityType: v.string()` (unbounded). Phase 2 introduces `entityType: "receipts"` — that's fine, no schema change. **But** verify Phase 1's `collect_fees` audit entries still write `entityType: "feeCollectionSessions"` — Phase 2 should NOT retro-relabel them; the Session is still the underlying domain object, the Receipt is the document. Add `entityType: "receipts"` for Receipt-level actions (edit, void, re-issue) only.
- **Toast UX when receipt number includes the year.** The `RCP-2026-00001` string is long. Verify the toast doesn't truncate on mobile. Use Sonner's `description` slot if needed.
- **`feeTransactions.createTransaction` regression check.** The Phase 1 mutation throws on partial payments (`args.amount < fee.balance`). Phase 2's `collectFees` calls into `db.insert("feeTransactions", ...)` directly (not via the mutation), so the guard doesn't run there. If Phase 2 introduces ANY new caller of `createTransaction`, verify it doesn't pass partial amounts. The receipt-first invariant must hold across the whole codebase.

## Required skills (invoke as relevant)

- **`writing-plans`** (or `superpowers:writing-plans`) — turn this handoff into a sub-tasked plan with explicit ownership (Backend Agent / Backend Review Agent) before touching code. There are easily 8–10 atomic sub-tasks here; don't try to land them as one commit.
- **`tdd`** — the receipt-number helper is THE TDD candidate. Write failing tests, watch them go green. Two test files (one pure-fn, one Convex mutation) follow the same red→green→refactor cadence.
- **`convex`** (umbrella) — routes to `convex-functions` for mutation/query patterns and to `convex-create-component` if you discover a logical sub-component (unlikely for this issue).
- **`convex-performance-audit`** — run the checklist on `getReceiptById` (point lookups should be O(1); the supersedes resolution is two extra `ctx.db.get` calls per read — fine, not a hot path). Also confirm `voidReceipt`'s scan over a session's `feeTransactions` uses the `by_session` index.
- **`grill-with-docs`** — only if a design question surfaces that isn't already answered in ADR-0002, ADR-0003, or this handoff. Specifically: if you're unsure about the voidReceipt edge cases above, grill against CONTEXT.md and the ADRs before writing code.
- **`commit`** — for the per-sub-task commits. Aim for 3–5 commits (helper + tests, collectFees refactor + toast update, three correction mutations, getReceiptById + tests). Don't squash into one commit — each piece is independently reviewable.
- **`verify`** — at the end, drive `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npx convex dev --once` before declaring done.

## Out of scope (do NOT touch in Issue #37)

- **Receipt PDF document** (`components/shared/ReceiptDocument.tsx`) — Phase 3.
- **`/receipts` admin list page** — Phase 3.
- **Three action buttons** on the Receipt sheet (Compose Email, Send via WhatsApp, Void/Re-issue) — Phase 3.
- **WhatsApp launcher** (`lib/whatsappLaunchUrl.ts`) — Phase 3.
- **Phone normalisation** (`lib/normalizeBdPhone.ts`) — Phase 3.
- **Compose Email launcher integration** — Phase 3. The `lib/composeEmailUrl.ts` helper is already in place but Phase 2 does not wire it up.
- **`/overdue` list** — Phase 3.
- **Sidebar nav entry** for Receipts — Phase 3 (it'll need icon + route + role gate, none of which exist yet).

If the next session finds itself touching any of those files, it has stepped outside Issue #37's scope — stop, re-read this doc and TASK_LOG.md, and confirm with the user before continuing.

## Conventions (from CLAUDE.md — non-negotiable)

- Planning → Devil's Advocate → Backend → Backend Review for every sub-task. Review gates are mandatory; the Backend Review Agent must approve every Convex change before it's marked `[x]` in TASK_LOG.md.
- Every Convex mutation calls `requireRole()` first. (`getReceiptById` is a query — `requireRole(ctx, ["admin"])` is still the right gate for v1; widen to teacher/student later if needed.)
- Schema-driven types: read `Doc<"receipts">` etc. from `convex/_generated/dataModel.d.ts`, never re-declare.
- No `any`, no hardcoded hex. Brand colors `bg-school-green`, `text-school-yellow` (not relevant in Issue #37 — backend only — but still in force).
- Update `TASK_LOG.md` at the start and end of every sub-task. Mark `[x]` only after the relevant review agent approves.

## Hand-off to Phase 3 (Issue #38+)

Once Phase 2 ships, the next phase wires the UI:
- `components/shared/ReceiptDocument.tsx` — print-styled React component that renders a Receipt from `Doc<"receipts">` snapshot fields only (no live joins for parent-visible content). Cross-link banner reading "Re-issued in place of RCP-YYYY-NNNNN" or "VOIDED — superseded by RCP-YYYY-NNNNN" when `supersedes` / `supersededBy` are set.
- `app/(dashboard)/receipts/page.tsx` — admin list with the same filter toolbar shape as `/admin/transactions`. Status tabs: All / Issued / Voided. Search by `receiptNumber` or student name.
- `app/(dashboard)/overdue/page.tsx` — computed live (no stored status). Query: `studentFees` where `status === "unpaid"` AND `dueDate < now()`.
- Action buttons on the Receipt preview Sheet: Compose Email (via `composeEmailUrl`), Send via WhatsApp (via `whatsappLaunchUrl` — to be created), Edit, Void, Void & Re-issue.
- Sidebar nav entry for Receipts under the admin section.
- Phone normalisation helper (`lib/normalizeBdPhone.ts` — TDD candidate, BD numbers `01XXXXXXXXX` → `8801XXXXXXXXX`).

That handoff document will be written at the end of Issue #37 once the backend ground truth is settled.
