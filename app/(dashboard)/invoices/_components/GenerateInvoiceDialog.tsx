"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useGenerateInvoiceFees } from "@/hooks/use-generate-invoice-fees";
import { formatBillingPeriod } from "@/lib/formatBillingPeriod";
import { cn } from "@/lib/utils";
import {
  type GenerateInvoiceFormValues,
  generateInvoiceFormSchema,
} from "@/lib/validations/invoiceSchema";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GenerateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the student-picker step is skipped. */
  studentId?: Id<"students">;
  /**
   * Pre-resolved academic year for the prefilled student. When omitted but
   * `studentId` is provided, the dialog will infer it from the student's
   * current enrollment.
   */
  academicYearId?: Id<"academicYears">;
}

interface PickedStudent {
  _id: Id<"students">;
  studentFullName: string;
  studentNumber: string;
  standardLevelName: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the 10th of the next month relative to `from`. Used as the default
 * due date — matches the school's billing convention.
 */
function tenthOfNextMonth(from: Date = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 10);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Mirrors the cap enforced by `generateInvoiceFormSchema` — used for the
 * textarea's `maxLength` so the browser blocks input past the limit too. */
const NOTES_MAX = 500;

// ── Component ──────────────────────────────────────────────────────────────────

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  studentId: studentIdProp,
  academicYearId: academicYearIdProp,
}: GenerateInvoiceDialogProps) {
  const router = useRouter();

  // Picked student — when prop is set, this acts as the source of truth via
  // the effect below so the resolved student is always consistent regardless
  // of entry point.
  const [pickedStudent, setPickedStudent] = useState<PickedStudent | null>(
    null,
  );
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false);

  // Selected fee ids — drives the line-item checkboxes + running total.
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());

  // Reset everything when the dialog closes so a re-open is a clean slate.
  useEffect(() => {
    if (!open) {
      setPickedStudent(null);
      setStudentPopoverOpen(false);
      setSelectedFeeIds(new Set());
    }
  }, [open]);

  const studentSkipped = studentIdProp !== undefined;

  // ── Data ────────────────────────────────────────────────────────────────
  // Student list for the picker — admin already has access to this query and
  // it's bounded server-side. Skipped when launched from a student page.
  const students = useQuery(
    api.students.getAllStudents,
    studentSkipped ? "skip" : { status: ["active"] },
  );

  // When studentId is provided, hydrate `pickedStudent` from the students list
  // so we get the same display fields shape. We DON'T skip this — we need the
  // display label even in skipped mode. Use `getStudentById` directly so we
  // don't pull the full active-student list just to look up one row.
  const prefilledStudent = useQuery(
    api.students.getStudentById,
    studentIdProp ? { studentId: studentIdProp } : "skip",
  );

  useEffect(() => {
    if (!studentSkipped) return;
    if (!prefilledStudent) return;
    setPickedStudent({
      _id: prefilledStudent._id,
      studentFullName: prefilledStudent.studentFullName,
      studentNumber: prefilledStudent.studentNumber,
      standardLevelName: prefilledStudent.standardLevelDoc?.name ?? "—",
    });
  }, [studentSkipped, prefilledStudent]);

  const effectiveStudentId = pickedStudent?._id ?? studentIdProp;

  // Resolve current enrollment for the picked student to find the academic
  // year. If the prop already supplied it, skip this query.
  const currentEnrollment = useQuery(
    api.enrollments.getCurrentEnrollment,
    effectiveStudentId && !academicYearIdProp
      ? { studentId: effectiveStudentId }
      : "skip",
  );

  const resolvedAcademicYearId: Id<"academicYears"> | undefined =
    academicYearIdProp ?? currentEnrollment?.academicYear ?? undefined;

  // Fee list for the resolved (student, year). Skipped until both are known.
  const invoiceableFees = useQuery(
    api.invoices.getInvoiceableFeesForStudent,
    effectiveStudentId && resolvedAcademicYearId
      ? {
          studentId: effectiveStudentId,
          academicYearId: resolvedAcademicYearId,
        }
      : "skip",
  );

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<GenerateInvoiceFormValues>({
    resolver: zodResolver(generateInvoiceFormSchema),
    defaultValues: {
      dueDate: tenthOfNextMonth(),
      notes: "",
    },
  });

  // Selection logic (derived list, total, toggle, default-selection effect)
  // lives in the hook so this component stays presentational.
  const { selectedFees, runningTotal, toggleFee } = useGenerateInvoiceFees({
    invoiceableFees,
    selectedFeeIds,
    setSelectedFeeIds,
  });

  const generateInvoice = useMutation(api.invoices.generateInvoice);

  const enrollmentMissing =
    !studentSkipped &&
    !academicYearIdProp &&
    pickedStudent !== null &&
    currentEnrollment === null;

  const canSubmit =
    !!effectiveStudentId &&
    !!resolvedAcademicYearId &&
    selectedFees.length > 0 &&
    !enrollmentMissing &&
    !form.formState.isSubmitting;

  // ── Handlers ────────────────────────────────────────────────────────────
  async function onSubmit(values: GenerateInvoiceFormValues) {
    if (!effectiveStudentId || !resolvedAcademicYearId) return;
    if (selectedFees.length === 0) {
      toast.error("Select at least one fee to invoice");
      return;
    }

    try {
      const result = await generateInvoice({
        studentId: effectiveStudentId,
        academicYearId: resolvedAcademicYearId,
        studentFeeIds: selectedFees.map((f) => f._id as Id<"studentFees">),
        dueDate: values.dueDate.getTime(),
        notes:
          values.notes && values.notes.trim().length > 0
            ? values.notes.trim()
            : undefined,
      });

      toast.success(`Invoice ${result.invoiceNumber} created`, {
        action: {
          label: "View",
          onClick: () => router.push(`/invoices?invoiceId=${result.invoiceId}`),
        },
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate invoice";
      toast.error(message);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Block esc / X-button dismissal while the mutation is in-flight to
        // prevent the user from losing their work on a transient hiccup.
        if (form.formState.isSubmitting && !o) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Bundle a student&apos;s unpaid fees into a single draft invoice.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 py-1"
          >
            {/* Step 1 — Student picker (skipped when studentIdProp is set) */}
            {!studentSkipped && (
              <StudentPicker
                students={students}
                pickedStudent={pickedStudent}
                onPick={(s) => {
                  setPickedStudent(s);
                  setSelectedFeeIds(new Set());
                }}
                open={studentPopoverOpen}
                onOpenChange={setStudentPopoverOpen}
              />
            )}

            {/* When prefilled, surface the locked student summary so the
                admin sees who they're invoicing. */}
            {studentSkipped && pickedStudent && (
              <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                <div className="font-medium text-gray-900">
                  {pickedStudent.studentFullName}
                </div>
                <div className="text-xs text-gray-500">
                  {pickedStudent.studentNumber}
                  {pickedStudent.standardLevelName !== "—" &&
                    ` · ${pickedStudent.standardLevelName}`}
                </div>
              </div>
            )}

            {/* Enrollment-missing error — only when picker is in use */}
            {enrollmentMissing && (
              <ErrorBanner message="Selected student has no active enrollment. Assign one before generating an invoice." />
            )}

            {/* Step 2 — Fee selection */}
            {effectiveStudentId &&
              resolvedAcademicYearId &&
              !enrollmentMissing && (
                <FeeSelectionList
                  fees={invoiceableFees}
                  selectedFeeIds={selectedFeeIds}
                  onToggle={toggleFee}
                />
              )}

            {/* Step 3 — Due date + notes */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                            aria-label="Select invoice due date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "dd/MM/yyyy")
                              : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => date && field.onChange(date)}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Anything to share with the parent…"
                        maxLength={NOTES_MAX}
                        rows={2}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Running total — only shown once fees are loaded */}
            {invoiceableFees && invoiceableFees.length > 0 && (
              <div className="rounded-lg border border-school-green/20 bg-school-green/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Selected total ({selectedFees.length}{" "}
                    {selectedFees.length === 1 ? "fee" : "fees"})
                  </span>
                  <span className="text-lg font-bold text-school-green">
                    ৳{runningTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
                aria-label="Cancel invoice generation"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-school-green text-white hover:bg-school-green/90"
                aria-label="Generate invoice"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate Invoice"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StudentPickerProps {
  students:
    | Array<{
        _id: Id<"students">;
        studentFullName: string;
        studentNumber: string;
        standardLevelName: string;
      }>
    | undefined;
  pickedStudent: PickedStudent | null;
  onPick: (student: PickedStudent) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StudentPicker({
  students,
  pickedStudent,
  onPick,
  open,
  onOpenChange,
}: StudentPickerProps) {
  const isLoading = students === undefined;

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-gray-900">Student</span>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Select a student to invoice"
            className="w-full justify-between font-normal"
            disabled={isLoading}
          >
            {pickedStudent ? (
              <span className="truncate">
                {pickedStudent.studentFullName}
                <span className="text-muted-foreground ml-1.5">
                  · {pickedStudent.studentNumber}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {isLoading ? "Loading students…" : "Search for a student…"}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search by name or admission #…" />
            <CommandList>
              {isLoading ? (
                <div className="p-2 space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <CommandEmpty>No students match.</CommandEmpty>
                  <CommandGroup>
                    {students.map((s) => (
                      <CommandItem
                        key={s._id}
                        value={`${s.studentFullName} ${s.studentNumber}`}
                        onSelect={() => {
                          onPick({
                            _id: s._id,
                            studentFullName: s.studentFullName,
                            studentNumber: s.studentNumber,
                            standardLevelName: s.standardLevelName,
                          });
                          onOpenChange(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            pickedStudent?._id === s._id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {s.studentFullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {s.studentNumber} · {s.standardLevelName}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface FeeSelectionListProps {
  fees:
    | Array<{
        _id: Id<"studentFees">;
        feeStructureName: string;
        frequency: string;
        billingPeriod?: string;
        balance: number;
      }>
    | undefined;
  selectedFeeIds: Set<string>;
  onToggle: (id: string) => void;
}

function FeeSelectionList({
  fees,
  selectedFeeIds,
  onToggle,
}: FeeSelectionListProps) {
  if (fees === undefined) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-900">Unpaid fees</span>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <div className="rounded-lg border bg-gray-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-gray-700">
          No unpaid fees available
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This student has no unpaid fees left to invoice for the current
          academic year.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-900">Unpaid fees</span>
        <span className="text-xs text-muted-foreground">
          {selectedFeeIds.size} of {fees.length} selected
        </span>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border">
        {fees.map((fee) => {
          const checked = selectedFeeIds.has(fee._id);
          const labelId = `fee-label-${fee._id}`;
          const description =
            fee.frequency === "monthly" && fee.billingPeriod
              ? `${fee.feeStructureName} — ${formatBillingPeriod(fee.billingPeriod)}`
              : fee.feeStructureName;
          return (
            <label
              key={fee._id}
              htmlFor={`fee-${fee._id}`}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-gray-50",
                checked && "bg-school-green/5",
              )}
            >
              <Checkbox
                id={`fee-${fee._id}`}
                checked={checked}
                onCheckedChange={() => onToggle(fee._id)}
                aria-labelledby={labelId}
              />
              <div className="flex-1 min-w-0">
                <div
                  id={labelId}
                  className="text-sm font-medium capitalize text-gray-900 truncate"
                >
                  {description}
                </div>
                {fee.frequency !== "monthly" && (
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {fee.frequency}
                  </Badge>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                ৳{fee.balance.toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
