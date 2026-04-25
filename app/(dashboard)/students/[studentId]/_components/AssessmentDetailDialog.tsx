"use client";

import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface AssessmentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  studentId: Id<"students">;
  subjectName: string;
  subjectId: Id<"subjects">;
  semester: 1 | 2;
  standardLevelId: Id<"standardLevels">;
  academicYearId: Id<"academicYears">;
  assessmentNumber: 1 | 2 | 3;
}

export function AssessmentDetailDialog({
  open,
  onClose,
  studentId,
  subjectName,
  subjectId,
  semester,
  standardLevelId,
  academicYearId,
  assessmentNumber,
}: AssessmentDetailDialogProps) {
  const detail = useQuery(
    api.studentAssessmentAnswers.getStudentAssessmentDetail,
    open
      ? {
          studentId,
          subjectId,
          semester,
          standardLevelId,
          academicYearId,
          assessmentNumber,
        }
      : "skip",
  );

  const percentage =
    detail && detail.totalPossible > 0
      ? (detail.totalObtained / detail.totalPossible) * 100
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {subjectName} — CA-{assessmentNumber}
          </DialogTitle>
        </DialogHeader>

        {detail === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : detail === null ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 font-medium">No assessment found</p>
            <p className="text-sm text-gray-400 mt-1">
              CA-{assessmentNumber} has not been created for this subject yet.
            </p>
          </div>
        ) : detail.questions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 font-medium">No questions configured</p>
            <p className="text-sm text-gray-400 mt-1">
              This assessment has no questions added yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {detail.isAbsent && <Badge variant="destructive">Absent</Badge>}

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="text-center w-20">Max</TableHead>
                    <TableHead className="text-center w-24">Obtained</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.questions.map((q) => (
                    <TableRow key={q.questionNumber}>
                      <TableCell className="text-gray-500">
                        Q{q.questionNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {q.questionText || (
                          <span className="text-gray-400 italic">
                            No description
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {q.marksAllocated}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {q.marksObtained !== null ? (
                          q.marksObtained
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell />
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">
                      {detail.totalPossible}
                    </TableCell>
                    <TableCell className="text-center">
                      {detail.totalObtained}
                      {percentage !== null && (
                        <span className="text-gray-500 text-xs font-normal ml-1">
                          ({percentage.toFixed(1)}%)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
