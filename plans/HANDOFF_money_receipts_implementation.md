# Handoff — Money Receipts implementation (post-grill)

**For the next session.** Implementation of the Money Receipts feature.

This handoff **supersedes** [`HANDOFF_money_receipts.md`](./HANDOFF_money_receipts.md) where they conflict. The earlier handoff is still the source of truth for branch hygiene, carryover audit, delete list, and the Phase 0–4 structure. The grilling session on 2026-06-09 produced 14 specific decisions that **change or extend** that plan — those decisions are enumerated below, organised by the phase they affect.

## Read these first (do not skip)

1. [`docs/adr/0002-receipt-first-billing-no-invoicing.md`](../docs/adr/0002-receipt-first-billing-no-invoicing.md) — the receipt-first model. Still authoritative.
2. [`docs/adr/0003-receipt-corrections-edit-void-reissue.md`](../docs/adr/0003-receipt-corrections-edit-void-reissue.md) — **NEW**. Amends ADR-0002's "voiding is whole-receipt only" with a three-operation correction model (edit / void / void-and-reissue) and adds the `supersedes` / `supersededBy` cross-link. Read in full.
3. [`CONTEXT.md`](../CONTEXT.md) — domain glossary, updated 2026-06-09. Receipt definition now codifies the full snapshot rule, the cosmetic-vs-financial edit split, the new **Re-issue** term, and the removal of `partial` from `studentFees.status`. WhatsApp Reminder and Compose Email entries clarify that launchers always target the **current** Billing Contact, not the snapshot.
4. [`HANDOFF_money_receipts.md`](./HANDOFF_money_receipts.md) — the earlier handoff. Still load-bearing for branch hygiene, carryover/delete lists, and the Phase 0–4 skeleton. Read alongside this one.

These four documents together are the contract. Everything else is implementation logistics.

## What changed in the grilling session

Fourteen decisions, grouped by what they touch in the plan. Each one is final; do not re-litigate without going back to the user.

### Schema additions / changes

1. **`receipts` table — snapshot every rendered field at issue time.**
   On top of the fields the earlier handoff lists, add:
   - `payerName: v.string()` — Billing Contact's full name at issue time.
   - `payerRole: v.union(v.literal("father"), v.literal("mother"), v.literal("guardian"))` — at issue time.
   - `studentNameSnapshot: v.string()`
   - `studentNumberSnapshot: v.string()`
   - `issuerName: v.string()` — admin's display name at issue time.
   - `lineItems: v.array(v.object({ feeStructureName, billingPeriod, originalAmount, discountAmount, paidAmount }))` — frozen at issue time so future edits to `feeStructure` rows do not mutate old Receipts.
   - `supersedes: v.optional(v.id("receipts"))` — set on the new Receipt when re-issued.
   - `supersededBy: v.optional(v.id("receipts"))` — set on the voided Receipt when re-issued.
   Live references (`studentId`, `collectedBy`, `sessionId`) stay alongside the snapshot fields so navigation still works.

2. **Drop `feeCollectionSessions.invoiceNumber` entirely.** Sessions are pure transaction-log primitives. Parent-facing number lives only on `receipts.receiptNumber`. UIs that need the Receipt number while viewing a Session join via `receipts.by_session`. The `generateInvoiceNumber()` helper in `lib/feeCollectionUtils.ts` is deleted.

3. **Remove `partial` from `studentFees.status`.** Schema narrows to `("unpaid", "paid")`. Delete `partial` from the `FeeStatus` type in `lib/feeCollectionUtils.ts` and from `computeNewFeeStatus()`. Helper becomes: "if payment ≥ balance, return `paid`; otherwise throw." Do **not** add `cancelled` — defer until a cancel-fee flow is actually built. All readers that branched on `partial` must be deleted, not coalesced.

4. **`receiptCounters` table: one document per year.** Shape: `{ year: number, nextNumber: number }`. Indexed by `year`. (The earlier handoff said "either works"; this is the chosen one.)

### Receipt numbering

5. **Year prefix uses Bangladesh calendar year (Asia/Dhaka, UTC+06:00).** A payment recorded at 11:55 PM Dec 31 BD time gets the 2026 prefix even though UTC says 2027. Implement via a central helper (suggested: `lib/receiptNumber.ts` exporting `currentBdYear()` and `formatReceiptNumber(year, seq)`).

### Backend mutations

6. **`collectFees` refactor produces snapshot fields, not live IDs only.** When creating the Receipt row, resolve and snapshot `payerName`, `payerRole`, `studentNameSnapshot`, `studentNumberSnapshot`, `issuerName`, `lineItems` from the live records at that moment. Subsequent reads of the Receipt source every rendered field from the snapshot, never from `students`/`users`/`feeStructure`. Counter allocation happens inside the same mutation, reading and writing the `receiptCounters` doc for the current BD year.

7. **Three correction mutations (NOT one), all `requireRole(["admin"])`:**
   - `editReceipt(receiptId, { payerName?, payerRole?, remarks? })` — cosmetic only. Patches snapshot fields. Audit-logged. Rejects if Receipt is `voided`.
   - `voidReceipt(receiptId)` — standalone void with no replacement. Flips Receipt → `voided`, Session → `voided`, every covered Student Fee back to `unpaid`. Does **not** set `supersededBy`. Rejects if already `voided`. Rejects if any covered fee is no longer `paid` or no longer linked to this Session's transactions (the "reality has moved on" guard from Q3 of the grill).
   - `voidAndReissueReceipt(receiptId, newPaymentArgs)` — atomic. Voids the old Receipt with the same guard as `voidReceipt`, then runs the equivalent of `collectFees` for the new payment, then links `oldReceipt.supersededBy = newReceiptId` and `newReceipt.supersedes = oldReceiptId`. All in one Convex transaction.

   Drop the `recordInvoicePayment` path entirely (already in the earlier handoff's delete list).

8. **`getReceipt(receiptId)`** returns the Receipt row directly — every rendered field is already on the row from the snapshot. No live joins for the PDF content. Live joins are only used to fetch the **current** Billing Contact's email/phone for the action buttons (see decision 12).

9. **`listOverdueFeesByStudent`** — as the earlier handoff describes. Per decision 13, this query also needs to aggregate per student (count, total) and include the current Billing Contact's name + role + phone for the WhatsApp launcher.

10. **`listReceipts`** — as the earlier handoff describes. Add `supersedes` / `supersededBy` to the returned shape so the list page can badge re-issued or superseded rows.

### Frontend

11. **`ReceiptDocument.tsx`** renders entirely from the snapshot fields on the Receipt row. Header includes the cross-link line when present:
    - If `supersedes` is set → *"Re-issued in place of RCP-YYYY-NNNNN"*.
    - If `supersededBy` is set → *"VOIDED — superseded by RCP-YYYY-NNNNN"* alongside the existing VOIDED watermark.
    - Standalone-voided Receipt (no `supersededBy`) → just the VOIDED watermark.

12. **Action buttons (Email, WhatsApp) target the *current* Billing Contact**, resolved from the live `students` row at button-click time, not from the Receipt snapshot. Three disabled states with tooltips:
    - No `primaryBillingContact` set → both buttons disabled, tooltip *"No Billing Contact set for this student."*
    - Billing Contact has no email → Email button disabled, tooltip *"No email on file for the Billing Contact."*
    - Billing Contact has no/malformed phone (`normalizeBdPhone()` returns `null`) → WhatsApp button disabled, tooltip *"No phone on file for the Billing Contact."*

13. **Routes (top-level, not under `/admin/`):**
    - `/receipts` — list page with filter toolbar (date range, student, status). Re-issued / superseded rows visually badged.
    - `/receipts/[receiptId]` — detail sheet exposing **three** action buttons in the corrections area: **Edit** (opens an inline form for `payerName` / `payerRole` / `remarks`), **Void** (confirmation modal — no replacement), **Void & Re-issue** (opens a payment form pre-filled from the old Receipt's values).
    - `/overdue` — overdue list.
    Page-level `requireRole(["admin"])` on all three.

14. **Overdue list shape:**
    - One row per student, not per fee.
    - Default sort: total overdue amount DESC; secondary sort: oldest overdue fee date ASC.
    - Row content: student name + photo, count of overdue fees, total overdue (BDT), current Billing Contact name + role, **"Remind via WhatsApp"** button (disabled per decision 12).
    - Row expands to show each fee: type, billing period, due date, amount.
    - No Snooze affordance (explicitly deferred).

### Body copy (locked, English, brief)

**Receipt Email — subject:** `Money Receipt {receiptNumber} — {schoolName}`

**Receipt Email — body:**
```
Dear {payerName},

Please find attached the Money Receipt for the payment received on
{paymentDate} totaling BDT {totalAmount} for {studentName}.

If you have any questions, please reply to this email or contact
the school office.

Thank you,
{schoolName}
```

**Receipt WhatsApp — body** (no salaam, no payer-name greeting):
```
Money Receipt {receiptNumber} for BDT {totalAmount} ({studentName})
has been issued on {paymentDate}. The PDF will follow in the next message.
— {schoolName}
```

**Overdue Reminder WhatsApp — body** (no salaam, breakdown + total):
```
Reminder of pending fees for {studentName}:

• {feeType1} ({period1}) — BDT {amount1} (due {dueDate1})
• {feeType2} ({period2}) — BDT {amount2} (due {dueDate2})

Total outstanding: BDT {totalOverdue}

Please contact the school office to arrange payment.
— {schoolName}
```

There is **no** Email launcher for overdue reminders — WhatsApp only. There is **no** outstanding-fee breakdown in the Receipt Email — that email only covers a single payment that was just received.

The admin can edit any body in the launcher before sending; these are prefill, not enforced.

## Carryover and delete lists

Use the [previous handoff's carryover audit](./HANDOFF_money_receipts.md#carryover-audit-keep-these--they-survive-adr-0002-unchanged) and [delete list](./HANDOFF_money_receipts.md#delete-invoice-domain-only) as-is. No additions or changes from the grilling session.

## Execution order (sub-tasks for `TASK_LOG.md`)

Follow Phase 0–4 from the earlier handoff. Inject the new decisions in the right phase:

- **Phase 0** — branch rename + rip-out commit. Unchanged.
- **Phase 1 (Schema)** — adopt decisions 1, 2, 3, 4. Indexes from the earlier handoff plus a `by_supersedes` index on `receipts` if the list page needs to display re-issue chains efficiently (verify in performance audit).
- **Phase 2 (Backend)** — adopt decisions 5, 6, 7, 8, 9, 10. The earlier handoff's mutations 2.1–2.3 fold in here; mutation 2.3 expands from one (`voidReceipt`) to three (`editReceipt`, `voidReceipt`, `voidAndReissueReceipt`).
- **Phase 3 (Frontend)** — adopt decisions 11, 12, 13, 14, and the body copy. Receipt detail sheet now has three action buttons in the corrections area, not one.
- **Phase 4 (Tests + verification)** — extend the manual verification flow to cover the new operations: cosmetic edit (audit-logged, no number change), standalone void (no replacement), void-and-reissue (cross-links visible on both PDFs).

## Conventions to honour

Same as the earlier handoff. No changes.

## Open risks for the Devil's Advocate Agent

The earlier handoff lists five open risks. Two have been resolved by the grill, three remain:

- ~~Receipt counter race~~ — resolved by decision 4 (one doc per year, Convex per-document serialisation guarantees safety).
- ~~Voiding a Receipt whose fees were re-collected~~ — resolved by decision 7 (the per-fee guard in `voidReceipt` / `voidAndReissueReceipt` aborts with a clear error if any covered fee is no longer `paid` or no longer linked).
- **Phone normalisation edge cases.** Numbers with country code already prefixed, leading `+`, leading `00880`, embedded spaces/dashes, 10-digit numbers missing the leading `0`. Test all of them in `lib/normalizeBdPhone.test.ts`.
- **Currency rounding.** All amounts in paisa or all amounts as floats? Confirm with existing `lib/currency.ts` conventions before adding any new arithmetic in `collectFees` / line-item snapshots.
- **Empty Billing Contact fields at intake.** Some legacy student records may have empty or junk values in `father/mother/guardianPhoneNumber` or `*Email`. Decision 12 makes the UI handle this; verify the Convex queries that supply launcher data return `null` rather than throwing for these rows.

## Suggested skills (invoke as relevant)

- `superpowers:writing-plans` — turn this handoff into a sub-tasked plan in `TASK_LOG.md` before touching code.
- `convex` + `convex-migration-helper` — for the schema removal (drop `invoiceNumber`, narrow `studentFees.status`) and the new `receipts` + `receiptCounters` tables.
- `convex-performance-audit` — run the checklist on `getReceipt`, `listReceipts`, `listOverdueFeesByStudent`, and the three correction mutations before approving the backend phase. Pay special attention to the cross-link join cost on `listReceipts`.
- `convex-setup-auth` — confirm `requireRole(["admin"])` is the first call in every new mutation.
- `tdd` — for `lib/normalizeBdPhone.ts`, `lib/whatsappLaunchUrl.ts`, the BD-year helper in `lib/receiptNumber.ts`, and the updated `computeNewFeeStatus()`.
- `shadcn` + `frontend-design` + `next-best-practices` + `vercel-react-best-practices` — for the new Receipt detail sheet (three correction actions, two launchers, edit form), Receipts list page, and Overdue list page.
- `verify` — at the end, drive the full flow in the browser: collect a payment, edit a cosmetic field, download the PDF, open the Email launcher, open the WhatsApp launcher, void without replacement (confirm fee re-appears in overdue), then collect again, then void-and-reissue (confirm both PDFs show the cross-link), then send the overdue reminder.
- `commit` — for every commit (rip-out, schema, backend, frontend, polish).

## Out of scope (unchanged from earlier handoff)

Do not introduce anything from ADR-0002's rejected list — backend email/WhatsApp sending, per-campus receipt numbering, line-level void, stored `overdue` status with cron, re-introducing Invoice as a pre-payment document, or provider-derived delivery proof.

Additionally, per the grill:

- **No `cancelled` status on `studentFees`** until a cancel-fee flow is built. Decision 3 explicitly excludes it.
- **No Email launcher on the Overdue list** — WhatsApp only. Decision 14 + body copy section confirm this.
- **No outstanding-fee breakdown inside the Receipt Email body.** Receipt Email is for a single just-completed payment; outstanding fees belong in the WhatsApp Overdue Reminder.
- **No Snooze affordance on overdue list** — decision 14.
- **No "edit-history" stamp on the Receipt PDF itself.** Cosmetic-edit history lives in the audit log only; the PDF renders current values silently.
