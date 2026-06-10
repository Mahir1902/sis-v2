"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, FileWarning, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";
import { RoleGate } from "@/components/shared/RoleGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ReceiptDetailPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <ReceiptDetailContent />
    </RoleGate>
  );
}

function ReceiptDetailContent() {
  const params = useParams();
  const router = useRouter();
  const receiptId = params.receiptId as Id<"receipts">;

  const receipt = useQuery(api.receipts.getReceipt, { receiptId });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-gray-600"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          disabled={receipt === undefined || receipt === null}
        >
          <Printer className="mr-1 h-4 w-4" />
          Print
        </Button>
      </div>

      {receipt === undefined ? (
        <ReceiptDetailSkeleton />
      ) : receipt === null ? (
        <ReceiptNotFound />
      ) : (
        <ReceiptDocument receipt={receipt} />
      )}
    </div>
  );
}

function ReceiptDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-lg border bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="ml-auto h-4 w-32" />
          <Skeleton className="ml-auto h-6 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function ReceiptNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
      <FileWarning className="h-12 w-12 text-muted-foreground/50" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Receipt not found
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        It may have been deleted, or the link is incorrect.
      </p>
    </div>
  );
}
