"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getLetterGradeBadgeColor, calculateLetterGrade } from "@/lib/gradeUtils";

interface AcademicHistoryTabProps {
  studentId: Id<"students">;
}

export function AcademicHistoryTab({ studentId }: AcademicHistoryTabProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const enrollments = useQuery(api.enrollments.getEnrollmentHistory, { studentId });
  const allGrades = useQuery(api.computedGrades.getComputedGradesByStudent, { studentId });
  const subjects = useQuery(api.subjects.list);

  const longitudinalData = useQuery(
    api.computedGrades.getLongitudinalSubjectPerformance,
    selectedSubjectId
      ? { studentId, subjectId: selectedSubjectId as Id<"subjects"> }
      : "skip"
  );

  if (enrollments === undefined || allGrades === undefined || subjects === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-gray-700">No Academic History</p>
        <p className="text-sm text-gray-400 mt-1">
          Enrollment history will appear here once the student is enrolled.
        </p>
      </div>
    );
  }

  // Build chart data for selected subject
  const chartData = longitudinalData
    ? longitudinalData
        .sort((a, b) => {
          const yearA = a.yearName ?? "";
          const yearB = b.yearName ?? "";
          return yearA.localeCompare(yearB) || a.semester - b.semester;
        })
        .map((d) => ({
          name: `${d.yearName} - Sem ${d.semester}`,
          percentage: parseFloat(d.weightedAverage.toFixed(1)),
        }))
    : [];

  const activeSubjects = subjects?.filter((s) => s.isActive) ?? [];

  return (
    <div className="space-y-6">
      {/* Subject Performance Trends chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Subject Performance Trends
            </CardTitle>
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="w-48 h-8 text-sm">
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
        </CardHeader>
        <CardContent>
          {!selectedSubjectId ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">
              Select a subject to view performance trends
            </div>
          ) : longitudinalData === undefined ? (
            <Skeleton className="h-40 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">
              No grade data for this subject yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="var(--color-school-green)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-school-green)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <SubjectStats data={chartData} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Enrollment accordion */}
      <Accordion type="multiple" className="space-y-2">
        {enrollments.map((enrollment) => {
          const isCurrent = !enrollment.exitDate;
          const sem1Grades = allGrades.filter(
            (g) => g.enrollmentId === enrollment._id && g.semester === 1
          );
          const sem2Grades = allGrades.filter(
            (g) => g.enrollmentId === enrollment._id && g.semester === 2
          );
          const sem1Avg =
            sem1Grades.length > 0
              ? sem1Grades.reduce((s, g) => s + g.weightedAverage, 0) / sem1Grades.length
              : null;
          const sem2Avg =
            sem2Grades.length > 0
              ? sem2Grades.reduce((s, g) => s + g.weightedAverage, 0) / sem2Grades.length
              : null;
          const overallAvg =
            sem1Avg !== null && sem2Avg !== null
              ? (sem1Avg + sem2Avg) / 2
              : sem1Avg ?? sem2Avg;
          const trend = getTrend(sem1Avg, sem2Avg);

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
                      {enrollment.academicYearDoc?.name} &bull; {enrollment.standardLevelDoc?.name}
                    </span>
                    {enrollment.section && (
                      <span className="text-xs text-gray-500 ml-2">Section {enrollment.section}</span>
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
                      <Badge className={getLetterGradeBadgeColor(calculateLetterGrade(overallAvg))}>
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
                  trend={trend}
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
  trend,
}: {
  sem1Grades: GradeRow[];
  sem2Grades: GradeRow[];
  sem1Avg: number | null;
  sem2Avg: number | null;
  trend: { label: string; icon: "up" | "down" | "stable" };
}) {
  const allGrades = [...sem1Grades, ...sem2Grades];

  if (allGrades.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">No grade data for this enrollment.</p>
    );
  }

  const distribution: Record<string, number> = {};
  for (const g of allGrades) {
    distribution[g.letterGrade] = (distribution[g.letterGrade] ?? 0) + 1;
  }

  const sorted = [...allGrades].sort((a, b) => b.weightedAverage - a.weightedAverage);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  return (
    <div className="space-y-3 pt-1">
      {/* Semester averages + trend */}
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
        <div className="bg-gray-50 rounded px-3 py-2 flex items-center gap-1.5">
          <TrendIcon type={trend.icon} />
          <span className="text-xs font-medium text-gray-600">{trend.label}</span>
        </div>
      </div>

      {/* Grade distribution */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Grade Distribution</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(distribution).map(([grade, count]) => (
            <Badge key={grade} variant="outline" className={getLetterGradeBadgeColor(grade)}>
              {grade}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Top/Bottom subjects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-green-600 uppercase mb-1">Top Subjects</p>
          <div className="space-y-0.5">
            {top3.map((g, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-700">
                <span>{g.subjectDoc?.name ?? "—"}</span>
                <span className="font-medium">{g.weightedAverage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-500 uppercase mb-1">Needs Improvement</p>
          <div className="space-y-0.5">
            {bottom3.map((g, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-700">
                <span>{g.subjectDoc?.name ?? "—"}</span>
                <span className="font-medium">{g.weightedAverage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SubjectStats ──────────────────────────────────────────────────────────────

function SubjectStats({ data }: { data: { percentage: number }[] }) {
  if (data.length === 0) return null;
  const avg = data.reduce((s, d) => s + d.percentage, 0) / data.length;
  const max = Math.max(...data.map((d) => d.percentage));
  const min = Math.min(...data.map((d) => d.percentage));
  const trend = getTrend(data[0]?.percentage ?? null, data[data.length - 1]?.percentage ?? null);

  return (
    <div className="grid grid-cols-4 gap-3 mt-3">
      {[
        { label: "Average", value: `${avg.toFixed(1)}%` },
        { label: "Highest", value: `${max.toFixed(1)}%` },
        { label: "Lowest", value: `${min.toFixed(1)}%` },
        { label: "Overall Trend", value: trend.label },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-50 rounded p-2 text-center">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTrend(
  sem1: number | null,
  sem2: number | null
): { label: string; icon: "up" | "down" | "stable" } {
  if (sem1 === null || sem2 === null) return { label: "N/A", icon: "stable" };
  const diff = sem2 - sem1;
  if (diff >= 5) return { label: "Improving ↗", icon: "up" };
  if (diff <= -5) return { label: "Declining ↘", icon: "down" };
  return { label: "Stable →", icon: "stable" };
}

function TrendIcon({ type }: { type: "up" | "down" | "stable" }) {
  if (type === "up") return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (type === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}
