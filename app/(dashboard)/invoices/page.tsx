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
import { useInvoicePdfDownload } from "@/hooks/use-invoice-pdf-download";
import { useInvoicePreview } from "@/hooks/use-invoice-preview";
import { useInvoiceSelection } from "@/hooks/use-invoice-selection";
import { BulkVoidInvoicesDialog } from "./_components/BulkVoidInvoicesDialog";
import { GenerateInvoiceDialog } from "./_components/GenerateInvoiceDialog";
import { InvoiceFilterToolbar } from "./_components/InvoiceFilterToolbar";
import { InvoicePreviewSheet } from "./_components/InvoicePreviewSheet";
import { InvoiceSelectionBar } from "./_components/InvoiceSelectionBar";
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

  // Generate-invoice dialog state. Single dialog drives both the header
  // button and the empty state CTA.
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  // Bulk-void dialog state — opened from the floating selection bar.
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);

  // PDF download hook — issue #28. Wires both the row action and the bulk bar.
  const { downloadSingle, downloadBulk, isGenerating } =
    useInvoicePdfDownload();

  // Preview Sheet open state — Issue #29. URL-param backed so the sheet
  // survives refresh and is shareable as `/invoices?invoiceId=...`.
  const { openInvoiceId, openPreview, closePreview } = useInvoicePreview();

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

  // ── Selection ───────────────────────────────────────────────────────────
  // Composite filter signature — when this changes the hook clears the
  // selection and emits a toast. Single string keeps the effect's dependency
  // list honest for biome's exhaustive-deps rule.
  const filterSig = `${filters.status}|${filters.academicYearId ?? ""}|${filters.standardLevelId ?? ""}|${filters.campusId ?? ""}|${filters.search}`;
  const {
    selectedIds,
    selectionTotalValue,
    toggleRow,
    toggleAll,
    clearSelection,
  } = useInvoiceSelection({ visibleRows: rows, filterSig });

  // ── Action handlers ─────────────────────────────────────────────────────
  const handleView = (invoiceId: Id<"invoices">) => openPreview(invoiceId);

  // Compose Email / Mark as Issued / Record Payment all live inside the
  // preview Sheet's action toolbar (issue #31). The row's "Send" entry opens
  // the Sheet so the admin can pick whichever action matches the invoice's
  // current status.
  const handleSend = (invoiceId: Id<"invoices">) => openPreview(invoiceId);

  const handleDownloadPdf = (invoiceId: Id<"invoices">) => {
    void downloadSingle(invoiceId);
  };

  const handleGenerateInvoice = () => {
    setGenerateDialogOpen(true);
  };

  const handleBulkPdfDownload = () => {
    void downloadBulk(Array.from(selectedIds));
  };
  // Bulk send is repurposed as Bulk Mark as Issued in issue #30 (ADR-0001).
  // Until that lands, fire a stub so the selection bar still exposes the
  // affordance and surfaces the planned path.
  const handleBulkSend = () =>
    toast.info("Bulk Mark as Issued lands in issue #30", { id: "bulk-send" });
  const handleBulkVoid = () => setBulkVoidOpen(true);

  return (
    <div className="space-y-6">
      <InvoicesHeader onGenerate={handleGenerateInvoice} />

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
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
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

      <InvoicePreviewSheet invoiceId={openInvoiceId} onClose={closePreview} />

      <InvoiceSelectionBar
        count={selectedIds.size}
        totalValue={selectionTotalValue}
        onSend={handleBulkSend}
        onDownloadPdf={handleBulkPdfDownload}
        onVoid={handleBulkVoid}
        onClear={clearSelection}
        isGenerating={isGenerating}
      />

      <GenerateInvoiceDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />

      <BulkVoidInvoicesDialog
        open={bulkVoidOpen}
        onOpenChange={setBulkVoidOpen}
        invoiceIds={Array.from(selectedIds)}
        onSuccess={clearSelection}
      />
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

interface InvoicesHeaderProps {
  onGenerate?: () => void;
}

function InvoicesHeader({ onGenerate }: InvoicesHeaderProps = {}) {
  return (
    <div className="flex items-start justify-between gap-3">
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
      {onGenerate && (
        <Button
          type="button"
          onClick={onGenerate}
          className="bg-school-green text-white hover:bg-school-green/90"
          aria-label="Generate a new invoice"
        >
          Generate Invoice
        </Button>
      )}
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
