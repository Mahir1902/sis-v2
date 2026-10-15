"use client";

import { useQuery } from "convex/react";
import { AlertTriangle, FileBarChart, Users } from "lucide-react";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import {
  type ClassKey,
  useAttendanceClass,
} from "@/hooks/use-attendance-class";
import { formatDisplayDate } from "@/lib/attendanceDate";
import {
  appearanceNotes,
  percentLabel,
  rawCountLabel,
  unmarkedDaysBanner,
} from "@/lib/attendanceView";
import { ClassPicker } from "../_components/ClassPicker";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendanceReportPage() {
  const picker = useAttendanceClass();
  const [semester, setSemester] = useState<"1" | "2">("1");
  const { classKey } = picker;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <FileBarChart className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">Term report</h1>
        </div>
        <p className="ml-9 mt-1 text-sm text-gray-500">
          The attendance figure per student for one class and semester
        </p>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <ClassPicker picker={picker} idPrefix="report" />
          <Select
            value={semester}
            onValueChange={(v) => setSemester(v as "1" | "2")}
          >
            <SelectTrigger
              id="report-semester"
              aria-label="Select semester"
              className="w-full sm:w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Semester 1</SelectItem>
              <SelectItem value="2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {classKey ? (
          <ErrorBoundary key={`${JSON.stringify(classKey)}|${semester}`}>
            <Report classKey={classKey} semester={semester === "1" ? 1 : 2} />
          </ErrorBoundary>
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Choose a class
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Pick a class, campus and year above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── The report ────────────────────────────────────────────────────────────────

function Report({
  classKey,
  semester,
}: {
  classKey: ClassKey;
  semester: 1 | 2;
}) {
  const report = useQuery(api.attendance.getClassReport, {
    ...classKey,
    semester,
  });

  if (report === undefined) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (report.periodStart === null) {
    return (
      <div className="flex items-start gap-2 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        This academic year has no semester-1 end date, so no figure can be
        computed. An admin sets it on the School Calendar page.
      </div>
    );
  }

  if (report.students.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-900">No students</p>
        <p className="mt-1 text-sm text-gray-500">
          Nobody was enrolled in this class for the selected year.
        </p>
      </div>
    );
  }

  const banner = unmarkedDaysBanner(report);
  const { periodStart, periodEnd } = report;

  return (
    <div>
      <p className="px-4 pt-3 text-xs text-gray-500">
        {formatDisplayDate(periodStart)} –{" "}
        {formatDisplayDate(periodEnd ?? periodStart)} · class marked on{" "}
        {report.classMarkedDays} days
      </p>
      {banner && (
        <output className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {banner}
        </output>
      )}

      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Present / marked</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.students.map((s) => {
              const notes = appearanceNotes(s);
              return (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <span className="block font-medium text-gray-900">
                      {s.studentName}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {s.studentNumber}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.present + s.late} / {s.denominator}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="block text-base font-bold text-gray-900">
                      {percentLabel(s)}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {rawCountLabel(s)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-amber-800">
                    {notes.map((n) => (
                      <span key={n} className="flex items-start gap-1">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {n}
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
