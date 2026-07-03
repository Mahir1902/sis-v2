"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CURRENT_STANDING_SUBTITLE,
  CURRENT_STANDING_TITLE,
  type GradeSpreadDatum,
  gradeCountLabel,
} from "@/lib/cohortView";

type Props = {
  /** Ordered A+…F series from `buildGradeSpreadSeries`. */
  series: GradeSpreadDatum[];
  /** Total graded rows in the selection (`getGradeSpread().total`). */
  total: number;
  loading?: boolean;
};

/**
 * Presentational A–F grade-distribution bar chart for the cohort ("Current
 * Standing"). Consumes a pre-built ordered series (`buildGradeSpreadSeries`) —
 * no data fetching or transformation here.
 *
 * The title is deliberately "Current Standing" (never "Results", DA #6) and a
 * VISIBLE subtitle warns the spread includes in-progress grades. A fixed chart
 * height with `ResponsiveContainer width="100%"` keeps it stable on mobile
 * (375px) without horizontal overflow (DA #8). jsdom renders the container at
 * 0×0 so no SVG paths appear under test — assert only on the text/roles here.
 */
export function GradeSpreadChart({ series, total, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {/* <output> carries an implicit ARIA "status" role. */}
          <output aria-label="Loading grade distribution" aria-busy="true">
            <Skeleton className="h-[240px] w-full" />
          </output>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{CURRENT_STANDING_TITLE}</CardTitle>
        <CardDescription>{CURRENT_STANDING_SUBTITLE}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          <span className="font-medium text-gray-700">
            {gradeCountLabel(total)}
          </span>{" "}
          in this selection
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar
              name="Students"
              dataKey="count"
              fill="var(--color-school-green)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
