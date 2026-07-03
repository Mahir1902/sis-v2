"use client";

import { useQuery } from "convex/react";
import { BarChart3, CheckCircle2, Inbox } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "@/components/shared/RoleGate";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ALL_PASSING_COPY,
  ALL_PASSING_SUBJECT_COPY,
  buildGradeSpreadSeries,
  cohortState,
  EMPTY_CLASS_COPY,
  EMPTY_SUBJECT_COPY,
  groupNeedsHelpByStudent,
} from "@/lib/cohortView";
import { GradeSpreadChart } from "./_components/GradeSpreadChart";
import { NeedsHelpList } from "./_components/NeedsHelpList";

/** Sentinel for the subject Select's "All subjects" option (no subjectId). */
const ALL_SUBJECTS = "__all__";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClassAnalyticsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <ClassAnalyticsContent />
    </RoleGate>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

function ClassAnalyticsContent() {
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  // Term ALWAYS has a value — default Semester 1 (DA #2): never send an
  // undefined semester to getGradeSpread, which would silently mix the whole
  // year into a Sem-1 selection.
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_SUBJECTS);

  // ── Selector data sources (NOT the cohort fan-out — these are fine) ──────
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const subjects = useQuery(api.subjects.list);

  const levelId = selectedLevelId
    ? (selectedLevelId as Id<"standardLevels">)
    : undefined;
  const yearId = selectedYearId
    ? (selectedYearId as Id<"academicYears">)
    : undefined;
  const semester = Number.parseInt(selectedSemester, 10) as 1 | 2;
  const subjectId =
    selectedSubject === ALL_SUBJECTS
      ? undefined
      : (selectedSubject as Id<"subjects">);
  const subjectSelected = subjectId !== undefined;

  // Both cohort queries skip until level + year resolve. Semester always has a
  // default, so it never blocks the skip gate (DA #3).
  const ready = levelId !== undefined && yearId !== undefined;

  // ── Exactly TWO cohort useQuery calls on this page (DA #7). No per-subject
  // query in a .map — the subject list above feeds the selector only. ────────
  const gradeSpread = useQuery(
    api.computedGrades.getGradeSpread,
    ready
      ? {
          standardLevelId: levelId,
          academicYear: yearId,
          semester, // always passed (DA #2)
          subjectId,
        }
      : "skip",
  );
  const needsHelp = useQuery(
    api.computedGrades.getStudentsNeedingHelp,
    ready
      ? {
          standardLevelId: levelId,
          academicYear: yearId,
          semester, // required arg; always passed (DA #2)
          subjectId,
        }
      : "skip",
  );

  const filtersReady = ready;
  const loading =
    filtersReady && (gradeSpread === undefined || needsHelp === undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">Class Analytics</h1>
        </div>
        <p className="ml-9 mt-1 text-sm text-gray-500">
          Cohort grade distribution and students who need support
        </p>
      </div>

      {/* Selector bar */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Standard level (required) */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="ca-level"
            >
              Standard Level
            </label>
            <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
              <SelectTrigger id="ca-level" aria-label="Select standard level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {levels?.map((l) => (
                  <SelectItem key={l._id} value={l._id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Academic year (required) */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="ca-year"
            >
              Academic Year
            </label>
            <Select value={selectedYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger id="ca-year" aria-label="Select academic year">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years?.map((y) => (
                  <SelectItem key={y._id} value={y._id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term (default Semester 1) */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="ca-term"
            >
              Term
            </label>
            <Select
              value={selectedSemester}
              onValueChange={(v) => setSelectedSemester(v as "1" | "2")}
            >
              <SelectTrigger id="ca-term" aria-label="Select term">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Semester 1</SelectItem>
                <SelectItem value="2">Semester 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject (optional) */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="ca-subject"
            >
              Subject
            </label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger id="ca-subject" aria-label="Select subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SUBJECTS}>All subjects</SelectItem>
                {subjects
                  ?.filter((s) => s.isActive)
                  .map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Body */}
      {!filtersReady ? (
        <PromptState />
      ) : loading ? (
        <LoadingState />
      ) : (
        <CohortBody
          gradeSpread={gradeSpread ?? { spread: emptySpread, total: 0 }}
          needsHelp={needsHelp ?? []}
          subjectSelected={subjectSelected}
        />
      )}
    </div>
  );
}

/** Zero-filled spread so the fallback branch stays type-safe (never rendered). */
const emptySpread = { "A+": 0, A: 0, B: 0, C: 0, D: 0, F: 0 } as const;

// ── Body (grades resolved) ──────────────────────────────────────────────────

function CohortBody({
  gradeSpread,
  needsHelp,
  subjectSelected,
}: {
  gradeSpread: { spread: Record<string, number>; total: number };
  needsHelp: Array<{
    studentId: Id<"students">;
    studentName: string;
    subjectId: Id<"subjects">;
    subjectName: string;
    weightedAverage: number;
    letterGrade: string;
  }>;
  subjectSelected: boolean;
}) {
  const state = cohortState({
    total: gradeSpread.total,
    needsHelpCount: needsHelp.length,
    subjectSelected,
  });

  // (a)/(c) — no grades at all for this selection. No chart to show.
  if (state.kind === "empty" || state.kind === "empty_subject") {
    return (
      <EmptyState
        icon={<Inbox className="h-10 w-10 text-gray-300" />}
        message={
          state.kind === "empty_subject" ? EMPTY_SUBJECT_COPY : EMPTY_CLASS_COPY
        }
      />
    );
  }

  const series = buildGradeSpreadSeries(
    gradeSpread.spread as Record<"A+" | "A" | "B" | "C" | "D" | "F", number>,
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Grades exist — always show the Current Standing chart. */}
      <GradeSpreadChart series={series} total={gradeSpread.total} />

      {/* (b)/(d) good-news OR the at-risk list. */}
      {state.kind === "has_at_risk" ? (
        subjectSelected ? (
          <NeedsHelpList mode="flat" rows={needsHelp} />
        ) : (
          <NeedsHelpList
            mode="grouped"
            students={groupNeedsHelpByStudent(needsHelp)}
          />
        )
      ) : (
        <GoodNewsState
          message={
            state.kind === "all_passing_subject"
              ? ALL_PASSING_SUBJECT_COPY
              : ALL_PASSING_COPY
          }
        />
      )}
    </div>
  );
}

// ── State blocks ─────────────────────────────────────────────────────────────

function PromptState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-20 text-center">
      <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
      <p className="font-medium text-gray-500">
        Select a standard level and academic year to view class analytics
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    // <output> carries an implicit ARIA "status" role.
    <output
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      aria-label="Loading class analytics"
      aria-busy="true"
    >
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="mb-3 h-4 w-32" />
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </CardContent>
      </Card>
    </output>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-20 text-center">
      <div className="mb-3">{icon}</div>
      <p className="font-medium text-gray-500">{message}</p>
    </div>
  );
}

function GoodNewsState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-school-green" />
        <p className="font-medium text-gray-700">{message}</p>
      </CardContent>
    </Card>
  );
}
