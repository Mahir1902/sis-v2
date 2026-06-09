---
status: accepted
date: 2026-06-09
amends: ADR-0002
---

# Receipt corrections: cosmetic edit, standalone void, atomic void-and-reissue

## Context and decision

[ADR-0002](./0002-receipt-first-billing-no-invoicing.md) defined whole-receipt void as the only correction path. In practice, two real workflows fall outside that model: fixing a typo in the payer's name (no money moves, voiding is overkill) and cancelling a Receipt for a payment that never actually happened (no replacement Receipt is needed). We are splitting Receipt corrections into three distinct operations, with the boundary drawn at **whether the correction changes financial truth**:

- **Edit in place** (`editReceipt`) — for cosmetic fields only: payer name, payer role (father/mother/guardian), remarks. The Receipt number, lifecycle state, and snapshot of financial fields are unchanged. Audit-logged.
- **Void** (`voidReceipt`) — for "this payment never happened" cases. Receipt flips to `voided`, Session flips to voided, every covered Student Fee flips back to `unpaid`. No replacement document.
- **Void and re-issue** (`voidAndReissueReceipt`) — for any correction that touches a financial field (amount, payment method, payment date, line items, student). One atomic mutation voids the old Receipt and creates a new one via the normal payment flow. The two Receipts are cross-linked via `supersedes` / `supersededBy`, and each PDF prints a visible reference to the other so whichever copy a parent presents, the admin can trace the active version.

The boundary rule — *"if it changes what the parent thinks they paid, void and re-issue; otherwise edit in place"* — is grounded in the fact that Receipts are delivered to parents (via WhatsApp/Email launchers), so the parent's copy and the school's copy must always agree on financial facts. Silent edits to the amount, payment method, or date would produce two physical artefacts with the same number that disagree on money.

## Considered options

- **Whole-receipt void only (ADR-0002 as written).** Rejected: forces a new Receipt number for a typo in the payer's name, which is operationally noisy and not what the school actually does in real life. The fresh number also confuses parents who already received the original.
- **Everything editable, no void at all.** Rejected: silently mutating an issued, numbered, parent-held document on financial fields breaks the audit trail and creates reconciliation conflicts the audit log alone cannot resolve (the parent doesn't see the audit log; they see two PDFs). The single-operation simplicity is not worth the loss of paper-trail integrity.
- **Edit financial fields with a visible "edited" stamp on the PDF.** Considered as a middle ground. Rejected: the stamp doesn't reconcile the parent's already-sent copy with the new version, it just acknowledges drift. Void-and-reissue with cross-linking gives parents and admins two coherent documents to reason about instead of one drifting one.

## Consequences

- **Three mutations replace the single `voidReceipt` shape from ADR-0002**: `editReceipt`, `voidReceipt`, `voidAndReissueReceipt`. Each gates on `requireRole(["admin"])`. The Receipt detail sheet exposes three corresponding actions; the "Void" and "Void & Re-issue" buttons are visually distinct so the financial-vs-cancellation choice is explicit.
- **Two new schema fields on `receipts`**: `supersedes: v.optional(v.id("receipts"))` (on the new Receipt) and `supersededBy: v.optional(v.id("receipts"))` (on the voided one). Set atomically by `voidAndReissueReceipt`; never set by `voidReceipt` alone.
- **The Receipt PDF reads both fields** and renders either *"Re-issued in place of RCP-YYYY-NNNNN"* or *"VOIDED — superseded by RCP-YYYY-NNNNN"* in the document header so the linkage is visible on the printed page, not just in the database.
- **CONTEXT.md's Receipt definition was updated 2026-06-09** to reflect the cosmetic-vs-financial split and to define **Re-issue** as a named domain term.
- **Reversible.** If the school later decides cosmetic edits should also produce a new Receipt number (i.e. revert to ADR-0002's strict model), `editReceipt` can be removed and the cosmetic fields locked. The `supersedes`/`supersededBy` linkage survives unchanged.
