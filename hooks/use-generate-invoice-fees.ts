"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

interface InvoiceableFee {
  _id: string;
  balance: number;
}

interface UseGenerateInvoiceFeesArgs<TFee extends InvoiceableFee> {
  /** Fee list returned from `getInvoiceableFeesForStudent` (undefined while loading). */
  invoiceableFees: TFee[] | undefined;
  /** Current set of selected fee ids — owned by the dialog. */
  selectedFeeIds: Set<string>;
  /** Setter for the dialog's selection state. */
  setSelectedFeeIds: Dispatch<SetStateAction<Set<string>>>;
}

interface UseGenerateInvoiceFeesResult<TFee extends InvoiceableFee> {
  /** Fees whose ids are present in `selectedFeeIds`. */
  selectedFees: TFee[];
  /** Sum of `balance` across `selectedFees`. */
  runningTotal: number;
  /** Toggle membership of a fee id in the selection set. */
  toggleFee: (id: string) => void;
  /**
   * Stable signature of the fee-id list — useful for downstream effects that
   * need to detect "the list of invoiceable fees actually changed" without
   * referential equality false-positives from Convex re-pushes.
   */
  feeListKey: string;
}

/**
 * Encapsulates selection logic for the Generate Invoice dialog.
 *
 * - Derives `selectedFees` and `runningTotal` from the fee list + selection set.
 * - Pre-checks every eligible fee the first time a new fee-list signature
 *   arrives, tracked in a ref so a same-signature Convex re-push does not
 *   clobber a user's manual unchecks.
 * - Exposes `toggleFee` for line-item checkboxes.
 */
export function useGenerateInvoiceFees<TFee extends InvoiceableFee>({
  invoiceableFees,
  selectedFeeIds,
  setSelectedFeeIds,
}: UseGenerateInvoiceFeesArgs<TFee>): UseGenerateInvoiceFeesResult<TFee> {
  // Stable signature of the current fee list — sorted so re-fetch ordering
  // doesn't trigger a spurious "list changed" event.
  const feeListKey = useMemo(
    () =>
      invoiceableFees
        ?.map((f) => f._id)
        .sort()
        .join("|") ?? "",
    [invoiceableFees],
  );

  // Track the last signature we applied default selection for. Without this,
  // every Convex re-push would reset selection and blow away manual unchecks.
  const lastAppliedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!invoiceableFees) return;
    if (lastAppliedKey.current === feeListKey) return;
    lastAppliedKey.current = feeListKey;
    setSelectedFeeIds(new Set(invoiceableFees.map((f) => f._id)));
  }, [feeListKey, invoiceableFees, setSelectedFeeIds]);

  // When the fee query goes back to `undefined` (e.g. dialog closes and the
  // Convex query skips), forget the last-applied signature so a re-open with
  // the same data re-applies the default selection.
  useEffect(() => {
    if (invoiceableFees === undefined) {
      lastAppliedKey.current = null;
    }
  }, [invoiceableFees]);

  const selectedFees = useMemo(
    () => (invoiceableFees ?? []).filter((f) => selectedFeeIds.has(f._id)),
    [invoiceableFees, selectedFeeIds],
  );

  const runningTotal = useMemo(
    () => selectedFees.reduce((sum, f) => sum + f.balance, 0),
    [selectedFees],
  );

  const toggleFee = useCallback(
    (id: string) => {
      setSelectedFeeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedFeeIds],
  );

  return { selectedFees, runningTotal, toggleFee, feeListKey };
}
