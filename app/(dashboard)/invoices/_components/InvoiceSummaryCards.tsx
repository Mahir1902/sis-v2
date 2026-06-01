"use client";

import { AlertTriangle, CheckCircle2, Receipt, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";

export interface InvoiceAggregates {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
}

interface Props {
  aggregates: InvoiceAggregates | undefined;
}

/**
 * The four summary cards that sit at the top of the invoice list page.
 *
 * Each card formats its number as BDT currency so the user sees the symbol the
 * rest of the finance UI uses. The Overdue card highlights its value in red as
 * a visual cue — but the icon also carries the meaning so the highlight is not
 * the sole signal.
 */
export function InvoiceSummaryCards({ aggregates }: Props) {
  if (!aggregates) {
    return <InvoiceSummaryCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="Total Invoiced"
        value={aggregates.totalInvoiced}
        icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="Total Collected"
        value={aggregates.totalCollected}
        icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="Total Outstanding"
        value={aggregates.totalOutstanding}
        icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="Total Overdue"
        value={aggregates.totalOverdue}
        valueClassName={
          aggregates.totalOverdue > 0 ? "text-red-600" : undefined
        }
        icon={
          <AlertTriangle
            className={
              aggregates.totalOverdue > 0
                ? "h-4 w-4 text-red-500"
                : "h-4 w-4 text-muted-foreground"
            }
            aria-hidden="true"
          />
        }
      />
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}

function SummaryCard({ title, value, icon, valueClassName }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${valueClassName ?? ""}`.trim()}
          data-testid={`summary-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {formatCurrency(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceSummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => `sk-${i}`).map((key) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
