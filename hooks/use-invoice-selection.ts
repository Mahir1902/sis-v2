"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { InvoiceRow } from "@/app/(dashboard)/invoices/_components/InvoiceTable";
import type { Id } from "@/convex/_generated/dataModel";

interface UseInvoiceSelectionArgs {
  /** Rows currently visible in the table — drives `toggleAll` and the totals. */
  visibleRows: InvoiceRow[];
  /**
   * Composite filter signature. When this changes, the selection is cleared
   * and a Sonner toast is emitted (initial mount is skipped to avoid a toast
   * on first page load).
   */
  filterSig: string;
}

interface UseInvoiceSelectionResult {
  selectedIds: Set<Id<"invoices">>;
  /** Sum of `totalAmount` across rows that are both visible AND selected. */
  selectionTotalValue: number;
  toggleRow: (id: Id<"invoices">) => void;
  /** Toggle all currently-visible rows. Selects all if any are unselected; deselects all otherwise. */
  toggleAll: () => void;
  clearSelection: () => void;
}

/**
 * Row-selection state for the invoice table.
 *
 * The set lives in a `useRef` so we can mutate it without stale-closure issues;
 * a version counter triggers re-renders when the set changes. Selection
 * persists across "Load more" pagination so the user doesn't lose checks on
 * earlier rows. Any filter change clears the selection (a row that is selected
 * but no longer visible would be unreachable) and emits a Sonner toast.
 *
 * `selectionTotalValue` is summed across CURRENTLY-VISIBLE rows only — invoice
 * totals for off-screen IDs aren't in memory.  The count remains accurate
 * across pagination; only the value is constrained to what we can see.
 */
export function useInvoiceSelection({
  visibleRows,
  filterSig,
}: UseInvoiceSelectionArgs): UseInvoiceSelectionResult {
  const selectedIdsRef = useRef<Set<Id<"invoices">>>(new Set());
  const [selectionVersion, setSelectionVersion] = useState(0);

  const bumpSelection = useCallback(
    () => setSelectionVersion((v) => v + 1),
    [],
  );

  const toggleRow = useCallback(
    (id: Id<"invoices">) => {
      const next = new Set(selectedIdsRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selectedIdsRef.current = next;
      bumpSelection();
    },
    [bumpSelection],
  );

  const toggleAll = useCallback(() => {
    const next = new Set(selectedIdsRef.current);
    const allVisibleSelected =
      visibleRows.length > 0 && visibleRows.every((r) => next.has(r._id));
    if (allVisibleSelected) {
      for (const r of visibleRows) next.delete(r._id);
    } else {
      for (const r of visibleRows) next.add(r._id);
    }
    selectedIdsRef.current = next;
    bumpSelection();
  }, [visibleRows, bumpSelection]);

  const clearSelection = useCallback(() => {
    selectedIdsRef.current = new Set();
    bumpSelection();
  }, [bumpSelection]);

  // Filter-change → clear selection. Skip the very first render so the toast
  // doesn't fire when the user first arrives at the page.
  const isInitialFilterRender = useRef(true);
  useEffect(() => {
    void filterSig;
    if (isInitialFilterRender.current) {
      isInitialFilterRender.current = false;
      return;
    }
    if (selectedIdsRef.current.size === 0) return;
    selectedIdsRef.current = new Set();
    bumpSelection();
    toast.info("Selection cleared due to filter change");
  }, [filterSig, bumpSelection]);

  // Recompute when rows change (load-more, new page) or selection mutates.
  const selectionTotalValue = useMemo(() => {
    void selectionVersion;
    let sum = 0;
    for (const r of visibleRows) {
      if (selectedIdsRef.current.has(r._id)) sum += r.totalAmount;
    }
    return sum;
  }, [visibleRows, selectionVersion]);

  return {
    selectedIds: selectedIdsRef.current,
    selectionTotalValue,
    toggleRow,
    toggleAll,
    clearSelection,
  };
}
