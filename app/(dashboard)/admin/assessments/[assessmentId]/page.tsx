"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RoleGate } from "@/components/shared/RoleGate";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Settings } from "lucide-react";
import { MarkEntryGrid } from "./_components/MarkEntryGrid";
import { QuestionManager } from "./_components/QuestionManager";

export default function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = use(params);

  return (
    <RoleGate allowedRoles={["admin", "teacher"]}>
      <AssessmentDetailContent
        assessmentId={assessmentId as Id<"assessments">}
      />
    </RoleGate>
  );
}

function AssessmentDetailContent({
  assessmentId,
}: {
  assessmentId: Id<"assessments">;
}) {
  const [questionManagerOpen, setQuestionManagerOpen] = useState(false);

  const assessment = useQuery(api.assessments.getAssessmentById, {
    assessmentId,
  });

  // Loading state
  if (assessment === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // Assessment not found
  if (assessment === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/assessments"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Back to all assessments"
        >
          <ArrowLeft className="h-4 w-4" />
          All Assessments
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Assessment not found</p>
          <p className="text-sm text-gray-400 mt-1">
            This assessment may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  const hasQuestions = assessment.questions.length > 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Back to all assessments"
      >
        <ArrowLeft className="h-4 w-4" />
        All Assessments
      </Link>

      {/* Assessment Header Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {assessment.name}
              </h1>
              <Badge variant="outline" className="text-xs">
                CA-{assessment.assessmentNumber}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs text-blue-600 border-blue-200"
              >
                Semester {assessment.semester}
              </Badge>
              <Badge
                className={
                  assessment.isActive
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500"
                }
              >
                {assessment.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <p className="text-sm text-gray-600">
              {assessment.subjectDoc?.name ?? "Unknown Subject"}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span>
                Total marks: <strong>{assessment.totalMarks}</strong>
              </span>
              <span>
                Questions: <strong>{assessment.questions.length}</strong>
              </span>
              {assessment.passingMarks !== undefined && (
                <span>
                  Passing marks: <strong>{assessment.passingMarks}</strong>
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setQuestionManagerOpen(true)}
            aria-label="Manage questions for this assessment"
          >
            <Settings className="h-4 w-4 mr-1.5" />
            Manage Questions
          </Button>
        </div>
      </div>

      {/* Conditional content */}
      {!hasQuestions ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            Add questions before entering marks
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Define the questions and their mark allocations first.
          </p>
          <Button
            className="mt-4 bg-school-green hover:bg-school-green/90 text-white"
            onClick={() => setQuestionManagerOpen(true)}
            aria-label="Add questions to this assessment"
          >
            Add Questions
          </Button>
        </div>
      ) : (
        <MarkEntryGrid
          assessmentId={assessmentId}
          assessment={{
            _id: assessment._id,
            totalMarks: assessment.totalMarks,
            standardLevelId: assessment.standardLevelId,
            academicYearId: assessment.academicYearId,
            questions: assessment.questions.map((q) => ({
              _id: q._id,
              questionNumber: q.questionNumber,
              marksAllocated: q.marksAllocated,
            })),
          }}
        />
      )}

      {/* Question Manager Dialog */}
      <QuestionManager
        open={questionManagerOpen}
        onClose={() => setQuestionManagerOpen(false)}
        assessmentId={assessmentId}
        totalMarks={assessment.totalMarks}
        existingQuestions={assessment.questions.map((q) => ({
          _id: q._id,
          questionNumber: q.questionNumber,
          marksAllocated: q.marksAllocated,
          questionText: q.questionText,
        }))}
      />
    </div>
  );
}
