"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Lock,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import {
  type ClassKey,
  useAttendanceClass,
} from "@/hooks/use-attendance-class";
import { useAttendanceRegister } from "@/hooks/use-attendance-register";
import {
  dhakaDate,
  EDIT_WINDOW_DAYS,
  formatDisplayDate,
  isDateLabel,
  shiftDate,
} from "@/lib/attendanceDate";
import {
  type AttendanceStatus,
  formatDhakaTime,
  formatLongDate,
} from "@/lib/attendanceView";
import { cn } from "@/lib/utils";
import { ClassPicker } from "./_components/ClassPicker";

const pillStyles: Record<AttendanceStatus, string> = {
  present: "bg-green-400/40 text-green-700",
  absent: "bg-red-400/40 text-red-700",
  late: "bg-yellow-400/40 text-yellow-700",
};

/** Same palette as the pills, applied only to the selected segment. */
const segmentStyles: Record<AttendanceStatus, string> = {
  present: "data-[state=on]:bg-green-400/40 data-[state=on]:text-green-700",
  late: "data-[state=on]:bg-yellow-400/40 data-[state=on]:text-yellow-700",
  absent: "data-[state=on]:bg-red-400/40 data-[state=on]:text-red-700",
};

const statusOrder: AttendanceStatus[] = ["present", "late", "absent"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendanceRegisterPage() {
  const picker = useAttendanceClass();
  const today = dhakaDate();
  const [date, setDate] = useState(today);
  const { classKey } = picker;

  const levelName = picker.levels?.find(
    (l) => l._id === picker.selection.standardLevelId,
  )?.name;
  const campusName = picker.campuses?.find(
    (c) => c._id === picker.selection.campus,
  )?.name;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">Daily register</h1>
        </div>
        <p className="ml-9 mt-1 text-sm text-gray-500">
          {formatLongDate(date)}
          {levelName && ` · ${levelName}`}
          {campusName && ` · ${campusName}`}
        </p>
      </div>

      <div className="rounded-lg border bg-white">
        {/* Toolbar on the card's top edge: class + campus + year, date stepper */}
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <ClassPicker picker={picker} idPrefix="register" />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              aria-label="Attendance date"
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm sm:w-40"
              value={date}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                if (isDateLabel(v) && v <= today) setDate(v);
              }}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              disabled={date >= today}
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {classKey ? (
          <ErrorBoundary key={`${JSON.stringify(classKey)}|${date}`}>
            <Register classKey={classKey} date={date} />
          </ErrorBoundary>
        ) : (
          <EmptyState
            icon={<Users className="h-10 w-10 text-gray-300" />}
            title="Choose a class"
            message="Pick a class and campus above to open its register."
          />
        )}
      </div>
    </div>
  );
}

// ── The register itself (remounted per class + date) ─────────────────────────

function Register({ classKey, date }: { classKey: ClassKey; date: string }) {
  const register = useQuery(api.attendance.getRegister, { ...classKey, date });
  const save = useMutation(api.attendance.saveRegister);
  const [saving, setSaving] = useState(false);

  const alreadyMarked = register?.markedAt != null;
  const reg = useAttendanceRegister(register?.students ?? [], alreadyMarked);

  if (register === undefined) {
    return (
      <div className="divide-y">
        {Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((k) => (
          <div key={k} className="flex items-center justify-between p-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (register.students.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10 text-gray-300" />}
        title="No students in this class"
        message="Nobody is actively enrolled here for the selected year."
      />
    );
  }

  const locked = !register.canWrite;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await save({
        ...classKey,
        date,
        marks: reg.rows.map((r) => ({
          studentId: r.studentId,
          status: r.status,
        })),
      });
      reg.reset();
      toast.success(
        alreadyMarked
          ? `Register updated — ${result.updated} changed`
          : `Register saved for ${formatDisplayDate(date)}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {register.lockReason === "closed" && (
        <Banner tone="red">
          <Lock className="h-4 w-4 shrink-0" />
          School closed on this day
          {register.closure && `: ${register.closure.reason}`}. Attendance
          cannot be marked, and any marks here count for nothing.
        </Banner>
      )}
      {register.lockReason === "outside_window" && (
        <Banner tone="amber">
          <Lock className="h-4 w-4 shrink-0" />
          This day is more than {EDIT_WINDOW_DAYS} days ago and outside the
          correction window. You can read it but not change it — ask the office;
          an admin can mark any past date.
        </Banner>
      )}
      {register.lockReason === "future" && (
        <Banner tone="amber">
          <Lock className="h-4 w-4 shrink-0" />
          This day has not happened yet.
        </Banner>
      )}

      {/* Exceptions strip */}
      {reg.exceptions.length > 0 && (
        <ul
          aria-label="Marked exceptions"
          className="flex flex-wrap gap-1.5 border-b bg-gray-50 p-3"
        >
          {reg.exceptions.map((r) => (
            <li key={r.studentId}>
              <button
                type="button"
                disabled={locked}
                onClick={() => reg.setStatus(r.studentId, "present")}
                aria-label={`${r.studentName} ${r.status} — tap to mark present`}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-70",
                  pillStyles[r.status],
                )}
              >
                {r.studentName}
                <span className="opacity-70">· {r.status}</span>
                {!locked && <X className="h-3 w-3" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Roster: one segmented control per row, one tap to choose */}
      <ul className="divide-y">
        {reg.rows.map((r) => (
          <li
            key={r.studentId}
            className="flex items-center justify-between gap-3 p-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">
                {r.studentName}
              </span>
              <span className="block text-xs text-gray-500">
                {r.studentNumber}
              </span>
            </span>
            <StatusControl
              name={r.studentName}
              status={r.status}
              disabled={locked}
              onChange={(status) => reg.setStatus(r.studentId, status)}
            />
          </li>
        ))}
      </ul>

      {/* Save bar — sticky to the bottom of the dashboard scroller, above the rows */}
      <div
        className={cn(
          "sticky bottom-0 z-10 flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between",
          alreadyMarked ? "bg-amber-50" : "bg-white",
        )}
      >
        <p className="text-xs text-gray-600">
          {locked
            ? "This register is read-only."
            : alreadyMarked && register.markedAt != null
              ? `Marked at ${formatDhakaTime(register.markedAt)} by ${register.markedBy?.name ?? "someone"}. Saving replaces it.`
              : reg.touched
                ? `${reg.exceptions.length} exception${reg.exceptions.length === 1 ? "" : "s"} marked.`
                : "Nothing tapped yet — this day is not marked until you confirm."}
        </p>
        <Button
          onClick={handleSave}
          disabled={locked || saving}
          className="bg-school-green text-white hover:bg-school-green/90"
        >
          {reg.buttonLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function StatusControl({
  name,
  status,
  disabled,
  onChange,
}: {
  name: string;
  status: AttendanceStatus;
  disabled: boolean;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={status}
      disabled={disabled}
      aria-label={`${name}: ${status}`}
      className="shrink-0"
      // Radix emits "" when the selected segment is tapped again; keep it on.
      onValueChange={(v) => v && onChange(v as AttendanceStatus)}
    >
      {statusOrder.map((s) => (
        <ToggleGroupItem
          key={s}
          value={s}
          aria-label={`Mark ${name} ${s}`}
          className={cn("px-2.5 text-xs capitalize", segmentStyles[s])}
        >
          {s}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "red" | "amber";
  children: React.ReactNode;
}) {
  return (
    <output
      className={cn(
        "flex items-start gap-2 border-b px-3 py-2 text-sm",
        tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-800",
      )}
    >
      {children}
    </output>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {icon}
      <p className="mt-3 text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}
