"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * URL-synced open state for the invoice preview Sheet (Issue #29).
 *
 * The currently-previewed invoice id lives in `?invoiceId=` so the sheet:
 *   - survives a browser refresh
 *   - is shareable as a deep link (matches the Issue #28 success-toast contract)
 *   - opens automatically when arriving at `/invoices?invoiceId=...`
 *
 * Why `router.replace` (not `router.push`)?
 * Opening/closing the sheet shouldn't pollute the back-stack. With `replace`,
 * the browser Back button takes the user to wherever they came from, not
 * through every open/close pair they triggered on this page.
 *
 * `{ scroll: false }` prevents Next.js from jumping the page to the top when
 * the URL updates — the sheet is a portal overlay; the page should stay put.
 *
 * Pure URL state — no Convex calls, no business logic.
 */
export interface UseInvoicePreviewResult {
  openInvoiceId: Id<"invoices"> | null;
  openPreview: (id: Id<"invoices">) => void;
  closePreview: () => void;
}

export function useInvoicePreview(): UseInvoicePreviewResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Validate shape: only treat non-empty strings as a real id. The backend
  // `getInvoiceById` returns null for unknown ids, and `InvoiceDocument`
  // renders its own "not found" state — so no further validation is needed
  // beyond the empty-string guard.
  const openInvoiceId = useMemo<Id<"invoices"> | null>(() => {
    const raw = searchParams.get("invoiceId");
    if (!raw) return null;
    return raw as Id<"invoices">;
  }, [searchParams]);

  const openPreview = useCallback(
    (id: Id<"invoices">) => {
      // Preserve every other search param (filters, etc.) — the sheet must
      // not disturb the underlying page state.
      const params = new URLSearchParams(searchParams.toString());
      params.set("invoiceId", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const closePreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invoiceId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { openInvoiceId, openPreview, closePreview };
}
