"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Phone, PhoneCall } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AcademicYearSelect } from "@/components/shared/AcademicYearSelect";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAttendanceClass } from "@/hooks/use-attendance-class";
import { dhakaDate, isDateLabel } from "@/lib/attendanceDate";
import { formatLongDate, plural } from "@/lib/attendanceView";
import { cn } from "@/lib/utils";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendanceTodayPage() {
  const picker = useAttendanceClass();
  const me = useQuery(api.users.getMe);
  const today = dhakaDate();
  const [date, setDate] = useState(today);
  const year = picker.selection.academicYear;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <PhoneCall className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">
            Morning call list
          </h1>
        </div>
        <p className="ml-9 mt-1 text-sm text-gray-500">
          {formatLongDate(date)} · absent and late students, by class
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          aria-label="Call list date"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={date}
          max={today}
          onChange={(e) => {
            const v = e.target.value;
            if (isDateLabel(v) && v <= today) setDate(v);
          }}
        />
        <AcademicYearSelect
          id="today-year"
          years={picker.years}
          value={year}
          onChange={(academicYear) => picker.update({ academicYear })}
          className="w-32"
        />
      </div>

      {year ? (
        <ErrorBoundary key={`${year}|${date}`}>
          <CallList
            date={date}
            academicYear={year}
            canNote={me?.role === "admin"}
          />
        </ErrorBoundary>
      ) : (
        <Skeleton className="h-24 w-full rounded-lg" />
      )}
    </div>
  );
}

// ── The list ──────────────────────────────────────────────────────────────────

function CallList({
  date,
  academicYear,
  canNote,
}: {
  date: string;
  academicYear: Id<"academicYears">;
  canNote: boolean;
}) {
  const day = useQuery(api.attendance.getDay, { date, academicYear });
  // Tick-off is deliberately not persisted (spec §5.4): it keeps your place
  // mid-list and dies on reload.
  const [ticked, setTicked] = useState<Set<Id<"attendance">>>(new Set());

  if (day === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (day.groups.length === 0) {
    return (
      <div className="rounded-lg border bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-900">
          No classes in this year
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Nobody is enrolled for the selected academic year.
        </p>
      </div>
    );
  }

  const absentTotal = day.groups.reduce((n, g) => n + g.absentees.length, 0);
  // A marked class with nobody absent renders nothing (spec §5.4); the
  // header count carries the accounting.
  const visible = day.groups.filter((g) => !g.marked || g.absentees.length);

  function toggle(id: Id<"attendance">) {
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        {day.classesMarked} of {day.classesTotal}{" "}
        {plural(day.classesTotal, "class", "classes")} marked · {absentTotal} to
        call
      </p>

      {visible.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-sm font-medium text-gray-900">Nobody to call</p>
          <p className="mt-1 text-sm text-gray-500">
            Every class is marked and everyone is in.
          </p>
        </div>
      )}

      {visible.map((g) => (
        <section
          key={`${g.campus}|${g.standardLevelId}`}
          aria-label={`${g.levelName}, ${g.campusName}`}
          className={cn(
            "rounded-lg border bg-white",
            !g.marked && "border-amber-300 bg-amber-50",
          )}
        >
          <header className="flex items-center justify-between gap-2 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-900">
              {g.levelName}
              <span className="font-normal text-gray-500">
                {" "}
                · {g.campusName}
              </span>
            </h2>
            {g.marked ? (
              <span className="text-xs text-gray-500">
                {g.absentees.length} to call
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Not marked yet
              </span>
            )}
          </header>
          {g.marked && (
            <ul className="divide-y border-t">
              {g.absentees.map((a) => (
                <li
                  key={a.attendanceId}
                  className={cn(
                    "flex items-start gap-3 px-4 py-2.5",
                    ticked.has(a.attendanceId) && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Called ${a.studentName}`}
                    className="mt-1 h-4 w-4 accent-school-green"
                    checked={ticked.has(a.attendanceId)}
                    onChange={() => toggle(a.attendanceId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {a.studentName}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          a.status === "late"
                            ? "bg-yellow-400/40 text-yellow-700"
                            : "bg-red-400/40 text-red-700",
                        )}
                      >
                        {a.status}
                      </span>
                      {a.phone ? (
                        <a
                          href={`tel:${a.phone}`}
                          className="flex items-center gap-1 text-sm text-school-green hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {a.phone}
                          <span className="text-xs text-gray-500">
                            ({a.contactLabel})
                          </span>
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">no phone</span>
                      )}
                    </div>
                    <NoteLine
                      attendanceId={a.attendanceId}
                      note={a.note}
                      canNote={canNote}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** The office's reason — the one write on this screen, admin only, inline. */
function NoteLine({
  attendanceId,
  note,
  canNote,
}: {
  attendanceId: Id<"attendance">;
  note: string | null;
  canNote: boolean;
}) {
  const setNote = useMutation(api.attendance.setNote);
  const [draft, setDraft] = useState(note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(note ?? "");
  }, [note]);

  if (!canNote) {
    return note ? <p className="mt-0.5 text-xs text-gray-600">{note}</p> : null;
  }

  async function commit() {
    if (draft.trim() === (note ?? "")) return;
    try {
      await setNote({ attendanceId, note: draft });
      toast.success("Note saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save note");
    }
  }

  return (
    <Input
      ref={inputRef}
      aria-label="Reason"
      placeholder="Reason (e.g. sick, family travel)"
      className="mt-1 h-8 text-xs"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
