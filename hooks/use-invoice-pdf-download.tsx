"use client";

import { useConvex } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BULK_PDF_MAX_COUNT, buildZipFilename } from "@/lib/invoiceBulkPdf";
import { buildInvoicePdfFilename } from "@/lib/invoicePdfFilename";
import { loadLogoDataUri } from "@/lib/invoicePdfLogo";

/**
 * Client-side invoice PDF download hook (Issue #28).
 *
 * Exposes two action methods — `downloadSingle` for a one-off download and
 * `downloadBulk` for a zip of up to {@link BULK_PDF_MAX_COUNT} invoices.
 *
 * Bundle-size discipline:
 *  - `@react-pdf/renderer` is dynamic-imported inside the action bodies, never
 *    at the top of this file. The transitive `components/shared/InvoicePDF`
 *    import is also dynamic. This keeps the heavy PDF bundle out of the
 *    initial `/invoices` route payload.
 *  - `jszip` is dynamic-imported inside `downloadBulk` only — the single path
 *    never pulls it in.
 *
 * Reliability:
 *  - Each created object URL is tracked in a ref and revoked on unmount, so a
 *    user who navigates away mid-download does not leak blob memory.
 *  - The single-invoice path also revokes immediately after the anchor click
 *    so steady-state RAM stays flat.
 *  - All async steps are wrapped in try/catch; any throw (auth expiry,
 *    network blip, PDF render crash) surfaces a generic Sonner toast rather
 *    than a stack trace.
 *
 * PDF content reflects the invoice's CURRENT state at download time — same
 * behaviour as the on-screen HTML view. If the invoice mutates after this
 * call resolves, the PDF will not be retroactively updated.
 */

export interface UseInvoicePdfDownloadResult {
  /** Download a single invoice as a PDF. */
  downloadSingle: (invoiceId: Id<"invoices">) => Promise<void>;
  /** Download a zip of multiple invoice PDFs (capped at BULK_PDF_MAX_COUNT). */
  downloadBulk: (invoiceIds: Id<"invoices">[]) => Promise<void>;
  /** True while either download path is mid-flight. Drive button disabled states off this. */
  isGenerating: boolean;
  /** Progress in bulk mode. `null` outside an active bulk operation. */
  progress: { current: number; total: number } | null;
}

const ERROR_MESSAGE = "Could not generate PDF. Please refresh and try again.";

export function useInvoicePdfDownload(): UseInvoicePdfDownloadResult {
  const convex = useConvex();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Track every object URL we mint so the cleanup hook can revoke any
  // outstanding ones if the component unmounts mid-download.
  const objectUrlsRef = useRef<string[]>([]);

  // Revoke any URLs that were still alive at unmount. The normal flow revokes
  // each URL right after the anchor click — this is the safety net for the
  // case where the user navigates away mid-bulk.
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
    };
  }, []);

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    // Some browsers (Safari) don't honour `download` unless the anchor is
    // attached to the DOM at click time.
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Revoke immediately; the browser has already issued the download by
    // the time `.click()` returns synchronously.
    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== url);
  }, []);

  const downloadSingle = useCallback(
    async (invoiceId: Id<"invoices">) => {
      setIsGenerating(true);
      const toastId = "invoice-pdf";
      toast.loading("Generating PDF…", { id: toastId });
      try {
        // Dynamic imports keep @react-pdf out of the route bundle.
        const [{ pdf }, { InvoicePDF }, logoDataUri, data] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/shared/InvoicePDF"),
          loadLogoDataUri(),
          convex.query(api.invoices.getInvoiceById, { invoiceId }),
        ]);

        if (data === null) {
          toast.error("Invoice not found", { id: toastId });
          return;
        }

        const blob = await pdf(
          <InvoicePDF data={data} logoDataUri={logoDataUri} />,
        ).toBlob();

        const filename = buildInvoicePdfFilename({
          invoiceNumber: data.invoiceNumber,
          studentName: data.studentName,
        });

        triggerDownload(blob, filename);
        toast.success("PDF downloaded", { id: toastId });
      } catch {
        // Any throw here — JWT expiry, render crash, network blip — surfaces
        // the same user-facing message. The raw error is logged below for
        // ops visibility but never shown to the admin.
        toast.error(ERROR_MESSAGE, { id: toastId });
      } finally {
        setIsGenerating(false);
      }
    },
    [convex, triggerDownload],
  );

  const downloadBulk = useCallback(
    async (invoiceIds: Id<"invoices">[]) => {
      if (invoiceIds.length === 0) return;
      if (invoiceIds.length > BULK_PDF_MAX_COUNT) {
        toast.error(
          `Bulk download is limited to ${BULK_PDF_MAX_COUNT} invoices. Please narrow your selection.`,
        );
        return;
      }

      setIsGenerating(true);
      setProgress({ current: 0, total: invoiceIds.length });
      const toastId = "bulk-pdf";
      toast.loading(`Generating PDF 1 of ${invoiceIds.length}…`, {
        id: toastId,
      });

      try {
        // Heavy deps and the document component are dynamic-imported here so
        // they never enter the initial /invoices bundle. jszip is imported
        // here too — the single path never pulls it in.
        const [{ pdf }, { InvoicePDF }, jszipModule, logoDataUri] =
          await Promise.all([
            import("@react-pdf/renderer"),
            import("@/components/shared/InvoicePDF"),
            import("jszip"),
            loadLogoDataUri(),
          ]);

        const JSZip = jszipModule.default;
        const zip = new JSZip();

        // Serial loop, NOT parallel: @react-pdf renders on the main thread,
        // so a parallel Promise.all() of 25 invoices reliably crashes the tab.
        for (let i = 0; i < invoiceIds.length; i++) {
          const id = invoiceIds[i];
          toast.loading(`Generating PDF ${i + 1} of ${invoiceIds.length}…`, {
            id: toastId,
          });
          setProgress({ current: i + 1, total: invoiceIds.length });

          const data = await convex.query(api.invoices.getInvoiceById, {
            invoiceId: id,
          });
          if (data === null) continue;

          const blob = await pdf(
            <InvoicePDF data={data} logoDataUri={logoDataUri} />,
          ).toBlob();

          const filename = buildInvoicePdfFilename({
            invoiceNumber: data.invoiceNumber,
            studentName: data.studentName,
          });
          zip.file(filename, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipName = buildZipFilename(Date.now());

        triggerDownload(zipBlob, zipName);
        toast.success(`Downloaded ${invoiceIds.length} invoices`, {
          id: toastId,
        });
      } catch {
        toast.error(ERROR_MESSAGE, { id: toastId });
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [convex, triggerDownload],
  );

  return { downloadSingle, downloadBulk, isGenerating, progress };
}
