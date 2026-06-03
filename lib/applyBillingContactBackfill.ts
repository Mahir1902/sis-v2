export type PrimaryBillingContact = "father" | "mother" | "guardian";

/**
 * Pure backfill rule used by the issue #33 student migration.
 *
 * Returns the patch needed to populate `primaryBillingContact` for a student
 * record that lacks the field, or `undefined` when no patch is required. The
 * default of `"father"` matches the issue #33 spec and the existing data shape
 * (every student has a `fatherName` even when other parents are absent).
 *
 * Kept as a pure function so it can be unit-tested independently of the
 * Convex `migrations.define` wrapper.
 */
export function applyBillingContactBackfill(student: {
  primaryBillingContact: PrimaryBillingContact | undefined;
}): { primaryBillingContact: PrimaryBillingContact } | undefined {
  if (student.primaryBillingContact === undefined) {
    return { primaryBillingContact: "father" };
  }
  return undefined;
}
