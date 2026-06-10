# Handoff — Issue #37 (Slice 4: Email Receipt launcher)

**For the next session.** Read this top to bottom, then go finish issue #37 in **one pass**. Do not break it into phases. The whole slice is small enough — two pure helpers, one button, one tooltip — to land as a single PR with a single commit (or two if you want to separate the helpers from the wiring).

## TL;DR

- Issue #36 is **fully shipped**. Schema + collectFees + Receipt issuance + `/receipts/[receiptId]` detail page + UI surfacing in `CollectFeesDialog` and `SessionDetailSheet` — all on `feature/money-receipts` at `5802d5f`.
- Issue #37 adds **one button** to `/receipts/[receiptId]`: "Email Receipt", which opens Gmail compose prefilled with a locked subject + body, targeting the **current** Billing Contact's email (live `students` row, not the snapshot).
- That's the whole slice. Do not invent extra phases.

## State of the branch (start of next session)

- Branch: `feature/money-receipts`, HEAD = `5802d5f` (`feat(receipts): issue numbered receipts on collectFees + detail page`).
- Dev deployment `hushed-bass-123.convex.cloud` has:
  - `receipts` and `receiptCounters` tables live and writeable.
  - `collectFees` mutation atomically issues a numbered Receipt with full snapshot.
  - Receipts queryable via `api.receipts.getReceipt(receiptId)` and `api.receipts.getBySession(sessionId)` (both admin-gated).
- Frontend has:
  - `/receipts/[receiptId]` admin-gated detail page with `<ReceiptDocument>` (header, Received from, On behalf of, payment meta, line items, total in numerals + words, Issued by, Print button).
  - `CollectFeesDialog` success toast now shows `Receipt RCP-YYYY-NNNNN issued` with a "View Receipt" action button.
  - `SessionDetailSheet` (Admin → Transactions) surfaces the linked Receipt at the top of the sheet.
- Pure helpers ready for reuse: `lib/receiptNumber.ts`, `lib/receiptSnapshot.ts`, `lib/amountInWords.ts`, `lib/resolveBillingContact.ts`, `lib/composeEmailUrl.ts`, `lib/dateFormat.ts`, `lib/currency.ts`, `lib/schoolBrand.ts`.
- Verification at end of #36: `npm test` (172/172), `npm run lint` (clean), `npm run build` (17 routes), `npx convex dev --once` (deployed).

## What issue #37 must do

Read the GitHub issue body for the canonical spec (`gh issue view 37`). Summary:

**Two new pure helpers** (TDD, pinned-string tests):

1. **`lib/receiptTemplates.ts`**
   - `receiptEmailSubject({ receiptNumber, schoolName })` → `"Money Receipt {receiptNumber} — {schoolName}"`
   - `receiptEmailBody({ payerName, paymentDate, totalAmount, studentName, schoolName })` → multi-line locked copy, verbatim from the issue body. Pin every line as a string test so future copy edits show up in a diff.

2. **`lib/launcherDisabled.ts`**
   - `emailLauncherDisabledReason(student)` returns `null` or one of two locked tooltip strings:
     - `"No Billing Contact set for this student."` when `primaryBillingContact` is missing/unset
     - `"No email on file for the Billing Contact."` when the resolved Billing Contact has no email
   - Tests cover: no Billing Contact / no email / OK paths.

**One UI change** — `app/(dashboard)/receipts/[receiptId]/page.tsx`:

- Add an "Email Receipt" button next to the existing Print button.
- Click handler:
  1. Fetch the **current** student via `api.students.getStudentById` (live, **not** the receipt's snapshot — see ADR rationale below).
  2. Resolve Billing Contact via `resolveBillingContact(student)`.
  3. Compute disabled state via `emailLauncherDisabledReason(student)`.
  4. If disabled → render the button disabled with the locked tooltip string (use shadcn `<Tooltip>` over a disabled `<Button>` wrapped in a span, since disabled buttons don't fire events).
  5. If enabled → on click, build the URL via `composeEmailUrl({ to: billingContact.email, subject: receiptEmailSubject(...), body: receiptEmailBody(...) })` and open in a new tab.

**Locked copy (do NOT paraphrase):**

```
Subject: Money Receipt {receiptNumber} — {schoolName}

Body:
Dear {payerName},

Please find attached the Money Receipt for the payment received on
{paymentDate} totaling BDT {totalAmount} for {studentName}.

If you have any questions, please reply to this email or contact
the school office.

Thank you,
{schoolName}
```

`{paymentDate}` formatted via `fmtDayMonthYear` (DD/MM/YYYY). `{totalAmount}` formatted with `formatCurrency` minus the ৳ symbol, or with the symbol — confirm with the user if unclear. Default to `formatCurrency`.

## The one decision you have to make in this slice

**The launcher targets the LIVE Billing Contact email, not the snapshot.** Rationale: the Receipt's `payerName` is frozen at issue time (correct — that's who actually paid), but the *email* is operational metadata for sending the receipt today, so it must reflect the current contact details. If the parent's email changed since the receipt was issued, the new address is the right target.

This is why the page must call `api.students.getStudentById` separately, not just `api.receipts.getReceipt`. The Receipt row has `payerName` + `payerRole` but no email. The student row has the live emails.

Acceptance criterion: a manual reviewer must be able to (1) change `fatherEmail` on a student, (2) open an old receipt for that student, (3) click Email → the new address must be the `to:` line, not the old one.

## Required reads (skim, don't re-litigate)

1. **Issue #37 on GitHub** — `gh issue view 37` — the spec. Locked copy lives here.
2. **`docs/adr/0002-receipt-first-billing-no-invoicing.md`** — confirms the snapshot rule applies to *printed Receipt content*, not to operational launchers.
3. **`lib/composeEmailUrl.ts`** + its test — already in place, no changes needed. Just call it.
4. **`lib/resolveBillingContact.ts`** + its test — already in place. Returns `{ contactType, name, email, hasEmail }`.
5. **`components/receipts/ReceiptDocument.tsx`** and the receipts page — your UI integration target.

Do not read the four `plans/HANDOFF_money_receipts*.md` documents unless you hit a design question this handoff didn't answer. They cover the entire feature roadmap and will drag you into Slice 5+ scope.

## Out of scope (do NOT touch in Issue #37)

- Correction mutations (`editReceipt`, `voidReceipt`, `voidAndReissueReceipt`) — separate later slice.
- `/receipts` admin list page — separate later slice.
- `/overdue` list — separate later slice.
- WhatsApp launcher (`lib/whatsappLaunchUrl.ts`) and phone normalisation (`lib/normalizeBdPhone.ts`) — separate later slice.
- Sidebar nav entry for Receipts — separate later slice.
- Any backend change. **This slice writes no server code.** If you find yourself editing `convex/*`, you're outside scope.

## Suggested approach (one pass)

1. `gh issue view 37` to re-read the spec.
2. TDD `lib/receiptTemplates.ts` — write pinned-string tests for subject + body, then implement. Two functions, ~20 lines of impl.
3. TDD `lib/launcherDisabled.ts` — three test cases, one switch statement.
4. Read the receipts page, add the Email button next to Print, wire the click handler. shadcn `<Tooltip>` for the disabled state.
5. `npm test && npm run lint && npm run build` — must all pass.
6. Manual verification: log in as admin, open an existing receipt, click Email → Gmail opens with the prefilled subject and body. Edit the parent's email, reload, click again → new address is targeted.
7. Single commit: `feat(receipts): email receipt launcher (issue #37)`.

Time budget: this should be 30–60 minutes of work, not a multi-session phase. If you're past 2 hours, stop and ask the user what's blocking.

## Conventions still in force (from CLAUDE.md)

- No `any`. Use types from `convex/_generated/dataModel`.
- Brand: `bg-school-green`, `text-school-yellow`. No hardcoded hex.
- shadcn primitives for UI elements shadcn covers (Button, Tooltip).
- Sonner toast for success/error feedback if the click handler fails.
- TDD for the pure helpers — red → green → no horizontal slicing.
- No new Convex code. If you think you need a query, you've misread the slice.

## Hand-off to the slice after this

Once #37 ships, the next slice is either the WhatsApp launcher (Slice 5, parallel UI affordance to Email) or the corrections backend (editReceipt / voidReceipt / voidAndReissueReceipt — the old "Phase 2" content from the obsolete handoff). Confirm with the user which slice number is next on the board before starting it. **Do not** auto-continue into it from #37.
