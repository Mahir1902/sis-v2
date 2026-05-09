/**
 * Formats a stored billing period string (YYYY-MM) into a human-readable label.
 *
 * @param billingPeriod - A string in "YYYY-MM" format, or undefined/null
 * @returns A formatted string like "Jan 2025", or "—" for missing values
 *
 * @example
 * formatBillingPeriod("2025-01") // "Jan 2025"
 * formatBillingPeriod(undefined) // "—"
 */
export function formatBillingPeriod(
  billingPeriod: string | undefined | null,
): string {
  if (!billingPeriod) return "—";

  const [yearStr, monthStr] = billingPeriod.split("-");
  const monthIndex = Number.parseInt(monthStr, 10) - 1;

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return `${monthNames[monthIndex]} ${yearStr}`;
}
