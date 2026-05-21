"use client";

import { Building2, DollarSign, Receipt, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/transactionLogUtils";

interface Aggregates {
  totalAmount: number;
  sessionCount: number;
  byPaymentMode: Record<string, number>;
  byCampus: Record<string, number>;
}

interface SummaryCardsProps {
  aggregates: Aggregates | undefined;
}

export function SummaryCards({ aggregates }: SummaryCardsProps) {
  if (!aggregates) {
    return <SummaryCardsSkeleton />;
  }

  const cash = aggregates.byPaymentMode.Cash ?? 0;
  let digital = 0;
  for (const [mode, amount] of Object.entries(aggregates.byPaymentMode)) {
    if (mode !== "Cash") digital += amount;
  }

  const campusEntries = Object.entries(aggregates.byCampus).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Collected */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(aggregates.totalAmount)}
          </div>
        </CardContent>
      </Card>

      {/* Session Count */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{aggregates.sessionCount}</div>
        </CardContent>
      </Card>

      {/* Cash vs Digital */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash vs Digital</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cash</span>
              <span className="font-medium">{formatCurrency(cash)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Digital</span>
              <span className="font-medium">{formatCurrency(digital)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Campus */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">By Campus</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {campusEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              campusEntries.slice(0, 3).map(([campus, amount]) => (
                <div
                  key={campus}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {campus}
                  </span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))
            )}
            {campusEntries.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{campusEntries.length - 3} more
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => `card-sk-${i}`).map((key) => (
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
