"use client";

import { useQuery } from "convex/react";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AcademicYearSelect } from "@/components/shared/AcademicYearSelect";
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
import { formatDisplayDate } from "@/lib/attendanceDate";
import {
  appearanceNotes,
  currentYear,
  formatLongDate,
  percentLabel,
  rawCountLabel,
} from "@/lib/attendanceView";
import { cn } from "@/lib/utils";

type Period = "year" | "1" | "2";

/**
 * The fifth student tab (spec §5.6): the figure, the raw count, and a dated
 * list of every day missed with the office's reason — because parents ask
 * which days.
 */
export function AttendanceTab({ studentId }: { studentId: Id<"students"> }) {
  const years = useQuery(api.academicYears.list);
  const enrollment = useQuery(api.enrollments.getCurrentEnrollment, {
    studentId,
  });
  const [yearId, setYearId] = useState<Id<"academicYears">>();
  const [period, setPeriod] = useState<Period>("year");

  useEffect(() => {
    if (yearId || enrollment === undefined || !years) return;
    setYearId(enrollment?.academicYear ?? currentYear(years)?._id);
  }, [yearId, enrollment, years]);

  const summary = useQuery(
    api.attendance.getStudentAttendance,
    yearId
      ? {
          studentId,
          academicYear: yearId,
          semester: period === "year" ? undefined : period === "1" ? 1 : 2,
        }
      : "skip",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <AcademicYearSelect
          id="att-year"
          years={years}
          value={yearId}
          onChange={setYearId}
          className="w-32"
        />
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger
            id="att-period"
            aria-label="Select period"
            className="w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="year">Whole year</SelectItem>
            <SelectItem value="1">Semester 1</SelectItem>
            <SelectItem value="2">Semester 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {summary === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : summary.periodStart === null ? (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This year has no semester-1 end date, so no semester figure can be
          computed. Choose "Whole year" or ask an admin to set it on the School
          Calendar.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
            <CalendarCheck className="h-8 w-8 text-school-green" />
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {percentLabel(summary)}
              </p>
              <p className="text-sm text-gray-500">
                {rawCountLabel(summary)} ·{" "}
                {formatDisplayDate(summary.periodStart)} –{" "}
                {formatDisplayDate(summary.periodEnd ?? "")}
              </p>
              {appearanceNotes(summary).map((n) => (
                <p
                  key={n}
                  className="mt-1 flex items-start gap-1 text-xs text-amber-800"
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {n}
                </p>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Days missed ({summary.missedDays.length})
            </h3>
            {summary.missedDays.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                No absences or late arrivals in this period.
              </p>
            ) : (
              <ul className="mt-2 divide-y rounded-lg border">
                {summary.missedDays.map((d) => (
                  <li
                    key={d.date}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    <span className="w-44 text-gray-900">
                      {formatLongDate(d.date)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        d.status === "late"
                          ? "bg-yellow-400/40 text-yellow-700"
                          : "bg-red-400/40 text-red-700",
                      )}
                    >
                      {d.status}
                    </span>
                    <span className="text-gray-500">
                      {d.note ?? "no reason recorded"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
