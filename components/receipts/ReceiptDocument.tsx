import type { Doc } from "@/convex/_generated/dataModel";
import { amountInWords } from "@/lib/amountInWords";
import { formatCurrency } from "@/lib/currency";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import { SCHOOL_NAME } from "@/lib/schoolBrand";

interface ReceiptDocumentProps {
  receipt: Doc<"receipts">;
}

const PAYER_ROLE_LABEL: Record<Doc<"receipts">["payerRole"], string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
};

/**
 * Print-friendly Money Receipt (ADR-0002).
 *
 * Renders EVERY visible field from the receipt's snapshot columns —
 * `payerName`, `studentNameSnapshot`, `studentNumberSnapshot`, `issuerName`,
 * `lineItems`, etc. — and never from a live `students` / `feeStructure` join.
 * That is the contract that lets a reprint two years later show exactly what
 * the parent originally received, even if the student record has since changed.
 *
 * MVP scope (issue #36): header + Received from + On behalf of + payment
 * method/date + line items + total in words + Issued by. Watermark for voided
 * receipts and cross-link lines for re-issued ones come in slices 8 and 9.
 */
export function ReceiptDocument({ receipt }: ReceiptDocumentProps) {
  const isVoided = receipt.status === "voided";
  const subtotalDiscount = receipt.lineItems.reduce(
    (sum, line) => sum + line.discountAmount,
    0,
  );
  const subtotalOriginal = receipt.lineItems.reduce(
    (sum, line) => sum + line.originalAmount,
    0,
  );

  return (
    <article
      aria-label={`Money Receipt ${receipt.receiptNumber}`}
      className="mx-auto max-w-3xl rounded-lg border bg-white p-8 shadow-sm print:border-0 print:shadow-none"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-school-green">
            Money Receipt
          </h1>
          <p className="mt-1 text-sm text-gray-500">{SCHOOL_NAME}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Receipt Number
          </p>
          <p className="font-mono text-lg font-semibold text-gray-900">
            {receipt.receiptNumber}
          </p>
          {isVoided && (
            <output className="mt-2 inline-flex items-center rounded-full bg-red-400/40 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              VOIDED
            </output>
          )}
        </div>
      </header>

      {/* ── Parties ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Received from
          </h2>
          <p className="mt-1 text-base font-medium text-gray-900">
            {receipt.payerName}
          </p>
          <p className="text-sm text-gray-500">
            {PAYER_ROLE_LABEL[receipt.payerRole]}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            On behalf of
          </h2>
          <p className="mt-1 text-base font-medium text-gray-900">
            {receipt.studentNameSnapshot}
          </p>
          <p className="font-mono text-sm text-gray-500">
            {receipt.studentNumberSnapshot}
          </p>
        </div>
      </section>

      {/* ── Payment meta ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-6 border-t border-gray-200 py-4 sm:grid-cols-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Payment Method
          </h2>
          <p className="mt-1 text-sm text-gray-900">{receipt.paymentMethod}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Payment Date
          </h2>
          <p className="mt-1 text-sm text-gray-900">
            {fmtDayMonthYear(receipt.paymentDate)}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Issued
          </h2>
          <p className="mt-1 text-sm text-gray-900">
            {fmtDayMonthYear(receipt.issuedAt)}
          </p>
        </div>
      </section>

      {/* ── Line items ────────────────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Particulars
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4 text-right">Original</th>
                <th className="py-2 pr-4 text-right">Discount</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipt.lineItems.map((line, idx) => (
                <tr
                  key={`${line.feeStructureName}-${line.billingPeriod ?? ""}-${idx}`}
                >
                  <td className="py-2 pr-4 text-gray-900">
                    {line.feeStructureName}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {line.billingPeriod ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-900">
                    {formatCurrency(line.originalAmount)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-900">
                    {line.discountAmount > 0
                      ? `− ${formatCurrency(line.discountAmount)}`
                      : "—"}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {formatCurrency(line.paidAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-300">
              <tr>
                <td
                  className="py-3 pr-4 text-right text-xs uppercase tracking-wide text-gray-500"
                  colSpan={2}
                >
                  Subtotal
                </td>
                <td className="py-3 pr-4 text-right text-sm text-gray-900">
                  {formatCurrency(subtotalOriginal)}
                </td>
                <td className="py-3 pr-4 text-right text-sm text-gray-900">
                  {subtotalDiscount > 0
                    ? `− ${formatCurrency(subtotalDiscount)}`
                    : "—"}
                </td>
                <td className="py-3 text-right text-base font-semibold text-gray-900">
                  {formatCurrency(receipt.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Total in words ────────────────────────────────────────────── */}
      <section className="mt-4 rounded-md bg-school-yellow/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Amount Received
        </p>
        <p className="mt-1 text-lg font-bold text-gray-900">
          {formatCurrency(receipt.totalAmount)}
        </p>
        <p className="text-sm text-gray-600 italic">
          {amountInWords(receipt.totalAmount)}
        </p>
      </section>

      {/* ── Remarks ───────────────────────────────────────────────────── */}
      {receipt.remarks && (
        <section className="mt-4 border-t border-gray-200 pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Remarks
          </h2>
          <p className="mt-1 text-sm text-gray-700">{receipt.remarks}</p>
        </section>
      )}

      {/* ── Issued by ─────────────────────────────────────────────────── */}
      <footer className="mt-8 flex flex-col items-end border-t border-gray-200 pt-6">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Issued by
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {receipt.issuerName}
          </p>
        </div>
      </footer>
    </article>
  );
}
