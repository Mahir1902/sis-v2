"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  calculateLetterGrade,
  getLetterGradeBadgeColor,
} from "@/lib/gradeUtils";
import { AssessmentDetailDialog } from "./AssessmentDetailDialog";

interface GradesTabProps {
  studentId: Id<"students">;
}

interface DetailDialogState {
  subjectId: Id<"subjects">;
  subjectName: string;
  assessmentNumber: 1 | 2 | 3;
}

export function GradesTab({ studentId }: GradesTabProps) {
  const enrollments = useQuery(api.enrollments.getEnrollmentHistory, {
    studentId,
  });
  const currentEnrollment = useQuery(api.enrollments.getCurrentEnrollment, {
    studentId,
  });

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [detailDialog, setDetailDialog] = useState<DetailDialogState | null>(
    null,
  );

  const activeEnrollmentId = (selectedEnrollmentId ||
    (currentEnrollment
      ? currentEnrollment._id
      : (enrollments?.[0]?._id ?? ""))) as Id<"enrollments"> | "";

  const grades = useQuery(
    api.computedGrades.getGradesByEnrollmentSemester,
    activeEnrollmentId
      ? {
          enrollmentId: activeEnrollmentId as Id<"enrollments">,
          semester: parseInt(selectedSemester, 10) as 1 | 2,
        }
      : "skip",
  );

  if (enrollments === undefined || currentEnrollment === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-gray-700">
          No Enrollments Found
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          This student has no enrollment history. Create an enrollment first.
        </p>
      </div>
    );
  }

  const activeEnrollment = enrollments.find(
    (e) => e._id === activeEnrollmentId,
  );

  const averagePercentage =
    grades && grades.length > 0
      ? grades.reduce((s, g) => s + g.weightedAverage, 0) / grades.length
      : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={
            selectedEnrollmentId ||
            (currentEnrollment?._id ?? enrollments[0]._id)
          }
          onValueChange={setSelectedEnrollmentId}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select enrollment" />
          </SelectTrigger>
          <SelectContent>
            {enrollments.map((e) => (
              <SelectItem key={e._id} value={e._id}>
                {e.academicYearDoc?.name} – {e.standardLevelDoc?.name}
                {e._id === currentEnrollment?._id && " (Current)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSemester}
          onValueChange={(v) => setSelectedSemester(v as "1" | "2")}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Semester 1</SelectItem>
            <SelectItem value="2">Semester 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary banner */}
      {averagePercentage !== null && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border text-sm">
          <span className="text-gray-500">Average:</span>
          <span className="font-semibold text-gray-900">
            {averagePercentage.toFixed(1)}%
          </span>
          <Badge
            className={getLetterGradeBadgeColor(
              calculateLetterGrade(averagePercentage),
            )}
          >
            {calculateLetterGrade(averagePercentage)}
          </Badge>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            {grades?.length ?? 0} subject{grades?.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Grades table */}
      {grades === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-500 font-medium">
            No grades yet for this semester
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Grades update automatically as marks are entered for this
            semester&apos;s assessments (CA-1/2/3).
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Subject</TableHead>
                <TableHead className="text-center">CA-1</TableHead>
                <TableHead className="text-center">CA-2</TableHead>
                <TableHead className="text-center">CA-3</TableHead>
                <TableHead className="text-center">Weighted Avg</TableHead>
                <TableHead className="text-center">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => (
                <TableRow key={g._id}>
                  <TableCell className="font-medium">
                    {g.subjectDoc?.name ?? "—"}
                  </TableCell>
                  {([1, 2, 3] as const).map((caNum) => {
                    const marks =
                      caNum === 1
                        ? g.ca1Marks
                        : caNum === 2
                          ? g.ca2Marks
                          : g.ca3Marks;
                    const total =
                      caNum === 1
                        ? g.ca1TotalMarks
                        : caNum === 2
                          ? g.ca2TotalMarks
                          : g.ca3TotalMarks;
                    const pct =
                      caNum === 1
                        ? g.ca1Percentage
                        : caNum === 2
                          ? g.ca2Percentage
                          : g.ca3Percentage;
                    const hasData = marks !== undefined && total;

                    return (
                      <TableCell key={caNum} className="text-center text-sm">
                        {hasData ? (
                          <button
                            type="button"
                            className="hover:bg-gray-100 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                            aria-label={`View CA-${caNum} detail for ${g.subjectDoc?.name}`}
                            onClick={() =>
                              setDetailDialog({
                                subjectId: g.subjectId,
                                subjectName: g.subjectDoc?.name ?? "Unknown",
                                assessmentNumber: caNum,
                              })
                            }
                          >
                            {marks}/{total}
                            {pct !== undefined && (
                              <span className="text-gray-400 text-xs block">
                                {pct.toFixed(1)}%
                              </span>
                            )}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-semibold">
                    {g.weightedAverage.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getLetterGradeBadgeColor(g.letterGrade)}>
                      {g.letterGrade}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* CA score drill-down dialog */}
      {detailDialog && activeEnrollment && (
        <AssessmentDetailDialog
          open={!!detailDialog}
          onClose={() => setDetailDialog(null)}
          studentId={studentId}
          subjectId={detailDialog.subjectId}
          subjectName={detailDialog.subjectName}
          semester={parseInt(selectedSemester, 10) as 1 | 2}
          standardLevelId={activeEnrollment.standardLevelId}
          academicYearId={activeEnrollment.academicYear}
          assessmentNumber={detailDialog.assessmentNumber}
        />
      )}
    </div>
  );
}
