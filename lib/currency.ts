/**
 * Currency formatting for the school's financial UI.
 *
 * The school's books are in BDT (Bangladeshi Taka, ৳). The canonical
 * implementation lives in `lib/transactionLogUtils.ts` — re-exported here so
 * new code can import from a single, currency-named module without dragging in
 * unrelated transaction helpers, and so future changes to currency formatting
 * have one obvious home.
 *
 * If the school ever changes currency, edit `transactionLogUtils.ts`
 * `formatCurrency` (single source of truth) — this re-export will follow.
 */

export { formatCurrency } from "./transactionLogUtils";
