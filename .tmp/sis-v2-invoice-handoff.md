# Handoff: PDF Invoice & Fee Notice Generation
**Project:** SIS v2 — `/Users/mahirhaque/Documents/Coding/sis-v2`
**Branch:** `feature/fee-transaction-log`
**Date:** 2026-05-22

---

## What Was Decided

A grilling session (`/grill-with-docs`) was completed against the existing fee management codebase. All design decisions are resolved. No implementation has started yet.

### Two Documents to Build

#### 1. Fee Notice
- **Trigger:** Generated on demand from a student's fees tab
- **Scope:** All outstanding (unpaid or partially paid) `studentFee` records for that student
- **Due dates:** 10th of the billing month for monthly fees; "Upon Enrollment" for one-time/yearly fees
- **Reference number:** None — identified by student name + date printed
- **UI placement:** "Download Fee Notice" button on the student's fees tab

#### 2. Invoice
- **Trigger:** After `collectFees` mutation executes successfully (a `feeCollectionSession` is created)
- **Invoice number:** Uses existing `sessionRef` field from `feeCollectionSession`
- **UI placement (two spots):**
  1. Post-collection dialog — immediately after payment recorded, "Download Invoice" button
  2. Transaction log session detail — re-download at any time

### Shared Decisions (both documents)
| Decision | Choice |
|----------|--------|
| PDF library | `@react-pdf/renderer` (client-side, real PDF, selectable text) |
| School branding | Hardcoded in `lib/invoiceConfig.ts`; logo as static asset in `/public` |
| VAT | Skipped for now |
| Amount in Words | Skipped for now |
| Document naming | "Invoice" (not "Money Receipt") |

---

## Domain Glossary

Canonical terms are captured in:
- **`CONTEXT.md`** at project root — defines "Fee Notice" and "Invoice" precisely

---

## Codebase Context

### Fee Schema (key tables)
All in `convex/schema.ts`:
- `feeStructures` — fee types with `frequency`: `"one-time" | "monthly" | "yearly"`
- `studentFees` — per-student fee records with `paidAmount`, `balance`, `status`, `billingPeriod`
- `feeCollectionSessions` — one per payment event; has `sessionRef`, `items[]`, `totalAmount`, `paymentMode`, `collectedBy`
- `feeTransactions` — individual line items within a session

### Key Existing Files
- `convex/feeCollectionSessions.ts` — `collectFees` mutation (creates session + transactions atomically)
- `convex/transactionLog.ts` — `getTransactionLog`, `getSessionDetail` queries
- `lib/feeCollectionUtils.ts` — `generateInvoiceNumber`, `generateTransactionReference` (pure utils)
- `app/(dashboard)/admin/transactions/` — transaction log page with session detail drill-down
- `hooks/use-transaction-filters.ts` — filter state for transaction log

### Physical Invoice Reference
A photo of the school's manual invoice was reviewed. It shows:
- Header: school name, mobile, SIS number (= invoice number)
- Table columns: Payment Category, Amount, VAT Amount, Month
- Footer: Total Amount, Amount in Word, note about payment by the 10th, "Received with Thanks"
- VAT column and Amount in Words are **both skipped** for now

---

## What Comes Next

The next session will:
1. **Prototype** the PDF layout using the `prototype` skill before full implementation
2. Then hand off to the planning agent to break into atomic sub-tasks in `TASK_LOG.md`
3. Then implement via the coding agent

The prototype should cover:
- The Invoice PDF component (using `@react-pdf/renderer`)
- The Fee Notice PDF component
- The `lib/invoiceConfig.ts` constants file
- Placement of download buttons (post-collection dialog + session detail + fees tab)

---

## Suggested Skills

For the prototyping session:
- **`prototype`** — start here to lay out the PDF components visually before full build
- **`writing-plans`** or **`superpowers:writing-plans`** — after prototype is approved, break into sub-tasks
- **`frontend-design`** — when building the actual React PDF components and UI download buttons
- **`convex`** — if any backend changes are needed (unlikely for this feature — it's mostly frontend)

---

## Open Questions (deferred, not blocking)
- VAT column: may be added later if school decides to track VAT
- Amount in Words: deferred, can be added with `number-to-words` npm package
- Email/auto-send of invoice: explicitly out of scope for this iteration (manual download only)
