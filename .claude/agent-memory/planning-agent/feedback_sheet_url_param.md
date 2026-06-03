---
name: feedback-sheet-url-param
description: Side-panel Sheet open state should be driven by a URL search param (router.replace), not useState, when a deep-link contract exists
metadata:
  type: feedback
---

For invoice preview (Issue #29) and any similar "view detail in a side sheet" pattern,
use a URL search param (`?invoiceId=`) rather than plain `useState<Id | null>` when the
feature spec or an adjacent feature (e.g., a success-toast deep-link) has already
promised a deep-linkable URL.

**Why:** Issue #28's `generateInvoice` success toast already navigates to
`/invoices?invoiceId={id}` — plain `useState` would silently ignore that deep-link,
breaking the user's expectation that clicking the toast opens the preview.

**How to apply:**
- Create a `hooks/use-{feature}-preview.ts` hook (pure URL state, no business logic).
- Hook exposes `openPreview(id)` → `router.replace(pathname?...&param=id)` and
  `closePreview()` → `router.replace(pathname?...` without the param.
- Always use `router.replace` (not `push`) to avoid polluting browser history.
- Preserve existing search params when writing — build from `searchParams.toString()`.
- The Sheet component itself is a thin wrapper (`_components/`) with zero data fetching.
- `InvoiceDocument` (or equivalent detail component) handles all data internally via
  its own hook — the Sheet only passes `invoiceId` and `onClose`/`onDownloadPdf` props.

See [[feedback-inline-dialog]] for the distinction between inline dialogs and extracted
Sheet components.
