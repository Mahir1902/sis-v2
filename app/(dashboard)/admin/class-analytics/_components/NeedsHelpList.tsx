"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NeedsHelpRow, NeedsHelpStudent } from "@/lib/cohortView";
import { formatPercentage, getLetterGradeBadgeColor } from "@/lib/gradeUtils";

/**
 * Two shapes, discriminated by `mode` (DA #5):
 *  - "grouped" (no subject selected): each student appears ONCE with every
 *    subject they are failing nested beneath them.
 *  - "flat" (a subject IS selected): a plain one-row-per-student list, the
 *    subject shown as a subtitle line.
 */
type Props =
  | { mode: "grouped"; students: NeedsHelpStudent[] }
  | { mode: "flat"; rows: NeedsHelpRow[] };

/** Small percentage pill with a letter-grade colour; label conveys the grade. */
function GradePill({
  weightedAverage,
  letterGrade,
}: {
  weightedAverage: number;
  letterGrade: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="tabular-nums text-sm font-medium text-gray-900">
        {formatPercentage(weightedAverage)}
      </span>
      <Badge
        variant="outline"
        className={`${getLetterGradeBadgeColor(letterGrade)} text-xs`}
      >
        {letterGrade}
      </Badge>
    </span>
  );
}

/**
 * Presentational "who needs support" list for the cohort. Ordered lowest-grade
 * first by the container (`getStudentsNeedingHelp` / `groupNeedsHelpByStudent`);
 * this component only renders. The heading is "Needs Support" — never "Results"
 * (DA #6). Rows collapse to name + grade% with the subject on its own subtitle
 * line so nothing overflows at 375px (DA #8).
 */
export function NeedsHelpList(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle
            className="size-5 text-school-yellow"
            aria-hidden="true"
          />
          Needs Support
        </CardTitle>
        <CardDescription>
          Students below the 50% pass line, most at-risk first
        </CardDescription>
      </CardHeader>
      <CardContent>
        {props.mode === "grouped" ? (
          <ul className="divide-y">
            {props.students.map((student) => (
              <li key={student.studentId} className="py-3">
                <p className="font-medium text-gray-900">
                  {student.studentName}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {student.subjects.map((subject) => (
                    <li
                      key={subject.subjectId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-gray-600">
                        {subject.subjectName}
                      </span>
                      <GradePill
                        weightedAverage={subject.weightedAverage}
                        letterGrade={subject.letterGrade}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            {props.rows.map((row) => (
              <li
                key={`${row.studentId}-${row.subjectId}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">
                    {row.studentName}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {row.subjectName}
                  </span>
                </span>
                <GradePill
                  weightedAverage={row.weightedAverage}
                  letterGrade={row.letterGrade}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
