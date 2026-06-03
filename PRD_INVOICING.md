# PRD: Invoicing Feature

**Status:** needs-triage  
**Feature branch:** feature/invoicing  
**Prototype reference:** `app/(dashboard)/invoices/prototype/`

---

## Problem Statement

The school's finance staff currently have no way to generate and send formal invoices to parents before payment is collected. The existing fee system only records payments after the fact — there is no proactive billing workflow. This means parents receive no advance notice of what they owe, finance staff cannot track which families have been notified, and there is no paper trail of what was billed versus what was paid. Overdue fees are only discovered reactively when a parent arrives at the counter.

---

## Solution

An invoicing module that gives finance staff a full billing lifecycle: generate an invoice from a student's outstanding fees, preview a formatted invoice document, send it to the parent (via email or WhatsApp), and track payment status through to settlement. The main interface is a dense data table showing all invoices with filtering and bulk operations. Clicking "View" on any invoice opens a formatted invoice document in a side sheet, matching the school's branding including the official logo.

---

## User Stories

### Invoice Generation

1. As a finance admin, I want to generate an invoice for a student from their outstanding fee assignments, so that I can bill them formally before expecting payment.
2. As a finance admin, I want the invoice to automatically include all unpaid and partially-paid fees for a student in a given academic year, so that I don't have to manually select line items.
3. As a finance admin, I want each invoice to be assigned a unique, sequential invoice number, so that I can reference it in conversations with parents and in audit logs.
4. As a finance admin, I want to set a due date when generating an invoice, so that parents know the deadline for payment.
5. As a finance admin, I want invoices to start in "Draft" status, so that I can review them before they are sent to parents.
6. As a finance admin, I want to edit a draft invoice (adjust line items or due date) before sending it, so that I can correct any errors.
7. As a finance admin, I want the invoice to display the student's name, student ID, class, and campus, so that the parent can clearly identify which child the invoice is for.
8. As a finance admin, I want invoice dates to be displayed in DD/MM/YYYY format, so that they follow the local date convention used by the school.

### Invoice Delivery

9. As a finance admin, I want to send an invoice to a parent via email directly from the invoice view, so that parents receive formal billing notification without manual work.
10. As a finance admin, I want to send an invoice to a parent via WhatsApp, so that I can reach parents who are more responsive on messaging apps.
11. As a finance admin, I want to send a payment reminder for an outstanding invoice, so that I can nudge parents who have not yet paid without generating a new invoice.
12. As a finance admin, I want bulk-sending invoices to multiple parents at once, so that I can notify a whole class or cohort efficiently at the start of term.
13. As a finance admin, I want the invoice status to automatically change from "Draft" to "Sent" when I send it, so that I can track who has been notified.
14. As a finance admin, I want to see the date and time an invoice was sent, so that I have a record of when each parent was contacted.

### Invoice List & Filtering

15. As a finance admin, I want to see all invoices in a paginated data table, so that I can manage the full billing pipeline in one place.
16. As a finance admin, I want to filter invoices by status (All / Overdue / Sent / Draft / Paid), so that I can quickly focus on the invoices that need action.
17. As a finance admin, I want to search invoices by student name, student ID, or invoice number, so that I can find a specific invoice without scrolling.
18. As a finance admin, I want to filter invoices by class/standard level, so that I can work through billing for one class at a time.
19. As a finance admin, I want to sort invoices by issue date, due date, amount, or student name, so that I can prioritise my work.
20. As a finance admin, I want to see how many invoices are in each status tab, so that I can gauge the volume of work at a glance.
21. As a finance admin, I want the filter state to reset cleanly with a single "Clear" action, so that I don't have to reset each filter individually.
22. As a finance admin, I want to see summary cards at the top of the invoice list showing total invoiced, total collected, total outstanding, and total overdue, so that I have a financial overview without running a separate report.

### Invoice Document Preview

23. As a finance admin, I want to open a formatted invoice document by clicking "View" on any row, so that I can see exactly what the parent receives before sending.
24. As a finance admin, I want the invoice document to display the school's official logo, so that it looks professional and on-brand.
25. As a finance admin, I want the invoice document to show all fee line items with descriptions and amounts, so that parents understand what they are being charged for.
26. As a finance admin, I want the invoice document to show the subtotal, any amounts already paid, and the outstanding balance, so that partial-payment situations are clearly communicated.
27. As a finance admin, I want the invoice document to highlight the balance due prominently, so that the parent's attention is drawn to the amount they owe.
28. As a finance admin, I want to print the invoice directly from the preview, so that I can hand a paper copy to a parent who visits in person.
29. As a finance admin, I want to download the invoice as a PDF from the preview, so that I can attach it to an email or file it locally.
30. As a finance admin, I want to close the invoice preview with a dedicated close button in the toolbar, so that the close action is clearly separate from the action buttons and cannot be accidentally triggered.

### Bulk Operations

31. As a finance admin, I want to select multiple invoices using checkboxes, so that I can perform bulk actions without repeating steps.
32. As a finance admin, I want a "Select all" checkbox that selects all visible (filtered) invoices, so that I can act on an entire filtered set at once.
33. As a finance admin, I want a floating action bar to appear when invoices are selected, showing the count, total value, and available bulk actions, so that I always know what I have selected without the filter toolbar being disrupted.
34. As a finance admin, I want to bulk-send selected invoices from the floating action bar, so that I can notify multiple parents in one action.
35. As a finance admin, I want to bulk-download selected invoices as PDFs, so that I can archive or share them.
36. As a finance admin, I want to bulk-void selected invoices from the floating action bar, so that I can cancel a batch of incorrectly generated invoices.
37. As a finance admin, I want to dismiss the selection by clicking the × in the floating bar, so that I can deselect without clicking every row individually.

### Payment Recording & Status Transitions

38. As a finance admin, I want to record a payment against an invoice from within the invoice view, so that the payment is linked to the correct billing document.
39. As a finance admin, I want the invoice status to automatically change to "Paid" when the full balance is settled, so that the status always reflects the true payment state.
40. As a finance admin, I want the invoice status to automatically become "Overdue" when the due date passes and the balance is not zero, so that I do not have to manually flag late payers.
41. As a finance admin, I want to void an individual invoice with a reason, so that I have a record of cancelled billing and the student's fee record is not corrupted.
42. As a finance admin, I want a voided invoice to be visually distinct in the table, so that I can easily distinguish it from active invoices.

### Export

43. As a finance admin, I want to export the visible (filtered) invoice list to CSV, so that I can share it with the principal or use it in a spreadsheet.

---

## Implementation Decisions

### Schema Changes

A new `invoices` table is required. The existing `feeCollectionSessions` table represents a payment event (money has been received) and cannot serve as an invoice (a proactive billing document with a lifecycle). The two tables will co-exist and be linked: when a payment is recorded against an invoice, a `feeCollectionSession` is created and the invoice's `paidAmount` and `status` are updated.

**New `invoices` table fields:**
- Unique sequential invoice number
- Reference to student, academic year, standard level, and campus
- Line items: an array of objects each containing a fee structure reference, description, and amount — this allows the invoice to be a snapshot of what was billed even if the underlying fee structure changes later
- Total amount (sum of line items, computed on creation)
- Paid amount and balance (updated when payments are recorded)
- Status: `draft` | `sent` | `paid` | `overdue` — overdue is a derived state but stored for query efficiency
- Issue date and due date (Unix ms timestamps)
- Sent-at timestamp and sent-by user reference (populated when the invoice is dispatched)
- Internal notes (optional free text, not shown to parents)
- Created-by user reference and created-at timestamp
- Voided-at timestamp, voided-by user reference, and void reason (optional, populated on void)

Indexes required: by student + academic year, by status, by academic year + standard level, by invoice number (unique), by due date (for overdue detection).

### Backend Modules

**Invoice query module** — A Convex query that returns invoices with flexible filtering (status, academic year, standard level, campus, search term). Paginates at 50 records. Enriches each row with student name, class name, and campus name via batched lookups. Computes summary aggregates (total invoiced, collected, outstanding, overdue) over the same filter set. This is the deep module that powers both the table and the summary cards.

**Invoice generation mutation** — Accepts a student ID, academic year, list of `studentFees` IDs, and a due date. Validates that the fees belong to the student and are not already invoiced. Computes the total from the fee structures. Assigns a sequential invoice number. Inserts the invoice in `draft` status. Writes an audit log entry. Enforces admin-only access.

**Invoice send action** — A Convex action (not mutation) because it calls external services (email/WhatsApp). Marks the invoice as `sent`, records `sentAt` and `sentBy`. In the prototype phase this can be a stub that only updates the status; the actual delivery integration is out of scope for the initial implementation.

**Invoice void mutation** — Accepts an invoice ID and reason. Validates the invoice is not already paid (paid invoices cannot be voided). Sets status to `voided`, records timestamp and user. Does not delete the record. Writes an audit log entry.

**Payment recording mutation** — When a payment is made against an invoice, updates `paidAmount` and `balance` on the invoice. Transitions status to `paid` if balance reaches zero. Creates a `feeCollectionSession` record. Writes an audit log entry. This extends the existing payment flow rather than replacing it.

**Overdue detection** — A scheduled Convex cron job that runs daily, queries invoices where `status = "sent"` and `dueDate < now()`, and updates them to `overdue`. This keeps status accurate without requiring front-end computation.

### Frontend Modules

**Invoices list page** — The primary page at the `/invoices` route. Contains the filter toolbar (search input, status dropdown, class dropdown, clear action), summary cards row, and the data table. Handles bulk selection state. Renders the floating selection bar when rows are selected. Delegates all data fetching to a `useInvoiceFilters` hook following the pattern established by `useTransactionFilters`.

**Invoice data table** — A TanStack Table instance with columns for invoice number, student (name + ID), class, campus, issue date, due date, status (dot + label), total, balance, and a three-dot action menu. Footer row shows totals for filtered results. Checkboxes in the first column enable bulk selection.

**Invoice document component** — A shared, stateless component that receives a single invoice object and renders the formatted document (logo, header, bill-to block, line items, totals). Accepts an optional `onClose` callback; when provided, renders a close button on the left of the toolbar instead of relying on the container to provide one. Used by both the split-panel view and the sheet preview.

**Invoice preview sheet** — A right-side Sheet (672px wide) that wraps the invoice document component. Opened from the "View" row action in the table. The sheet suppresses its built-in close button; the document component's toolbar close button is used instead to avoid overlap with the action buttons.

**Floating selection bar** — A fixed-position pill that appears above the bottom prototype switcher (or bottom of the viewport in production) when one or more rows are selected. Shows selection count, aggregate value, and bulk action buttons (Send, PDF, Void). Includes a dismiss ×. Does not interact with or modify the filter toolbar.

**Status filter tabs** — A row of tab buttons (All / Overdue / Sent / Draft / Paid) with count badges. Selecting a tab filters the table by that status. Follows the same pattern as status filtering on the student list page.

### Date Formatting

All dates in the invoice document are formatted as DD/MM/YYYY. A shared `fmtDate(isoString)` utility is used consistently. This is distinct from the existing date formatting used elsewhere in the app, which may need alignment.

### Invoice Number Format

Sequential invoice numbers follow the format `INV-{YYYY}-{NNN}` (e.g. `INV-2025-001`). The sequence resets per academic year. Generation is handled server-side in the mutation to prevent duplicates under concurrent inserts.

---

## Testing Decisions

**What makes a good test:** Tests should verify observable behaviour from the outside — what a user or API consumer can see — not internal implementation details. Avoid testing that a specific function was called; test that the output or state is correct. Each test should be runnable in isolation without depending on test ordering.

**Modules to test:**

- **Invoice status computation** — Pure function: given a due date and paid/total amounts, returns the correct status (`draft`, `sent`, `paid`, `overdue`). This function has no side effects and no dependencies, making it the ideal unit test target.

- **Invoice number generation** — Pure function: given a year and the last-used sequence number, returns the correctly formatted next invoice number. Edge cases: sequence rollover, academic year boundary.

- **Invoice totals calculation** — Pure function: given line items, compute total; given total and paid amount, compute balance. Verify rounding behaviour on fractional currency amounts.

- **Invoice query module** — Integration test against a Convex test environment: given a set of inserted invoices with varying statuses and filters applied, verify the returned list matches expected rows and the aggregate totals are correct.

**Prior art:** The existing `useTransactionFilters` hook and transaction log query follow the same filtering + aggregation pattern. The student list's DataTable column tests (where they exist) are the model for table behaviour tests.

---

## Out of Scope

- **Actual email or WhatsApp delivery integration.** The "Send" action will mark the invoice as sent and record the timestamp. External messaging service integration (SendGrid, Twilio, Meta Business API) is a separate workstream.
- **Parent-facing portal.** Parents viewing their own invoices via a student-role login is out of scope. The invoicing module is admin-only in this phase.
- **Recurring invoice auto-generation.** Automatically generating invoices on a schedule (e.g. at the start of each term) is out of scope. Invoices are generated manually by finance staff.
- **Partial payments on a single invoice line.** A payment is recorded against the invoice as a whole; splitting a payment across individual line items is out of scope.
- **Multi-currency support.** All amounts are in NGN.
- **Invoice templates.** The invoice document layout is fixed. A template editor or per-school customisation is out of scope.
- **Student-facing invoice history.** Students/parents cannot view past invoices through the SIS in this phase.
- **Integration with the existing `feeCollectionSessions` table for pre-existing payments.** Historical payment sessions recorded before the invoicing feature was introduced will not be retroactively linked to invoices.

---

## Further Notes

- The prototype (at `invoices/prototype`) was built with three UI variants. The chosen design is **Variant C (power table)** for the main list, with the **InvoiceDocument component** (originally from Variant A) rendered inside a side sheet when "View" is clicked. The prototype files should be deleted once the real implementation is complete and approved.
- The `InvoiceDocument` component already exists as a shared prototype component. It should be promoted to a proper production component (with loading/error/empty states, proper TypeScript types from Convex's generated data model, and no hardcoded mock data) rather than copied.
- The school logo is available at `/public/SIS_Logo.svg` and must be used in the invoice document header.
- The overdue status detection cron job is critical for data integrity. Without it, invoices that pass their due date without payment will remain in "sent" status and won't appear in the "Overdue" tab.
- Role enforcement: all invoice mutations must be restricted to `admin` role via `requireRole()`. The invoice list page should be wrapped in a `RoleGate` component.
