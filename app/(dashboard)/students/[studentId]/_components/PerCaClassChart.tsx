"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerCaChartPoint } from "@/lib/academicHistoryView";

type Props = {
  data: PerCaChartPoint[];
  subjectName?: string;
  loading?: boolean;
};

/**
 * Presentational "you vs class" line chart across CA-1/2/3 for one subject in a
 * single term. Consumes a pre-assembled 3-point `PerCaChartPoint[]` (built by
 * the container via `buildPerCaChartData`) — no data fetching here.
 *
 * A CA with a `null` value renders as a line gap (`connectNulls={false}`), never
 * a coerced-to-zero point, so absent marks read as "missing", not "scored 0".
 */
export function PerCaClassChart({ data, subjectName, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {/* <output> carries an implicit ARIA "status" role. */}
          <output aria-label="Loading chart" aria-busy="true">
            <Skeleton className="h-[260px] w-full" />
          </output>
        </CardContent>
      </Card>
    );
  }

  const hasAnyData = data.some(
    (point) => point.you !== null || point.classMean !== null,
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {subjectName ? (
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            {subjectName}: you vs class across CAs
          </h3>
        ) : null}
        {hasAnyData ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis dataKey="ca" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                name="You"
                type="monotone"
                dataKey="you"
                stroke="var(--color-school-green)"
                strokeWidth={2}
                connectNulls={false}
              />
              <Line
                name="Class"
                type="monotone"
                dataKey="classMean"
                stroke="var(--color-muted-foreground)"
                strokeWidth={2}
                strokeDasharray="4 4"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No CA data for this subject yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
