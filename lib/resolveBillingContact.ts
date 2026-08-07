/**
 * Resolves the Billing Contact (CONTEXT.md domain term) for a student record.
 *
 * Returns the name + email of whichever parent/guardian is marked as
 * `primaryBillingContact`. The email is normalised — empty strings and
 * whitespace-only values resolve to `undefined`, and `hasEmail` is set
 * accordingly so the UI can render the "Add Email" affordance from issue #31.
 *
 * Pure — works on a plain object so it can be unit-tested without Convex.
 */

export type PrimaryBillingContact = "father" | "mother" | "guardian";

// The three name fields are optional because `students` was widened for the
// Excel import (#93) — an imported record may carry an email for a parent
// whose name was never recorded. `name` is therefore nullable on the way out;
// callers that need a name (e.g. freezing a receipt payer) must refuse rather
// than substitute a stand-in.
export interface BillingContactInput {
  primaryBillingContact: PrimaryBillingContact;
  fatherName?: string;
  fatherEmail?: string;
  motherName?: string;
  motherEmail?: string;
  guardianName?: string;
  guardianEmail?: string;
}

export interface BillingContact {
  contactType: PrimaryBillingContact;
  name: string | undefined;
  email: string | undefined;
  hasEmail: boolean;
}

export function resolveBillingContact(
  student: BillingContactInput,
): BillingContact {
  const { name, rawEmail } = pickContact(student);
  const trimmed = rawEmail?.trim();
  const email = trimmed && trimmed.length > 0 ? trimmed : undefined;
  return {
    contactType: student.primaryBillingContact,
    name,
    email,
    hasEmail: email !== undefined,
  };
}

function pickContact(student: BillingContactInput): {
  name: string | undefined;
  rawEmail: string | undefined;
} {
  switch (student.primaryBillingContact) {
    case "father":
      return { name: student.fatherName, rawEmail: student.fatherEmail };
    case "mother":
      return { name: student.motherName, rawEmail: student.motherEmail };
    case "guardian":
      return { name: student.guardianName, rawEmail: student.guardianEmail };
  }
}
