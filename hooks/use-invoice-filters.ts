"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { InvoiceStatus } from "@/lib/invoiceTableUtils";

/**
 * URL-synced filter state for the invoice list page.
 *
 * Why URL sync?  Filter state is the most-shared piece of context an admin
 * passes between tabs ("look at this overdue list"), and the back/forward
 * stack should preserve the view the user just left.
 *
 * Mirrors the `use-transaction-filters` pattern but trades the in-memory state
 * for `useSearchParams` + `router.replace` so refreshing the page keeps the
 * current view. We avoid the `nuqs` dependency — the project does not pull it
 * in elsewhere and the read/write surface here is small.
 *
 * Search is the one filter that is NOT mirrored to the URL: typing on every
 * keystroke would flood the history. It is held in local state and debounced
 * (300 ms) before reaching the consumer.
 */

const STATUS_VALUES = [
  "all",
  "draft",
  "issued",
  "paid",
  "overdue",
  "voided",
] as const;

export type InvoiceStatusFilter = (typeof STATUS_VALUES)[number];

/** Type guard — narrows a raw query param to the union or returns null. */
function parseStatus(raw: string | null): InvoiceStatusFilter | null {
  if (!raw) return null;
  return (STATUS_VALUES as readonly string[]).includes(raw)
    ? (raw as InvoiceStatusFilter)
    : null;
}

export interface InvoiceFilters {
  academicYearId: Id<"academicYears"> | undefined;
  status: InvoiceStatusFilter;
  standardLevelId: Id<"standardLevels"> | undefined;
  campusId: Id<"campuses"> | undefined;
  search: string;
}

/** Convenience: maps the page-level filter status to the InvoiceStatus union. */
export function asInvoiceStatus(
  s: InvoiceStatusFilter,
): InvoiceStatus | undefined {
  return s === "all" ? undefined : s;
}

/**
 * URL-synced invoice filter hook.
 *
 * @param defaultAcademicYearId The most recent academic year — used so the
 *   table is anchored even when the URL has no `academicYearId` query param.
 *   If undefined (academic years still loading) the hook returns
 *   `academicYearId: undefined` so the parent can skip the query.
 */
export function useInvoiceFilters(
  defaultAcademicYearId: Id<"academicYears"> | undefined,
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filter state from the URL on every render — `useSearchParams` is
  // stable across renders for the same query string, so this is cheap.
  const academicYearParam = searchParams.get("academicYearId");
  const standardLevelParam = searchParams.get("standardLevelId");
  const campusParam = searchParams.get("campusId");
  const statusParam = searchParams.get("status");

  const status: InvoiceStatusFilter = parseStatus(statusParam) ?? "all";
  const academicYearId =
    (academicYearParam as Id<"academicYears"> | null) ?? undefined;
  const standardLevelId =
    (standardLevelParam as Id<"standardLevels"> | null) ?? undefined;
  const campusId = (campusParam as Id<"campuses"> | null) ?? undefined;

  // Search lives in local state and is debounced before reaching consumers.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Generic patch helper — sets/clears a query param without disturbing others.
  const patchParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?");
    },
    [router, searchParams],
  );

  const setStatus = useCallback(
    (value: InvoiceStatusFilter) => {
      // "all" is the default — clear it from the URL to keep the URL clean.
      patchParams({ status: value === "all" ? undefined : value });
    },
    [patchParams],
  );

  const setAcademicYear = useCallback(
    (value: Id<"academicYears"> | undefined) => {
      patchParams({ academicYearId: value });
    },
    [patchParams],
  );

  const setStandardLevel = useCallback(
    (value: Id<"standardLevels"> | undefined) => {
      patchParams({ standardLevelId: value });
    },
    [patchParams],
  );

  const setCampus = useCallback(
    (value: Id<"campuses"> | undefined) => {
      patchParams({ campusId: value });
    },
    [patchParams],
  );

  const setSearch = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const clearAll = useCallback(() => {
    setSearchInput("");
    // Clear every URL filter at once — academic year falls back to the default.
    patchParams({
      academicYearId: undefined,
      standardLevelId: undefined,
      campusId: undefined,
      status: undefined,
    });
  }, [patchParams]);

  // The effective academicYearId is whatever the URL says, falling back to the
  // freshest academic year so the page is never querying with `undefined`
  // unless we are explicitly skipping (which we do when defaultAcademicYearId
  // is still loading).
  const effectiveAcademicYearId = academicYearId ?? defaultAcademicYearId;

  const hasActiveFilters =
    standardLevelId !== undefined ||
    campusId !== undefined ||
    status !== "all" ||
    debouncedSearch.trim().length > 0 ||
    // An explicit academicYearId in the URL that differs from the default counts
    // as an active filter (the user has chosen a non-default year).
    (academicYearId !== undefined && academicYearId !== defaultAcademicYearId);

  const filters: InvoiceFilters = useMemo(
    () => ({
      academicYearId: effectiveAcademicYearId,
      status,
      standardLevelId,
      campusId,
      search: debouncedSearch,
    }),
    [
      effectiveAcademicYearId,
      status,
      standardLevelId,
      campusId,
      debouncedSearch,
    ],
  );

  return {
    /** Stable filter object — pass straight to the Convex query. */
    filters,
    /** The raw search input value (use to drive the `<Input>` value prop). */
    searchInput,
    setStatus,
    setAcademicYear,
    setStandardLevel,
    setCampus,
    setSearch,
    clearAll,
    hasActiveFilters,
  };
}
