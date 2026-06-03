import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily overdue-transition job.
 *
 * Runs at 01:00 UTC — chosen so the flip happens shortly after a school day
 * ends in any reasonable timezone the school operates in, but well before
 * morning admin work starts. The handler scans up to OVERDUE_SCAN_CAP
 * `issued` invoices via the `by_status` index and patches the past-due ones
 * to `overdue`. Paid and voided invoices are not touched.
 */
crons.daily(
  "transition invoices to overdue",
  { hourUTC: 1, minuteUTC: 0 },
  internal.invoices.transitionOverdueInvoices,
);

export default crons;
