"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { AlertCircle, FileText, Receipt } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/shared/RoleGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useInvoiceFilters } from "@/hooks/use-invoice-filters";
import { InvoiceFilterToolbar } from "./_components/InvoiceFilterToolbar";
import { InvoiceSummaryCards } from "./_components/InvoiceSummaryCards";
import {
  type InvoiceRow,
  InvoiceTable,
  InvoiceTableSkeleton,
} from "./_components/InvoiceTable";
import { VoidInvoiceDialog } from "./_components/VoidInvoiceDialog";

/**
 * Invoices page (admin-only). The page itself is a thin RoleGate + Suspense
 * wrapper — all data / state / interaction live in `InvoicesPageContent` so
 * the role check is cheap and the body can use client hooks freely.
 */
export default function InvoicesPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <Suspense fallback={<InvoicePageFallback />}>
        <InvoicesPageContent />
      </Suspense>
    </RoleGate>
  );
}

function InvoicePageFallback() {
  return (
    <div className="space-y-6">
      <InvoicesHeader />
      <InvoiceTableSkeleton />
    </div>
  );
}

// ── Page content ────────────────────────────────────────────────────────────

function InvoicesPageContent() {
  // Static reference data (small lists, cached for the page's lifetime).
  const academicYears = useQuery(api.academicYears.list);
  const standardLevels = useQuery(api.standardLevels.list);
  const campuses = useQuery(api.campus.list);

  // Default to the most recent academic year so the list is never empty for
  // first-time visitors. `useInvoiceFilters` handles URL-sync internally.
  const defaultAcademicYearId = academicYears?.[0]?._id;
  const {
    filters,
    searchInput,
    setStatus,
    setAcademicYear,
    setStandardLevel,
    setCampus,
    setSearch,
    clearAll,
    hasActiveFilters,
  } = useInvoiceFilters(defaultAcademicYearId);

  // Aggregate query — drives the summary cards and the status-tab counts.
  // Skip until we know which academic year to anchor on.
  const aggregates = useQuery(
    api.invoices.getInvoiceAggregates,
    filters.academicYearId
      ? {
          academicYearId: filters.academicYearId,
          status: filters.status,
          ...(filters.standardLevelId && {
            standardLevelId: filters.standardLevelId,
          }),
          ...(filters.campusId && { campusId: filters.campusId }),
          // search is ignored server-side for aggregates — pass nothing.
        }
      : "skip",
  );

  // Paginated invoice list.
  const paginated = usePaginatedQuery(
    api.invoices.getInvoices,
    filters.academicYearId
      ? {
          academicYearId: filters.academicYearId,
          status: filters.status,
          ...(filters.standardLevelId && {
            standardLevelId: filters.standardLevelId,
          }),
          ...(filters.campusId && { campusId: filters.campusId }),
          ...(filters.search.trim() && { search: filters.search.trim() }),
        }
      : "skip",
    { initialNumItems: 50 },
  );

  // Void-dialog state — null = closed.
  const [voidTarget, setVoidTarget] = useState<{
    id: Id<"invoices">;
    number: string;
  } | null>(null);

  // ── Action handlers (TODO placeholders for sibling issues) ──────────────
  const handleView = (invoiceId: Id<"invoices">) => {
    // Issue #29 — wires the preview Sheet. Until then, surface a toast so the
    // user can see the action flow without us silently swallowing the click.
    toast.info("Preview sheet lands in issue #29", { id: `view-${invoiceId}` });
  };

  const handleSend = (invoiceId: Id<"invoices">) => {
    toast.info("Send action lands in issue #31", { id: `send-${invoiceId}` });
  };

  const handleDownloadPdf = (invoiceId: Id<"invoices">) => {
    toast.info("PDF download lands in issue #28", { id: `pdf-${invoiceId}` });
  };

  const handleGenerateInvoice = () => {
    toast.info("Invoice generation lands in a follow-up issue");
  };

  // ── Derived state ───────────────────────────────────────────────────────
  // `now` is captured per render so dueDate red-highlighting and the dynamic
  // overdue rule stay consistent across all rows in this render.
  const now = Date.now();

  // Pagination status from usePaginatedQuery. "LoadingFirstPage" → skeleton.
  const isInitialLoading = paginated.status === "LoadingFirstPage";
  const isLoadingMore = paginated.status === "LoadingMore";
  const canLoadMore = paginated.status === "CanLoadMore";

  const rows = (paginated.results ?? []) as InvoiceRow[];

  const footerTotals = aggregates
    ? {
        totalAmount: aggregates.aggregates.totalInvoiced,
        balance: aggregates.aggregates.totalOutstanding,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <InvoicesHeader />

      <InvoiceFilterToolbar
        searchInput={searchInput}
        onSearchChange={setSearch}
        status={filters.status}
        onStatusChange={setStatus}
        statusCounts={aggregates?.statusCounts}
        standardLevels={standardLevels}
        standardLevelId={filters.standardLevelId}
        onStandardLevelChange={setStandardLevel}
        campuses={campuses}
        campusId={filters.campusId}
        onCampusChange={setCampus}
        academicYears={academicYears}
        academicYearId={filters.academicYearId}
        onAcademicYearChange={setAcademicYear}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAll}
      />

      <InvoiceSummaryCards aggregates={aggregates?.aggregates} />

      {/* Body: skeleton → empty → table */}
      {isInitialLoading ? (
        <InvoiceTableSkeleton />
      ) : rows.length === 0 ? (
        <InvoiceListEmpty
          hasActiveFilters={hasActiveFilters}
          onGenerate={handleGenerateInvoice}
        />
      ) : (
        <>
          <InvoiceTable
            rows={rows}
            now={now}
            onView={handleView}
            onSend={handleSend}
            onDownloadPdf={handleDownloadPdf}
            onVoid={(id, number) => setVoidTarget({ id, number })}
            footerTotals={footerTotals}
          />
          {/* Load more */}
          {(canLoadMore || isLoadingMore) && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => paginated.loadMore(50)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <VoidInvoiceDialog
        invoiceId={voidTarget?.id ?? null}
        invoiceNumber={voidTarget?.number ?? null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
      />
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function InvoicesHeader() {
  return (
    <div className="flex items-center gap-3">
      <Receipt className="h-7 w-7 text-school-green" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate, send, and track invoices across the school
        </p>
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

interface EmptyProps {
  hasActiveFilters: boolean;
  onGenerate: () => void;
}

function InvoiceListEmpty({ hasActiveFilters, onGenerate }: EmptyProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <FileText
        className="h-10 w-10 text-muted-foreground"
        aria-hidden="true"
      />
      {hasActiveFilters ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900">
            No invoices match the current filters
          </h3>
          <p className="text-sm text-muted-foreground">
            Try clearing a filter or widening the date range.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-gray-900">
            No invoices yet
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Generate the first invoice from a student's fees tab or the
            collection workflow.
          </p>
          <Button
            type="button"
            onClick={onGenerate}
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            Generate Invoice
          </Button>
        </>
      )}
    </Card>
  );
}

// ── Error boundary helper ───────────────────────────────────────────────────
// Not currently used — Convex queries that throw surface the error through
// React Suspense (caught by Suspense above). If we need an inline destructive
// card later, render <InvoiceListError /> from a wrapping ErrorBoundary.

export function InvoiceListError({ message }: { message: string }) {
  return (
    <Card className="border-red-300 bg-red-50/50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-900">
            Could not load invoices
          </p>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </Card>
  );
}
