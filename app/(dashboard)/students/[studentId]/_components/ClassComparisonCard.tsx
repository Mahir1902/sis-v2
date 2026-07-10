"use client";

import { useQuery } from "convex/react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatDelta,
  ordinal,
  provisionalLabel,
  type SubjectRowSeed,
  type SubjectRowView,
} from "@/lib/academicHistoryView";
import { formatPercentage } from "@/lib/gradeUtils";

/** Shared query args for a single term's class averages, one subject at a time. */
export type ClassComparisonQueryArgs = {
  standardLevelId: Id<"standardLevels">;
  academicYear: Id<"academicYears">;
  semester: 1 | 2;
  studentId: Id<"students">;
};

/** Copy shown in the Class column when there is no cohort baseline yet. */
const NO_CLASS_DATA_COPY = "not enough class data yet";

/**
 * Shared 5-column grid template (Subject / You / Class / Δ / Position) so the
 * header labels and the data rows always line up.
 */
const ROW_GRID = "grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr] gap-3";

/** Direction icon + accent token for a formatted delta. */
function DeltaIndicator({ delta }: { delta: number | null }) {
  const d = formatDelta(delta);
  if (d === null) {
    return null;
  }
  if (d.direction === "up") {
    return (
      <span
        role="img"
        className="inline-flex items-center gap-1 text-school-green"
        aria-label={`${d.text.replace("+", "")} above class`}
      >
        <TrendingUp
          className="size-4"
          data-testid="delta-up-icon"
          aria-hidden
        />
        <span aria-hidden>{d.text}</span>
      </span>
    );
  }
  if (d.direction === "down") {
    return (
      <span
        role="img"
        className="inline-flex items-center gap-1 text-red-600"
        aria-label={`${d.text.replace("-", "")} below class`}
      >
        <TrendingDown
          className="size-4"
          data-testid="delta-down-icon"
          aria-hidden
        />
        <span aria-hidden>{d.text}</span>
      </span>
    );
  }
  return (
    <span
      role="img"
      className="inline-flex items-center gap-1 text-muted-foreground"
      aria-label="same as class"
    >
      <Minus className="size-4" data-testid="delta-flat-icon" aria-hidden />
      <span aria-hidden>{d.text}</span>
    </span>
  );
}

/**
 * PURE presentational row for one subject's you-vs-class comparison.
 * Renders name, the student's average, the class average (or a suppression
 * message), the signed delta with a direction icon, class position, and a
 * provisional badge when the term is not yet complete.
 */
export function SubjectComparisonRowView({ data }: { data: SubjectRowView }) {
  return (
    <div
      className={`${ROW_GRID} items-center border-b px-2 py-3 text-sm last:border-b-0`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium">{data.subjectName}</span>
        {data.provisional ? (
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Provisional</Badge>
            <span className="text-xs text-muted-foreground">
              {provisionalLabel(data.presentCaCount, data.expectedCaCount)}
            </span>
          </span>
        ) : null}
      </div>

      <span className="tabular-nums">
        {formatPercentage(data.weightedAverage)}
      </span>

      <span className="tabular-nums text-muted-foreground">
        {data.classAverage === null ? (
          <span className="text-xs">{NO_CLASS_DATA_COPY}</span>
        ) : (
          formatPercentage(data.classAverage)
        )}
      </span>

      <span className="tabular-nums">
        <DeltaIndicator delta={data.delta} />
      </span>

      <span className="text-muted-foreground">
        {data.position ? (
          `${ordinal(data.position.rank)} of ${data.position.outOf}`
        ) : (
          <span aria-hidden>—</span>
        )}
      </span>
    </div>
  );
}

/**
 * Fetch wrapper for a single subject row. It is the ONLY place that calls
 * useQuery(getClassAverages) — one query per row, at component top level, so
 * there is no Rules-of-Hooks violation from mapping over subjects. Thin by
 * design and verified live rather than unit-tested (needs a Convex provider).
 */
export function SubjectComparisonRow({
  seed,
  queryArgs,
}: {
  seed: SubjectRowSeed;
  queryArgs: ClassComparisonQueryArgs;
}) {
  const res = useQuery(api.computedGrades.getClassAverages, {
    standardLevelId: queryArgs.standardLevelId,
    academicYear: queryArgs.academicYear,
    subjectId: seed.subjectId,
    semester: queryArgs.semester,
    studentId: queryArgs.studentId,
  });

  if (res === undefined) {
    // <output> carries an implicit ARIA "status" role.
    return (
      <output
        className="flex items-center gap-3 border-b px-2 py-3 last:border-b-0"
        aria-label={`Loading class comparison for ${seed.subjectName}`}
      >
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </output>
    );
  }

  const data: SubjectRowView = {
    ...seed,
    classAverage: res.classAverage,
    delta: res.student?.delta ?? null,
  };

  return <SubjectComparisonRowView data={data} />;
}

/**
 * Card shell for the "You vs Class" per-subject comparison. Renders a labelled
 * header row and one fetching row per subject seed. Handles the loading and
 * empty states itself; each subject's class-average fetch is handled by the
 * child SubjectComparisonRow.
 */
export function ClassComparisonCard({
  rows,
  queryArgs,
  loading,
}: {
  rows: SubjectRowSeed[];
  queryArgs: ClassComparisonQueryArgs;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>You vs Class</CardTitle>
        <CardDescription>
          Your subject averages against the class this term
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          // <output> carries an implicit ARIA "status" role.
          <output
            className="flex flex-col gap-3"
            aria-label="Loading subject comparison"
          >
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </output>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No graded subjects this term yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[32rem]">
              <div
                className={`${ROW_GRID} border-b px-2 pb-2 text-xs font-medium text-muted-foreground`}
              >
                <span>Subject</span>
                <span>You</span>
                <span>Class</span>
                <span>
                  <span aria-hidden>Δ</span>
                  <span className="sr-only">Difference from class</span>
                </span>
                <span>Position</span>
              </div>
              {rows.map((seed) => (
                <SubjectComparisonRow
                  key={seed.subjectId}
                  seed={seed}
                  queryArgs={queryArgs}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
