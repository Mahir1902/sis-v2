# Handoff — Issue #38 (Slice 7: Cosmetic edit / `editReceipt`)

**For the next session.** Read this top to bottom, then finish issue #38 in **one pass**. The slice is small: one Convex mutation, one Zod schema, one inline edit form. Single PR / single commit.

## TL;DR

- Issue #37 is **fully shipped**. Email Receipt launcher live on `/receipts/[receiptId]` — disabled-state tooltip + enabled-state Gmail compose URL verified end-to-end on real Convex data. Branch `feature/money-receipts` at commit `9882990`.
- Issue #38 adds the **cosmetic-edit correction operation** from ADR-0003. Admin can fix a typo in `payerName`, `payerRole`, or `remarks` without producing a new Receipt number and without changing the lifecycle.
- No new tables. No new indexes. No re-issue / void semantics — those are separate slices.

## State of the branch (start of next session)

- Branch: `feature/money-receipts`, HEAD = `9882990` (`feat(receipts): email receipt launcher (issue #37)`).
- Dev deployment `hushed-bass-123.convex.cloud` has the receipts table, `collectFees`, `getReceipt`, `getBySession`. No `editReceipt` yet.
- Frontend:
  - `/receipts/[receiptId]` renders `<ReceiptDocument>` with the three cosmetic snapshot fields displayed read-only.
  - Header has Email Receipt + Print buttons. The cosmetic-edit affordance does **not** exist yet.
- Pure helpers reusable in #38: `lib/resolveBillingContact.ts` (Billing Contact union type), `lib/utils.ts` (`cn`), Sonner toast wiring already in place.
- Verification at end of #37: `npm test` (182/182), `npm run lint` (clean), `npm run build` (17 routes), `npx convex dev --once` (deployed).

## What issue #38 must do

Read the GitHub issue body for the canonical spec (`gh issue view 38`). Summary:

**One new Convex mutation** — `convex/receipts.ts`:

- `editReceipt({ receiptId, payerName?, payerRole?, remarks? })` mutation
- `requireRole(ctx, ["admin"])` as the first line
- Load the receipt; throw `"Receipt not found"` if missing
- Reject with a clear error if `receipt.status === "voided"` (e.g. `"Cannot edit a voided receipt"`)
- Patch ONLY the three cosmetic fields that were provided (omit `undefined` keys from the patch object)
- Audit-log via `logAudit(ctx, { action: "update", entityType: "receipts", entityId: receiptId, ... })`. Description should name which fields changed. Metadata should include `{ before: {...}, after: {...} }` for the changed fields.
- Returns `null` (or the new patched row — pick whichever feels right; the UI re-renders via the live `useQuery` either way)

**Zod schema** — `lib/validations/editReceiptSchema.ts`:

- `payerName`: optional, trim, min 1 if present
- `payerRole`: optional, enum `["father", "mother", "guardian"]`
- `remarks`: optional, trim, max ~500 chars
- Refine: at least one field must be present (otherwise no-op edit). Error: `"Provide at least one field to edit."`

**One UI change** — `app/(dashboard)/receipts/[receiptId]/page.tsx` (or a new `_components/CosmeticEditDialog.tsx`):

- Add an "Edit" button next to "Print" / "Email Receipt", admin-only (already inside `RoleGate allowedRoles={["admin"]}`).
- Click opens a shadcn `<Dialog>` with React Hook Form + Zod (`editReceiptSchema`).
- Three fields: `payerName` (Input), `payerRole` (Select with father/mother/guardian), `remarks` (Textarea, optional).
- Defaults populated from the current receipt values.
- Submit calls `useMutation(api.receipts.editReceipt)`. Sonner toast on success and error. Close dialog on success.
- Disable the Edit button when `receipt.status === "voided"` — tooltip `"Cannot edit a voided receipt."`.

**Receipt PDF re-renders silently** — no "edited" stamp. The history lives in the audit log only.

## Out of scope (do NOT touch)

- `voidReceipt` / `voidAndReissueReceipt` (separate slices)
- `/receipts` list page (separate slice)
- WhatsApp launcher
- Adding new audit `action` literals — `"update"` is already in the union; reuse it
- Receipt number changes — the whole point of cosmetic-edit is **same** receipt number
- Adding indexes — none needed for this slice

## Suggested approach (one pass)

1. `gh issue view 38` to re-read the spec.
2. Backend first:
   - TDD `lib/validations/editReceiptSchema.ts` — write small Zod tests for the "at least one field" refinement, payerRole enum, and trim/empty-string behavior, then implement.
   - Add `editReceipt` mutation in `convex/receipts.ts`. Follow the `logAudit` pattern from `convex/studentFees.ts` for shape.
3. Frontend:
   - Build `CosmeticEditDialog` with shadcn `Dialog` + `Select` + `Textarea` + `Form` (RHF).
   - Wire button + dialog in the receipts detail page.
4. `npm test && npm run lint && npm run build` — must all pass.
5. Manual Playwright verification:
   - Log in as admin, open existing receipt (`pn7d2y84mwfq08ek7h77dz6a5s88cha5`, Zainab Rahman / Muhammad / Father).
   - Click Edit → change payerName to `"Muhammad Rahman"` → submit → toast `"Receipt updated"` → ReceiptDocument re-renders with new name → Receipt number unchanged.
   - Open `/admin/audit-log` and verify the new audit row with `action=update`, `entityType=receipts`, description naming `payerName`.
   - Revert the change after verification.
6. Single commit: `feat(receipts): cosmetic-edit correction (issue #38)`.

Time budget: 60–90 minutes. If you're past 2 hours, stop and ask.

## Key references

- `convex/auditLogs.ts` — `logAudit` helper and the `AuditAction` union. `"update"` is the right action literal.
- `convex/studentFees.ts` lines 29 / 118 / 148 — examples of `logAudit` calls with before/after metadata.
- `convex/lib/permissions.ts` — `requireRole(ctx, ["admin"])`. Always first line of the handler.
- `convex/schema.ts` line 378 — receipts table; the three cosmetic fields are `payerName`, `payerRole`, `remarks`.
- `app/(dashboard)/receipts/[receiptId]/page.tsx` — your UI integration point. Just-shipped Email Receipt button uses the same shadcn Tooltip pattern you'll need for the voided-state Edit button.
- ADR-0003 (if it exists in `docs/adr/`) — re-issue + correction semantics. For #38 just verify it agrees with "cosmetic edit keeps the same Receipt number, no stamp on PDF".

## Conventions still in force (from CLAUDE.md)

- No `any`. Use types from `convex/_generated/dataModel`.
- Brand: `bg-school-green`, `text-school-yellow`. No hardcoded hex.
- shadcn primitives for everything shadcn covers (Dialog, Form, Select, Textarea, Button, Tooltip).
- Sonner toast for success/error.
- TDD for the pure Zod schema. Mutation can be exercised via the UI flow + audit log inspection.
- No N+1 in the mutation. Single `ctx.db.get` + single `ctx.db.patch` + single `logAudit` insert.

## Hand-off to the slice after this

Once #38 ships, the next slice is either `voidReceipt` or `voidAndReissueReceipt` (the harder corrections). Confirm with the user which is next on the board before starting.
