"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type ReceiptStatusFilter = "all" | "issued" | "voided";

interface ReceiptsListQueryArgs {
  dateRange?: { from: number; to: number };
  studentId?: Id<"students">;
  status?: "issued" | "voided";
}

/**
 * Filter state for the `/receipts` admin list page.
 *
 * Date inputs live as ISO date strings (yyyy-MM-dd) so they round-trip through
 * `<input type="date">` without timezone drift. `queryArgs` re-derives the
 * Convex args (epoch ms + narrowed status union) so the consumer can pass them
 * straight to `useQuery(api.receipts.listReceipts, ...)`.
 */
export function useReceiptsFilters() {
  const today = useMemo(() => toIsoDate(new Date()), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDate(d);
  }, []);

  const [dateFrom, setDateFrom] = useState<string>(monthAgo);
  const [dateTo, setDateTo] = useState<string>(today);
  const [studentId, setStudentId] = useState<Id<"students"> | undefined>(
    undefined,
  );
  const [studentLabel, setStudentLabel] = useState<string>("");
  const [status, setStatus] = useState<ReceiptStatusFilter>("all");

  const queryArgs = useMemo<ReceiptsListQueryArgs>(() => {
    const args: ReceiptsListQueryArgs = {};
    if (dateFrom && dateTo) {
      args.dateRange = {
        from: startOfDayMs(dateFrom),
        to: endOfDayMs(dateTo),
      };
    }
    if (studentId) args.studentId = studentId;
    if (status !== "all") args.status = status;
    return args;
  }, [dateFrom, dateTo, studentId, status]);

  function onStudentSelect(
    nextId: Id<"students"> | undefined,
    nextLabel: string,
  ) {
    setStudentId(nextId);
    setStudentLabel(nextLabel);
  }

  function reset() {
    setDateFrom(monthAgo);
    setDateTo(today);
    setStudentId(undefined);
    setStudentLabel("");
    setStatus("all");
  }

  return {
    dateFrom,
    dateTo,
    studentId,
    studentLabel,
    status,
    setDateFrom,
    setDateTo,
    setStatus,
    onStudentSelect,
    reset,
    queryArgs,
  };
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayMs(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.getTime();
}

function endOfDayMs(isoDate: string): number {
  const d = new Date(`${isoDate}T23:59:59.999`);
  return d.getTime();
}
