# Handoff — Money Receipts implementation

**For the next session.** Implementation of the receipt-first billing model agreed in this conversation.

## Read these first (do not skip)

1. [`docs/adr/0002-receipt-first-billing-no-invoicing.md`](../docs/adr/0002-receipt-first-billing-no-invoicing.md) — the architectural decision. Read in full.
2. [`CONTEXT.md`](../CONTEXT.md) — domain glossary, just rewritten. Terms (Receipt, Overdue Fee, WhatsApp Reminder, Compose Email, Fee Collection Session, Student Fee, Billing Contact) and their relationships.
3. [`docs/adr/0001-invoice-delivery-launcher-architecture.md`](../docs/adr/0001-invoice-delivery-launcher-architecture.md) — superseded but the **launcher pattern** (write-nothing UI, manual PDF attach, no provider creds) survives and applies to Receipt delivery + WhatsApp reminders. Read the launcher reasoning; ignore Invoice-specific framing.

These three documents are the contract. Everything in this handoff is implementation logistics, not domain decisions — do not re-litigate the decisions without going back to the user.

## Current branch state

- Branch: `feature/invoicing` — **local only, no remote ref**.
- 4 commits ahead of `main`, 189 files changed, ~19k lines added.
- All under the deprecated Invoice model that ADR-0002 supersedes.
- User has not pushed anything; we have full freedom to rewrite this branch.

## Execution plan

### Phase 0 — Branch hygiene
1. Rename `feature/invoicing` → `feature/money-receipts`.
2. Single "rip out invoicing" commit that deletes the Invoice domain (see Carryover Audit below). Do not preserve `invoices` table data — there is none in real use.

### Carryover audit (keep these — they survive ADR-0002 unchanged)

**Schema (in `convex/schema.ts`):**
- `students.fatherEmail`, `motherEmail`, `guardianEmail` (optional). Already exist; keep.
- `students.primaryBillingContact` union. Already exists; keep.

**`convex/students.ts`:** the BillingContact-related additions stay.

**`lib/` helpers — keep:**
- `composeEmailUrl.ts` + test — Gmail launcher URL builder, exact same role for Receipts.
- `currency.ts` + test
- `dateFormat.ts` + test
- `schoolBrand.ts`
- `resolveBillingContact.ts` + test — picks father/mother/guardian from `primaryBillingContact`.
- `applyBillingContactBackfill.ts` + test — already-run migration; safe to keep.

**Assets:** `public/SIS_Logo.png`, `public/SIS_Logo.svg`.

**Hooks — repurpose (do not delete blindly):**
- `use-invoice-pdf-download.tsx` — generic PDF download via `react-pdf`; rename to `use-receipt-pdf-download.tsx`.
- `use-invoice-preview.ts` — generic preview modal state; rename.

### Delete (Invoice-domain only)

- `convex/invoices.ts`
- `invoices` table from `convex/schema.ts` and any `invoiceId` references on `studentFees`
- `app/(dashboard)/invoices/` entirely (including `prototype/` mocks)
- `lib/invoiceAggregates*`, `lib/invoiceUtils*`, `lib/invoiceTableUtils*`, `lib/invoiceDocumentDisplay*`, `lib/invoicePdfFilename*`, `lib/invoicePdfLogo*`, `lib/invoiceEmailTemplates*`, `lib/invoiceBulkPdf*`, `lib/bulkVoidInvoices*`, `lib/distributeInvoicePayment*`
- `lib/validations/invoiceSchema.ts`
- `hooks/use-generate-invoice-fees.ts`, `hooks/use-invoice-filters.ts`, `hooks/use-invoice-selection.ts`, `hooks/use-invoice-document.ts`
- Root-level screenshots: `invoices-mobile.png`, `assign-fee-*.png`, `collect-dialog-*.png`, `bulk-void-success.png`, `delete-confirmation.png`, `fee-dropdown-with-delete.png` (PR artefacts only).
- `PRD_INVOICING.md` at the project root (superseded; ADR-0002 is now the source of truth).

### Phase 1 — Schema
1. Add `receipts` table per ADR-0002 (one row per Session, snapshotted line items, status `issued | voided`, receipt number, total, payment method, payment date, voidedAt/By).
2. Add `receiptCounters` doc keyed by calendar year for atomic `RCP-YYYY-NNNNN` allocation.
3. Remove `studentFees.invoiceId` field if it exists; no migration of data — feature branch never shipped.
4. Indexes: `receipts.by_student`, `receipts.by_session` (unique by construction), `receipts.by_receipt_number`, `receipts.by_status_and_date`.
5. `studentFees`: add an index supporting the overdue query — `by_status_and_due_date` on `["status", "dueDate"]` if not already present.

### Phase 2 — Backend (Convex)
1. Refactor `collectFees` (currently in `convex/feeCollectionSessions.ts`) to atomically: create Session → create feeTransactions → allocate Receipt number → create `receipts` row referencing the Session → mark Student Fees paid. One mutation, one transaction.
2. Drop the `recordInvoicePayment` path entirely.
3. Add `voidReceipt(receiptId)` mutation: void the Receipt, void the Session, flip every covered Student Fee back to `unpaid`. `requireRole(["admin"])`. Reject if already `voided`.
4. Query `getReceipt(receiptId)` — returns Receipt + Session + Student + live-looked-up parent name + admin name.
5. Query `listOverdueFeesByStudent` — `studentFees` filtered by `status === "unpaid" && dueDate < now`, grouped by `studentId`, includes Billing Contact phone for the WhatsApp launcher.
6. Query `listReceipts` with the filters the admin will need (date range, student, status).

### Phase 3 — Frontend
1. `ReceiptDocument.tsx` — new component. Receipt semantics: "Money Receipt #RCP-YYYY-NNNNN", "Received from \<Billing Contact name\>", "On behalf of \<Student name + number\>", payment method, payment date, line items (feeType + period + amount), Total Paid (words + numerals), "Issued by \<admin name\>", signature line, VOIDED watermark when status is voided. Reuse layout/typography helpers from carryover; do not reuse `InvoiceDocument.tsx` content.
2. Receipts list page (`app/(dashboard)/receipts/page.tsx` or under `admin/`) with filters + Receipt detail sheet.
3. Receipt detail sheet: Download PDF, **Email** launcher (Gmail compose, Billing Contact email, prefilled subject/body referencing receipt number and total — admin drags PDF in manually), **WhatsApp** launcher (`wa.me/<normalized phone>?text=<body>`).
4. Overdue list page (`app/(dashboard)/admin/overdue/page.tsx` or similar): live-computed, grouped by student, per-row "Remind via WhatsApp" button that opens `wa.me` to the Billing Contact's phone with a prefilled body listing all overdue fees for that student.
5. New helper: `lib/normalizeBdPhone.ts` (+ test). Convert `01XXXXXXXXX` → `8801XXXXXXXXX`, strip non-digits, reject empty/malformed. Used by all WhatsApp launchers.
6. New helper: `lib/whatsappLaunchUrl.ts` (+ test) — mirror of `composeEmailUrl.ts` for `wa.me`.

### Phase 4 — Tests + verification
- Unit tests on `lib/*` helpers (follow the carryover-test patterns already on the branch).
- Convex function tests for `collectFees` and `voidReceipt` atomicity.
- Build (`npm run build`) and lint (`npm run lint`) must pass.
- Manual verification in browser: collect a payment, download the Receipt PDF, open the Email launcher, open the WhatsApp launcher, void the Receipt, confirm Student Fee flipped back to unpaid, confirm overdue list shows the fee again.

## Conventions to honour (from `CLAUDE.md`)

- **Agent workflow** in `CLAUDE.md` is the contract — Planning → Devil's Advocate → Backend → Backend Review → Frontend → Frontend Review. Don't skip the review gates.
- **`TASK_LOG.md`** must be kept current — at start, mark Phase 0–4 as sub-tasks; mark `[x]` only after the relevant review agent approves.
- Convex rules: every mutation calls `requireRole()` first; no unbounded `.collect()`; indexes for every `withIndex`; no N+1 (use `Promise.all`).
- Frontend rules: shadcn primitives; loading + empty + error states; React Hook Form + Zod for forms; no `any`; mobile-first; Sonner toasts on mutation outcomes.
- Brand tokens: `bg-school-green`, `text-school-yellow` from `app/globals.css @theme {}`. No `tailwind.config.ts`.

## What was deliberately NOT decided in the grilling session

These were left as implementation details — make a judgment call, log it under "Decisions Made" in `TASK_LOG.md` if surprising:

- Exact wording of the Email subject/body and WhatsApp message bodies (Receipt delivery + overdue reminder). Use the carryover `invoiceEmailTemplates.ts` as a starting reference for tone.
- Display treatment for sibling/other discounts on the Receipt PDF (separate line vs adjusted line amount).
- Whether to show the Receipt number in the Transaction Log columns or only on the detail sheet.
- Whether the overdue list should expose a "Snooze" affordance — explicitly deferred until parent feedback says it's needed.
- Receipt-counter doc shape: one global doc with a `year → nextNumber` map, vs one doc per year. Either works; one global keeps the table count clean.

## Open risks to flag during Devil's Advocate review

- **Receipt counter race.** Two concurrent `collectFees` calls in the same year must not allocate the same number. Convex mutations are serialized per document, so reading-then-writing the counter doc inside the same mutation is safe — but verify no one moves the counter read outside the mutation.
- **Phone normalization edge cases.** Numbers with country code already prefixed, leading `+`, leading `00880`, embedded spaces/dashes, 10-digit numbers missing the leading `0`. Test all of them.
- **Voiding a Receipt that included a fee which has been re-collected on a different Receipt.** Can it happen? Whole-receipt void flips fees back to `unpaid`; if those fees were already collected on a later Receipt, the void should fail with a clear error (not silently double-pay).
- **Currency rounding.** All amounts in paisa or all amounts as floats? Confirm with existing `lib/currency.ts` conventions before adding new arithmetic.
- **Empty Billing Contact phone.** If `father/mother/guardianPhoneNumber` was loosely validated at intake, some records may have empty or junk values. The WhatsApp launcher must disable itself gracefully, not 404 the deep link.

## Suggested skills (invoke as relevant)

- `superpowers:writing-plans` — before touching code, turn this handoff into a sub-tasked plan in `TASK_LOG.md`.
- `superpowers:brainstorming` — only if the implementation surfaces a question that isn't resolved in ADR-0002 or CONTEXT.md. Otherwise skip.
- `convex` (umbrella) + `convex-migration-helper` — for the schema removal and Receipt table addition.
- `convex-performance-audit` — checklist for the Receipt and Overdue queries before approving the backend phase.
- `convex-setup-auth` — not needed (auth is already wired) but confirm `requireRole(["admin"])` gates are present on all mutations.
- `shadcn` + `frontend-design` + `next-best-practices` + `vercel-react-best-practices` — for the new Receipts list page, Receipt sheet, and Overdue list page.
- `tdd` — for the new `normalizeBdPhone.ts` and `whatsappLaunchUrl.ts` helpers (follow the test-first pattern the branch already uses for `composeEmailUrl`).
- `verify` — at the end, drive the full flow in the browser (collect → download → email launch → WhatsApp launch → void → overdue re-appears) before declaring done.
- `commit` — for every commit (rip-out, schema, backend, frontend, polish).

## Out of scope

Do not introduce — these were explicitly considered and rejected in ADR-0002:

- Backend email or WhatsApp sending (Resend / Postmark / SES / Meta BSP).
- Per-campus receipt numbering.
- Line-level Receipt voiding.
- Stored `overdue` status with a cron.
- Re-introducing any Invoice or pre-payment document.
- Provider-derived delivery proof (`deliveredAt`, webhooks, etc.). The SIS only attests what the admin tells it; it does not claim to know what happened in Gmail or WhatsApp.
