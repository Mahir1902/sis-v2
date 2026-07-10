---
status: accepted
date: 2026-06-15
supersedes: ADR-0001
---

# Receipt-first billing: no invoicing, Receipt issued at payment time

## Context and decision

The school does not issue invoices. All communication with parents about fees owed happens verbally, by text, or as an informal Fee Notice — no document with a number, no document with a lifecycle. The only billing document the school produces is a **Money Receipt**, issued at the moment a payment is recorded.

We are removing the Invoice entity from the SIS:

- The `invoices` table is dropped. The `studentFees → invoiceId` relationship is removed; Student Fees are directly billable.
- Receipt becomes a **first-class entity** (`receipts` table, `RCP-YYYY-NNNNN` numbering with calendar-year reset, status `issued → voided`). Each Receipt wraps exactly one `feeCollectionSessions` row (1:1) and snapshots its line items so future fee edits cannot mutate an old document.
- Voiding is **whole-receipt only**: the Receipt flips to `voided`, the underlying Session flips to voided, and every Student Fee covered flips back to `unpaid`. Partial reversal is done by void + re-issue.
- **Overdue** is computed (`studentFees.status = unpaid AND dueDate < now()`), not stored. No cron, no flag, no migration.
- Receipt delivery and overdue reminders both use the **launcher pattern** from ADR-0001 — pure UI affordances that write nothing to the server. Receipts support an **Email launcher** (Gmail compose with the PDF dragged in by hand) and a **WhatsApp launcher** (wa.me deep link to the Billing Contact's phone). Overdue reminders are WhatsApp-only.

## Considered options

- **Keep invoicing alongside Receipts.** Issue an Invoice at fee assignment, then a Receipt at payment. Rejected: the school does not actually issue invoices in real life. Modelling something the school does not do creates documents that exist only inside the SIS, which has no audience and no purpose. It also doubles the schema, doubles the lifecycle bugs, and forces every paid Receipt to coexist with a now-paid Invoice covering the same fees.
- **Receipt as derived view of `feeCollectionSessions`** (no new table, `sessionRef` IS the receipt number). Rejected: the user explicitly chose a first-class entity. Reasoning: future-proof for audit/regulatory needs (receipt numbering decoupled from session ID format), and the immutable-snapshot semantics need their own row anyway. Sessions remain the transaction-log primitive used by cash-flow and audit reports; Receipts are the parent-facing snapshot.
- **Line-level Receipt void.** Rejected: matches no real workflow ("scratch out one line of a receipt"). Real practice is tear up the wrong receipt and write a new one — modelled as whole-receipt void + re-issue. Simpler lifecycle, fewer "is this line still valid?" checks at render time.
- **Stored `overdue` status with daily cron.** Rejected: at school scale (thousands not millions of fees) the perf win is zero, and a missed cron run produces stale state. Live computation is one indexed query.
- **Backend WhatsApp sending via Meta BSP.** Same rejection as ADR-0001's backend-email analysis: Meta verification takes weeks, requires template approval per message variant, costs $25–50/month + per-message fees, and locks the SIS into a compliance regime for a feature whose value hasn't been validated. The launcher pattern is reversible: a Convex `action` replaces the deep-link helper later if backend sending is ever justified.
- **Receipt delivery as Email-only.** Rejected: BD school communication empirically lives on WhatsApp. Offering only Email matches no real workflow; offering both costs ~30 lines.

## Consequences

- **Major branch rework.** The `feature/invoicing` branch is renamed and an in-place "rip out invoicing" commit deletes the `invoices` Convex module, schema table, prototype routes, and invoice-domain `lib/` files. Carryover (PDF helpers, launcher utilities, currency/date formatters, BillingContact schema, parent-email fields, ADR-0001's architecture insight) is preserved.
- **`feeCollectionSessions` and `feeTransactions` remain unchanged in role.** They are still the transaction-log primitive. The change is that Receipts now wrap them 1:1 instead of being implicit in a paid Invoice.
- **`collectFees` mutation atomically creates Session + Receipt + Transactions in one Convex mutation.** No separate "Issue Receipt" step. A user-facing failure to create the Receipt rolls back the payment.
- **The Receipt PDF is a different document from the previous Invoice PDF.** "Received from", "Payment method", "Issued by", acknowledgment-of-payment tone. The `InvoiceDocument.tsx` layout (logo, typography, container) is carryover; the content is rewritten as `ReceiptDocument.tsx`.
- **The SIS does not prove delivery for Receipts OR overdue reminders.** Same honesty principle as ADR-0001. No `sentAt`, no `lastRemindedAt`, no provider webhooks. The overdue list stays overdue until the underlying fee is paid; admins re-nudge whenever they want.
- **Phone number normalization is needed for the wa.me launcher.** BD numbers stored as `01XXXXXXXXX` must be normalized to `8801XXXXXXXXX` (no `+`). Implementation detail; not a domain change.
- **Reversible.** If the school ever does start issuing pre-payment documents, this is a forward migration (add a new entity), not a retrofit of a missing one. The receipt-first model does not block re-introducing invoices later.
