"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { CalendarOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AcademicYearSelect } from "@/components/shared/AcademicYearSelect";
import { RoleGate } from "@/components/shared/RoleGate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { dhakaDate, formatDisplayDate } from "@/lib/attendanceDate";
import {
  closureVoidMessage,
  currentYear,
  dhakaMidnightMs,
  formatDayMonth,
} from "@/lib/attendanceView";
import {
  type ClosureValues,
  closureSchema,
} from "@/lib/validations/closureSchema";

type Pending = ClosureValues & { markCount: number; classCount: number };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchoolCalendarPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <ErrorBoundary>
        <SchoolCalendarContent />
      </ErrorBoundary>
    </RoleGate>
  );
}

function SchoolCalendarContent() {
  const years = useQuery(api.academicYears.list);
  const campuses = useQuery(api.campus.list);
  const [yearId, setYearId] = useState<Id<"academicYears">>();
  const year = years?.find((y) => y._id === yearId);

  useEffect(() => {
    if (!yearId && years) setYearId(currentYear(years)?._id);
  }, [yearId, years]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <CalendarOff className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">School Calendar</h1>
        </div>
        <p className="ml-9 mt-1 text-sm text-gray-500">
          Closure days and the semester boundary. A closed day counts for nobody
          in any attendance figure; marks are kept, never deleted.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="calendar-year" className="text-sm text-gray-700">
          Academic year
        </label>
        <AcademicYearSelect
          id="calendar-year"
          years={years}
          value={yearId}
          onChange={setYearId}
          className="w-36"
        />
      </div>

      {year && campuses ? (
        <>
          <SemesterBoundary key={year._id} year={year} />
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <ClosureList yearId={year._id} campuses={campuses} />
            <AddClosureForm yearId={year._id} campuses={campuses} />
          </div>
        </>
      ) : (
        <Skeleton className="h-40 w-full rounded-lg" />
      )}
    </div>
  );
}

// ── Semester-1 end date ───────────────────────────────────────────────────────

function SemesterBoundary({ year }: { year: Doc<"academicYears"> }) {
  const update = useMutation(api.academicYears.update);
  const saved =
    year.semester1EndDate === undefined ? "" : dhakaDate(year.semester1EndDate);
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await update({
        academicYearId: year._id,
        semester1EndDate: dhakaMidnightMs(value),
      });
      toast.success(
        `Semester 1 of ${year.name} ends ${formatDisplayDate(value)}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        Semester 1 end date · {year.name}
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Semester 2 starts the next day. Until this is set, every attendance
        figure for {year.name} reads "—".
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="Semester 1 end date"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={value}
          min={dhakaDate(year.startDate)}
          max={dhakaDate(year.endDate)}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !value || value === saved}
          className="bg-school-green text-white hover:bg-school-green/90"
        >
          Save
        </Button>
        {saved && (
          <span className="text-xs text-gray-500">
            Currently {formatDisplayDate(saved)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Closure list ──────────────────────────────────────────────────────────────

function ClosureList({
  yearId,
  campuses,
}: {
  yearId: Id<"academicYears">;
  campuses: Doc<"campuses">[];
}) {
  const closures = useQuery(api.closures.list, { academicYear: yearId });
  const remove = useMutation(api.closures.remove);
  const nameOf = (id: Id<"campuses">) =>
    campuses.find((c) => c._id === id)?.name ?? "Unknown";

  async function handleRemove(id: Id<"closures">, date: string) {
    try {
      await remove({ closureId: id });
      toast.success(`${formatDisplayDate(date)} restored`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  return (
    <div className="rounded-lg border bg-white">
      <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
        Closure days
      </h2>
      {closures === undefined ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => `sk-${i}`).map((k) => (
            <Skeleton key={k} className="h-8 w-full" />
          ))}
        </div>
      ) : closures.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-gray-900">No closures yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Add holidays and unplanned closures with the form.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Campuses</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="whitespace-nowrap font-medium text-gray-900">
                    {formatDisplayDate(c.date)}
                  </TableCell>
                  <TableCell>
                    {c.reason}
                    <span className="block text-xs text-gray-500">
                      by {c.createdByName}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {c.campuses.length === campuses.length
                      ? "All campuses"
                      : c.campuses.map(nameOf).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove closure on ${formatDisplayDate(c.date)}`}
                      onClick={() => handleRemove(c._id, c.date)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Add closure form ──────────────────────────────────────────────────────────

function AddClosureForm({
  yearId,
  campuses,
}: {
  yearId: Id<"academicYears">;
  campuses: Doc<"campuses">[];
}) {
  const create = useMutation(api.closures.create);
  const closures = useQuery(api.closures.list, { academicYear: yearId });
  const [pending, setPending] = useState<Pending | null>(null);

  const form = useForm<ClosureValues>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      reason: "",
      campuses: campuses.map((c) => c._id),
    },
  });
  const startDate = form.watch("startDate");
  // closures.create merges into an existing row for the same date and keeps
  // the earlier reason — say so before the admin submits.
  const existing = closures?.find((c) => c.date === startDate);

  async function submit(values: ClosureValues, confirmVoid = false) {
    try {
      const result = await create({
        ...values,
        campuses: values.campuses as Id<"campuses">[],
        confirmVoid,
      });
      if (!result.ok) {
        setPending({ ...values, ...result });
        return;
      }
      toast.success(
        `Closed ${result.created} ${result.created === 1 ? "day" : "days"}`,
      );
      form.reset({
        startDate: "",
        endDate: "",
        reason: "",
        campuses: campuses.map((c) => c._id),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not add closure");
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Add closure</h2>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => submit(v))}
          className="mt-3 space-y-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!form.getValues("endDate"))
                          form.setValue("endDate", e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {existing && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              {formatDayMonth(existing.date)} is already closed ("
              {existing.reason}"). Campuses you tick are added to it; the
              earlier reason is kept.
            </p>
          )}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input placeholder="Eid-ul-Fitr, hartal, flood…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="campuses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campuses</FormLabel>
                <div className="space-y-1.5">
                  {campuses.map((c) => {
                    const checked = field.value.includes(c._id);
                    return (
                      <div
                        key={c._id}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <Checkbox
                          id={`closure-campus-${c._id}`}
                          checked={checked}
                          onCheckedChange={(on) =>
                            field.onChange(
                              on
                                ? [...field.value, c._id]
                                : field.value.filter((id) => id !== c._id),
                            )
                          }
                        />
                        <label htmlFor={`closure-campus-${c._id}`}>
                          {c.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-school-green text-white hover:bg-school-green/90"
          >
            Add closure
          </Button>
        </form>
      </Form>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This day already has marks</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && closureVoidMessage(pending)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (!pending) return;
                const values = pending;
                setPending(null);
                void submit(values, true);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
