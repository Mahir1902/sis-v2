import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "Online";

export interface TransactionFilterState {
  academicYearId: Id<"academicYears"> | undefined;
  dateFrom: number | undefined;
  dateTo: number | undefined;
  campusFilter: string | undefined;
  paymentMode: PaymentMode | undefined;
  studentIds: Id<"students">[] | undefined;
  includeVoided: boolean;
  standardLevelId: Id<"standardLevels"> | undefined;
  dateRange: { from: Date | undefined; to: Date | undefined };
  datePresetLabel: string | null;
}

export function useTransactionFilters(
  defaultYearId: Id<"academicYears"> | undefined,
) {
  const [academicYearId, setAcademicYearId] = useState<
    Id<"academicYears"> | undefined
  >(undefined);
  const [campusFilter, setCampusFilter] = useState<string | undefined>(
    undefined,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>(
    undefined,
  );
  const [studentIds, setStudentIds] = useState<Id<"students">[] | undefined>(
    undefined,
  );
  const [includeVoided, setIncludeVoided] = useState(false);
  const [standardLevelId, setStandardLevelId] = useState<
    Id<"standardLevels"> | undefined
  >(undefined);

  // Date range: driven by DateRangePicker (preset or calendar selection)
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [datePresetLabel, setDatePresetLabel] = useState<string | null>(null);

  const effectiveYearId = academicYearId ?? defaultYearId;

  // Compute dateFrom/dateTo from the date range state
  const dateFrom = dateRange.from ? dateRange.from.getTime() : undefined;
  const dateTo = dateRange.to ? dateRange.to.getTime() : undefined;

  const dateRangeLabel = useMemo(() => {
    if (datePresetLabel && datePresetLabel !== "All Time")
      return datePresetLabel;
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    return "";
  }, [datePresetLabel, dateRange]);

  const resetAll = useCallback(() => {
    setAcademicYearId(undefined);
    setCampusFilter(undefined);
    setPaymentMode(undefined);
    setStudentIds(undefined);
    setIncludeVoided(false);
    setStandardLevelId(undefined);
    setDateRange({ from: undefined, to: undefined });
    setDatePresetLabel(null);
  }, []);

  const hasActiveFilters =
    dateRange.from !== undefined ||
    dateRange.to !== undefined ||
    campusFilter !== undefined ||
    paymentMode !== undefined ||
    (studentIds !== undefined && studentIds.length > 0) ||
    includeVoided ||
    standardLevelId !== undefined;

  const queryArgs = effectiveYearId
    ? {
        academicYearId: effectiveYearId,
        ...(dateFrom !== undefined && { dateFrom }),
        ...(dateTo !== undefined && { dateTo }),
        ...(campusFilter && { campusFilter }),
        ...(paymentMode && { paymentMode }),
        ...(studentIds && studentIds.length > 0 && { studentIds }),
        ...(includeVoided && { includeVoided }),
        ...(standardLevelId && { standardLevelId }),
      }
    : ("skip" as const);

  return {
    effectiveYearId,
    academicYearId,
    setAcademicYearId,
    dateFrom,
    dateTo,
    dateRange,
    setDateRange,
    datePresetLabel,
    setDatePresetLabel,
    dateRangeLabel,
    campusFilter,
    setCampusFilter,
    paymentMode,
    setPaymentMode,
    studentIds,
    setStudentIds,
    includeVoided,
    setIncludeVoided,
    standardLevelId,
    setStandardLevelId,
    resetAll,
    hasActiveFilters,
    queryArgs,
  };
}
