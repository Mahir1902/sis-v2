"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  buildPerCaChartData,
  buildSubjectRowSeeds,
} from "@/lib/academicHistoryView";
import {
  calculateLetterGrade,
  getLetterGradeBadgeColor,
} from "@/lib/gradeUtils";
import { ClassComparisonCard } from "./ClassComparisonCard";
import { OverallPositionHeadline } from "./OverallPositionHeadline";
import { PerCaClassChart } from "./PerCaClassChart";

interface AcademicHistoryTabProps {
  studentId: Id<"students">;
}

/** All-null fallback used when a subject's per-CA baseline/grade is not ready. */
const EMPTY_PER_CA_CHART = buildPerCaChartData(
  { ca1: null, ca2: null, ca3: null },
  {},
);

export function AcademicHistoryTab({ studentId }: AcademicHistoryTabProps) {
  const [semester, setSemester] = useState<1 | 2>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const enrollmentHistory = useQuery(api.enrollments.getEnrollmentHistory, {
    studentId,
  });
  const currentEnrollment = useQuery(api.enrollments.getCurrentEnrollment, {
    studentId,
  });
  const allGrades = useQuery(api.computedGrades.getComputedGradesByStudent, {
    studentId,
  });
  const subjects = useQuery(api.subjects.list);

  // C-4 mitigation: analyse the current enrollment, falling back to the most
  // recent past one (history is newest-first) so a graduated/withdrawn student
  // still gets their last term's comparison view.
  const analyzeEnrollment = currentEnrollment ?? enrollmentHistory?.[0] ?? null;
  const standardLevelId = analyzeEnrollment?.standardLevelId;
  // NOTE: an Id<"academicYears">, passed verbatim — never a name string.
  const academicYear = analyzeEnrollment?.academicYear;
  const enrollmentId = analyzeEnrollment?._id;

  const positions = useQuery(
    api.computedGrades.getClassPositions,
    analyzeEnrollment && standardLevelId && academicYear
      ? { standardLevelId, academicYear, semester, studentId }
      : "skip",
  );

  const semesterGrades = useQuery(
    api.computedGrades.getGradesByEnrollmentSemester,
    analyzeEnrollment && enrollmentId ? { enrollmentId, semester } : "skip",
  );

  // Default the subject-scoped queries to the first subject graded this semester
  // so the Shape B chart + raw-history render on first paint — not only after the
  // user actively picks a (different) subject. Mirrors the child's derivation.
  const effectiveSubjectId =
    selectedSubjectId || (semesterGrades?.[0]?.subjectId ?? "");

  const baseline = useQuery(
    api.computedGrades.getPerCaClassBaseline,
    analyzeEnrollment && standardLevelId && academicYear && effectiveSubjectId
      ? {
          standardLevelId,
          academicYear,
          subjectId: effectiveSubjectId as Id<"subjects">,
          semester,
        }
      : "skip",
  );

  const initialLoading =
    enrollmentHistory === undefined ||
    currentEnrollment === undefined ||
    allGrades === undefined ||
    subjects === undefined;

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (
    !analyzeEnrollment &&
    (!enrollmentHistory || enrollmentHistory.length === 0)
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-gray-700">No Academic History</p>
        <p className="text-sm text-gray-400 mt-1">
          Enrollment history will appear here once the student is enrolled.
        </p>
      </div>
    );
  }

  return (
    <AcademicHistoryContent
      semester={semester}
      onSemesterChange={setSemester}
      selectedSubjectId={selectedSubjectId}
      onSubjectChange={setSelectedSubjectId}
      analyzeEnrollment={analyzeEnrollment}
      positions={positions}
      semesterGrades={semesterGrades}
      baseline={baseline}
      subjects={subjects ?? []}
      allGrades={allGrades ?? []}
      enrollmentHistory={enrollmentHistory ?? []}
    />
  );
}

// ── Content (post-guard, analyzeEnrollment may still be null) ──────────────────

type EnrollmentDoc = NonNullable<
  ReturnType<typeof useQuery<typeof api.enrollments.getCurrentEnrollment>>
>;
type EnrollmentHistoryDoc = NonNullable<
  ReturnType<typeof useQuery<typeof api.enrollments.getEnrollmentHistory>>
>[number];
type PositionsResult = NonNullable<
  ReturnType<typeof useQuery<typeof api.computedGrades.getClassPositions>>
>;
type SemesterGradesResult = NonNullable<
  ReturnType<
    typeof useQuery<typeof api.computedGrades.getGradesByEnrollmentSemester>
  >
>;
type BaselineResult = NonNullable<
  ReturnType<typeof useQuery<typeof api.computedGrades.getPerCaClassBaseline>>
>;
type SubjectDoc = NonNullable<
  ReturnType<typeof useQuery<typeof api.subjects.list>>
>[number];
type GradeDoc = NonNullable<
  ReturnType<
    typeof useQuery<typeof api.computedGrades.getComputedGradesByStudent>
  >
>[number];

interface AcademicHistoryContentProps {
  semester: 1 | 2;
  onSemesterChange: (s: 1 | 2) => void;
  selectedSubjectId: string;
  onSubjectChange: (id: string) => void;
  analyzeEnrollment: EnrollmentDoc | null;
  positions: PositionsResult | undefined;
  semesterGrades: SemesterGradesResult | undefined;
  baseline: BaselineResult | undefined;
  subjects: SubjectDoc[];
  allGrades: GradeDoc[];
  enrollmentHistory: EnrollmentHistoryDoc[];
}

function AcademicHistoryContent({
  semester,
  onSemesterChange,
  selectedSubjectId,
  onSubjectChange,
  analyzeEnrollment,
  positions,
  semesterGrades,
  baseline,
  subjects,
  allGrades,
  enrollmentHistory,
}: AcademicHistoryContentProps) {
  const activeSubjects = useMemo(
    () => subjects.filter((s) => s.isActive),
    [subjects],
  );

  // Rows for the you-vs-class comparison card (C.1 + C.2 join).
  const rows = useMemo(
    () =>
      positions && semesterGrades
        ? buildSubjectRowSeeds(positions.bySubject, semesterGrades)
        : [],
    [positions, semesterGrades],
  );

  // Default the subject selector to the first subject graded this semester.
  const effectiveSubjectId =
    selectedSubjectId || (semesterGrades?.[0]?.subjectId ?? "");
  const selectedGradeRow = semesterGrades?.find(
    (g) => g.subjectId === effectiveSubjectId,
  );
  const selectedSubjectName = activeSubjects.find(
    (s) => s._id === effectiveSubjectId,
  )?.name;

  const chartData =
    baseline && selectedGradeRow
      ? buildPerCaChartData(baseline, selectedGradeRow)
      : EMPTY_PER_CA_CHART;

  const comparisonQueryArgs =
    analyzeEnrollment != null
      ? {
          standardLevelId: analyzeEnrollment.standardLevelId,
          academicYear: analyzeEnrollment.academicYear,
          semester,
          studentId: analyzeEnrollment.studentId,
        }
      : null;

  return (
    <div className="space-y-6">
      {/* Semester toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          This term
        </h2>
        <fieldset className="inline-flex rounded-lg border p-0.5">
          <legend className="sr-only">Select semester</legend>
          {([1, 2] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={semester === s}
              aria-label={`Semester ${s}`}
              onClick={() => onSemesterChange(s)}
              className={
                semester === s
                  ? "bg-school-green text-white hover:bg-school-green/90 hover:text-white"
                  : "text-gray-600"
              }
            >
              Sem {s}
            </Button>
          ))}
        </fieldset>
      </div>

      {/* C.4 — overall class position headline */}
      <OverallPositionHeadline
        overall={positions?.overall ?? null}
        reason={positions?.overallSuppressedReason ?? null}
        loading={positions === undefined}
      />

      {/* C.1 + C.2 — you vs class per subject */}
      {comparisonQueryArgs && (
        <ClassComparisonCard
          rows={rows}
          queryArgs={comparisonQueryArgs}
          loading={positions === undefined || semesterGrades === undefined}
        />
      )}

      {/* Subject selector — drives both charts below */}
      <div className="flex items-center justify-end">
        <Select value={effectiveSubjectId} onValueChange={onSubjectChange}>
          <SelectTrigger
            className="w-48 h-8 text-sm"
            aria-label="Select subject for charts"
          >
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            {activeSubjects.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* C.3 — per-CA you-vs-class chart for the selected subject */}
      <PerCaClassChart
        data={chartData}
        subjectName={selectedSubjectName}
        loading={semesterGrades === undefined || baseline === undefined}
      />

      {/* Enrollment accordion (raw history) */}
      <Accordion type="multiple" className="space-y-2">
        {enrollmentHistory.map((enrollment) => {
          const isCurrent = !enrollment.exitDate;
          const sem1Grades = allGrades.filter(
            (g) => g.enrollmentId === enrollment._id && g.semester === 1,
          );
          const sem2Grades = allGrades.filter(
            (g) => g.enrollmentId === enrollment._id && g.semester === 2,
          );
          const sem1Avg =
            sem1Grades.length > 0
              ? sem1Grades.reduce((s, g) => s + g.weightedAverage, 0) /
                sem1Grades.length
              : null;
          const sem2Avg =
            sem2Grades.length > 0
              ? sem2Grades.reduce((s, g) => s + g.weightedAverage, 0) /
                sem2Grades.length
              : null;
          const overallAvg =
            sem1Avg !== null && sem2Avg !== null
              ? (sem1Avg + sem2Avg) / 2
              : (sem1Avg ?? sem2Avg);

          return (
            <AccordionItem
              key={enrollment._id}
              value={enrollment._id}
              className={`border rounded-lg overflow-hidden ${isCurrent ? "border-school-green" : "border-gray-200"}`}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 [&[data-state=open]]:bg-gray-50">
                <div className="flex items-center gap-3 text-left w-full">
                  <div className="flex-1">
                    <span className="font-medium text-sm text-gray-900">
                      {enrollment.academicYearDoc?.name} &bull;{" "}
                      {enrollment.standardLevelDoc?.name}
                    </span>
                    {enrollment.section && (
                      <span className="text-xs text-gray-500 ml-2">
                        Section {enrollment.section}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mr-2">
                    {isCurrent && (
                      <Badge className="bg-school-green/10 text-school-green border-school-green/20 text-xs">
                        Current
                      </Badge>
                    )}
                    {overallAvg !== null && (
                      <span className="text-sm font-semibold text-gray-700">
                        {overallAvg.toFixed(1)}%
                      </span>
                    )}
                    {overallAvg !== null && (
                      <Badge
                        className={getLetterGradeBadgeColor(
                          calculateLetterGrade(overallAvg),
                        )}
                      >
                        {calculateLetterGrade(overallAvg)}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <EnrollmentPerformanceCard
                  sem1Grades={sem1Grades}
                  sem2Grades={sem2Grades}
                  sem1Avg={sem1Avg}
                  sem2Avg={sem2Avg}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// ── EnrollmentPerformanceCard ─────────────────────────────────────────────────

interface GradeRow {
  subjectDoc?: { name: string } | null;
  weightedAverage: number;
  letterGrade: string;
  semester: number;
}

function EnrollmentPerformanceCard({
  sem1Grades,
  sem2Grades,
  sem1Avg,
  sem2Avg,
}: {
  sem1Grades: GradeRow[];
  sem2Grades: GradeRow[];
  sem1Avg: number | null;
  sem2Avg: number | null;
}) {
  const allGrades = [...sem1Grades, ...sem2Grades];

  if (allGrades.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">
        No grade data for this enrollment.
      </p>
    );
  }

  const distribution: Record<string, number> = {};
  for (const g of allGrades) {
    distribution[g.letterGrade] = (distribution[g.letterGrade] ?? 0) + 1;
  }

  const sorted = [...allGrades].sort(
    (a, b) => b.weightedAverage - a.weightedAverage,
  );
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  return (
    <div className="space-y-3 pt-1">
      {/* Semester averages */}
      <div className="flex flex-wrap gap-4 text-sm">
        {sem1Avg !== null && (
          <div className="bg-gray-50 rounded px-3 py-2">
            <p className="text-xs text-gray-500 font-medium">Semester 1</p>
            <p className="font-semibold text-gray-900">{sem1Avg.toFixed(1)}%</p>
          </div>
        )}
        {sem2Avg !== null && (
          <div className="bg-gray-50 rounded px-3 py-2">
            <p className="text-xs text-gray-500 font-medium">Semester 2</p>
            <p className="font-semibold text-gray-900">{sem2Avg.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Grade distribution */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
          Grade Distribution
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(distribution).map(([grade, count]) => (
            <Badge
              key={grade}
              variant="outline"
              className={getLetterGradeBadgeColor(grade)}
            >
              {grade}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Top/Bottom subjects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-green-600 uppercase mb-1">
            Top Subjects
          </p>
          <div className="space-y-0.5">
            {top3.map((g, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
                key={i}
                className="flex justify-between text-xs text-gray-700"
              >
                <span>{g.subjectDoc?.name ?? "—"}</span>
                <span className="font-medium">
                  {g.weightedAverage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-500 uppercase mb-1">
            Needs Improvement
          </p>
          <div className="space-y-0.5">
            {bottom3.map((g, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
                key={i}
                className="flex justify-between text-xs text-gray-700"
              >
                <span>{g.subjectDoc?.name ?? "—"}</span>
                <span className="font-medium">
                  {g.weightedAverage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
