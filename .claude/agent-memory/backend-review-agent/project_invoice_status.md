---
name: project_invoice_status
description: Invoice status lifecycle and the "sent" → "issued" rename context.
metadata:
  type: project
---

Invoice status union after issue #33: `"draft" | "issued" | "paid" | "overdue" | "voided"`. The legacy v1 value `"sent"` was removed via widen-migrate-narrow.

**Why:** `"issued"` is the canonical billing-state name per CONTEXT.md and ADR-0001. It asserts intent to bill — not delivery success. Delivery is tracked separately on `deliveryChannel` / `deliveryStatus` so the billing lifecycle cannot be silently coupled to delivery outcome.

**How to apply:** When reviewing invoice code, any new occurrence of `"sent"` as a status literal in production code (not in migration-preserved comments) is a hard reject. Frontend prototype files under `app/prototype/` are throwaway design variants and are out of scope. Reject if `transitionOverdueInvoices` or any status-derived UI compares against `"sent"`.

Related: [[project_widen_migrate_narrow]]
