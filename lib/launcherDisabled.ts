/**
 * Decides whether the Email Receipt launcher button on `/receipts/[receiptId]`
 * should be disabled, and which locked tooltip string to show if so.
 *
 * Returns `null` when the launcher is good to fire. Otherwise returns one of
 * the two locked tooltip strings — pinned by `launcherDisabled.test.ts` so any
 * future copy edit shows up as a diff on the test.
 *
 * The student input is the live `students` row at click time, not the receipt
 * snapshot — the email is operational metadata that must reflect the current
 * Billing Contact (see ADR-0002 + issue #37 acceptance criterion).
 *
 * Pure — no Convex, no DOM, no resolveBillingContact dependency at module
 * level so this stays unit-testable on plain objects.
 */

import {
  type BillingContactInput,
  type PrimaryBillingContact,
  resolveBillingContact,
} from "./resolveBillingContact";

// `primaryBillingContact` is an optional property (not merely a nullable one)
// so a `Pick<Doc<"students">, …>` projection satisfies this type directly —
// the field became optional on the document in the import widening (#93).
export type LauncherStudent = Omit<
  BillingContactInput,
  "primaryBillingContact"
> & {
  primaryBillingContact?: PrimaryBillingContact;
};

export const NO_BILLING_CONTACT_TOOLTIP =
  "No Billing Contact set for this student.";
export const NO_EMAIL_TOOLTIP = "No email on file for the Billing Contact.";

export function emailLauncherDisabledReason(
  student: LauncherStudent,
): string | null {
  if (!student.primaryBillingContact) return NO_BILLING_CONTACT_TOOLTIP;
  const contact = resolveBillingContact({
    ...student,
    primaryBillingContact: student.primaryBillingContact,
  });
  if (!contact.hasEmail) return NO_EMAIL_TOOLTIP;
  return null;
}
