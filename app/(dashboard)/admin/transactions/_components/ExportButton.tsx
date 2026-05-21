"use client";

import { useConvex } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildTransactionCSVRows,
  CSV_EXPORT_HEADERS,
  downloadCSV,
  generateCSVContent,
  generateTransactionFilename,
} from "@/lib/csvExport";

type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "Online";

interface ExportButtonProps {
  queryArgs: {
    academicYearId: Id<"academicYears">;
    dateFrom?: number;
    dateTo?: number;
    campusFilter?: Id<"campuses">;
    paymentMode?: PaymentMode;
    studentIds?: Id<"students">[];
    includeVoided?: boolean;
    standardLevelId?: Id<"standardLevels">;
  } | null;
  yearName: string;
  levelName?: string;
  dateRangeLabel?: string;
  disabled?: boolean;
}

export function ExportButton({
  queryArgs,
  yearName,
  levelName,
  dateRangeLabel,
  disabled,
}: ExportButtonProps) {
  const convex = useConvex();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!queryArgs) return;

    setIsExporting(true);
    try {
      const data = await convex.query(
        api.transactionLog.getTransactionLogExport,
        queryArgs,
      );

      if (data.rows.length === 0) {
        toast.error("No data to export");
        return;
      }

      const rows = buildTransactionCSVRows(data.rows);
      const content = generateCSVContent([...CSV_EXPORT_HEADERS], rows);
      const filename = generateTransactionFilename(
        yearName,
        levelName,
        dateRangeLabel,
      );
      downloadCSV(content, filename);
      toast.success(`Exported ${data.rows.length} line items`);
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!queryArgs || disabled || isExporting}
      aria-label="Export transactions as CSV"
    >
      {isExporting ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      Export CSV
    </Button>
  );
}
