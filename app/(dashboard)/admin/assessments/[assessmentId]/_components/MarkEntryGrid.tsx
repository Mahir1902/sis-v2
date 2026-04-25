"use client";

import { useMutation, useQuery } from "convex/react";
import { Save, Users, UserX } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MarkEntryGridProps {
  assessmentId: Id<"assessments">;
  assessment: {
    _id: Id<"assessments">;
    totalMarks: number;
    standardLevelId: Id<"standardLevels">;
    academicYearId: Id<"academicYears">;
    questions: Array<{
      _id: Id<"assessmentQuestions">;
      questionNumber: number;
      marksAllocated: number;
    }>;
  };
}

interface ChangeEntry {
  studentId: string;
  enrollmentId: string;
  questionId: string;
  value: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MarkEntryGrid({
  assessmentId,
  assessment,
}: MarkEntryGridProps) {
  const enrollments = useQuery(api.enrollments.getEnrollmentsByLevelYear, {
    standardLevelId: assessment.standardLevelId,
    academicYearId: assessment.academicYearId,
  });

  const existingAnswers = useQuery(
    api.studentAssessmentAnswers.getAnswersByAssessment,
    { assessmentId },
  );

  const bulkMark = useMutation(api.studentAssessmentAnswers.bulkMarkEntry);
  const markAbsent = useMutation(
    api.studentAssessmentAnswers.markStudentAbsent,
  );

  // Build lookup map: "studentId|questionId" -> marksObtained
  const answerMap = useMemo(() => {
    const map = new Map<string, number>();
    if (existingAnswers) {
      for (const a of existingAnswers) {
        map.set(`${a.studentId}|${a.questionId}`, a.marksObtained);
      }
    }
    return map;
  }, [existingAnswers]);

  // Build absent lookup: studentId -> boolean
  const absentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (existingAnswers) {
      for (const a of existingAnswers) {
        if (a.isAbsent) {
          map.set(a.studentId, true);
        }
      }
    }
    return map;
  }, [existingAnswers]);

  // Track changes via refs to avoid re-renders on every keystroke
  const changesRef = useRef<Map<string, ChangeEntry>>(new Map());
  const [changeCount, setChangeCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [totalsByStudent, setTotalsByStudent] = useState<Map<string, number>>(
    new Map(),
  );

  // Calculate initial total for a student from existing answers
  const getInitialTotal = useCallback(
    (studentId: string): number => {
      let total = 0;
      for (const q of assessment.questions) {
        const key = `${studentId}|${q._id}`;
        const mark = answerMap.get(key);
        if (mark !== undefined) {
          total += mark;
        }
      }
      return total;
    },
    [assessment.questions, answerMap],
  );

  // Recalculate total for a student using defaults + changes
  const recalculateTotal = useCallback(
    (studentId: string) => {
      let total = 0;
      for (const q of assessment.questions) {
        const changeKey = `${studentId}|${q._id}`;
        const change = changesRef.current.get(changeKey);
        if (change !== undefined) {
          total += change.value;
        } else {
          const existingMark = answerMap.get(changeKey);
          if (existingMark !== undefined) {
            total += existingMark;
          }
        }
      }
      setTotalsByStudent((prev) => {
        const next = new Map(prev);
        next.set(studentId, total);
        return next;
      });
    },
    [assessment.questions, answerMap],
  );

  const handleBlur = useCallback(
    (
      studentId: string,
      enrollmentId: string,
      questionId: string,
      maxMarks: number,
      inputElement: HTMLInputElement,
    ) => {
      const rawValue = inputElement.value.trim();
      if (rawValue === "") {
        // Clear the change if value is empty
        const key = `${studentId}|${questionId}`;
        changesRef.current.delete(key);
        setChangeCount(changesRef.current.size);
        recalculateTotal(studentId);
        inputElement.classList.remove("border-red-500");
        return;
      }

      const value = parseFloat(rawValue);

      if (Number.isNaN(value) || value < 0 || value > maxMarks) {
        inputElement.classList.add("border-red-500");
        return;
      }

      inputElement.classList.remove("border-red-500");

      const key = `${studentId}|${questionId}`;
      changesRef.current.set(key, {
        studentId,
        enrollmentId,
        questionId,
        value,
      });
      setChangeCount(changesRef.current.size);
      recalculateTotal(studentId);
    },
    [recalculateTotal],
  );

  const handleSave = useCallback(async () => {
    if (changesRef.current.size === 0) return;

    setIsSaving(true);
    try {
      const entries = Array.from(changesRef.current.values()).map((c) => ({
        studentId: c.studentId as Id<"students">,
        enrollmentId: c.enrollmentId as Id<"enrollments">,
        questionId: c.questionId as Id<"assessmentQuestions">,
        marksObtained: c.value,
      }));

      await bulkMark({ assessmentId, entries });
      const savedCount = entries.length;
      changesRef.current.clear();
      setChangeCount(0);
      toast.success(`Saved marks for ${savedCount} entries`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save marks";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [assessmentId, bulkMark]);

  const handleMarkAbsent = useCallback(
    async (studentId: string, enrollmentId: string, studentName: string) => {
      try {
        await markAbsent({
          studentId: studentId as Id<"students">,
          enrollmentId: enrollmentId as Id<"enrollments">,
          assessmentId,
        });
        toast.success(`Marked ${studentName} as absent`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to mark absent";
        toast.error(message);
      }
    },
    [assessmentId, markAbsent],
  );

  // Loading state
  if (enrollments === undefined || existingAnswers === undefined) {
    return (
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={`skeleton-row-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state — no students enrolled
  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
        <Users className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">
          No students enrolled in this class
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Students must be enrolled in the matching level and academic year.
        </p>
      </div>
    );
  }

  // Sort enrollments by student name
  const sortedEnrollments = [...enrollments].sort((a, b) =>
    a.studentName.localeCompare(b.studentName),
  );

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Mark Entry</h2>
          <p className="text-sm text-gray-500">
            {sortedEnrollments.length} student
            {sortedEnrollments.length !== 1 ? "s" : ""} enrolled
          </p>
        </div>
        <div className="flex items-center gap-3">
          {changeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {changeCount} unsaved change{changeCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={changeCount === 0 || isSaving}
            className="bg-school-green hover:bg-school-green/90 text-white"
            aria-label={`Save ${changeCount} mark entries`}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving
              ? "Saving..."
              : changeCount > 0
                ? `Save ${changeCount} Change${changeCount !== 1 ? "s" : ""}`
                : "Save All"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-white min-w-[180px]">
                Student
              </TableHead>
              <TableHead className="min-w-[80px]">ID</TableHead>
              {assessment.questions.map((q) => (
                <TableHead key={q._id} className="text-center min-w-[80px]">
                  <div className="flex flex-col items-center">
                    <span>Q{q.questionNumber}</span>
                    <span className="text-xs text-gray-400 font-normal">
                      /{q.marksAllocated}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[80px]">Total</TableHead>
              <TableHead className="text-center min-w-[90px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEnrollments.map((enrollment) => {
              const studentId = enrollment.studentId;
              const isAbsent = absentMap.get(studentId) ?? false;
              const displayTotal =
                totalsByStudent.get(studentId) ?? getInitialTotal(studentId);

              return (
                <TableRow
                  key={enrollment._id}
                  className={cn(isAbsent && "bg-red-50/50")}
                >
                  <TableCell className="sticky left-0 z-10 bg-white font-medium text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      {enrollment.studentName}
                      {isAbsent && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-red-100 text-red-600"
                        >
                          Absent
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {enrollment.studentNumber}
                  </TableCell>
                  {assessment.questions.map((q) => {
                    const answerKey = `${studentId}|${q._id}`;
                    const existingMark = answerMap.get(answerKey);

                    return (
                      <TableCell key={q._id} className="text-center p-1">
                        <input
                          type="number"
                          min={0}
                          max={q.marksAllocated}
                          step={0.5}
                          defaultValue={
                            existingMark !== undefined ? existingMark : ""
                          }
                          onBlur={(e) =>
                            handleBlur(
                              studentId,
                              enrollment._id,
                              q._id,
                              q.marksAllocated,
                              e.target,
                            )
                          }
                          className={cn(
                            "w-16 h-8 text-center text-sm border rounded-md",
                            "focus:outline-none focus:ring-2 focus:ring-school-green/30 focus:border-school-green",
                            "transition-colors",
                            isAbsent && "bg-gray-100 text-gray-400",
                          )}
                          aria-label={`Marks for ${enrollment.studentName}, Question ${q.questionNumber}, max ${q.marksAllocated}`}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        displayTotal > 0 ? "text-gray-900" : "text-gray-400",
                      )}
                    >
                      {displayTotal}
                      <span className="text-xs font-normal text-gray-400">
                        /{assessment.totalMarks}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleMarkAbsent(
                          studentId,
                          enrollment._id,
                          enrollment.studentName,
                        )
                      }
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      aria-label={`Mark ${enrollment.studentName} as absent`}
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline text-xs">Absent</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Bottom save bar for mobile */}
      {changeCount > 0 && (
        <div className="sticky bottom-0 border-t bg-white p-3 flex items-center justify-between sm:hidden">
          <span className="text-sm text-gray-500">
            {changeCount} unsaved change{changeCount !== 1 ? "s" : ""}
          </span>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="bg-school-green hover:bg-school-green/90 text-white"
            aria-label={`Save ${changeCount} mark entries`}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
