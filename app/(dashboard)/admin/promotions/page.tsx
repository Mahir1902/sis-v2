"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowUpCircle, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
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
import type { Id } from "@/convex/_generated/dataModel";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <PromotionsPageContent />
    </RoleGate>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

type PromotionAction = "promote" | "hold_back" | "graduate";

function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

// ── Create Academic Year Schema ──────────────────────────────────────────────

const createAcademicYearSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Start date must be before end date",
    path: ["endDate"],
  });

type CreateAcademicYearValues = z.infer<typeof createAcademicYearSchema>;

function suggestNextYear(sourceYearName: string) {
  const match = sourceYearName.match(/^(\d{4})-(\d{4})$/);
  if (!match) return { name: "", startDate: "", endDate: "" };
  const startYear = Number(match[2]);
  const endYear = startYear + 1;
  return {
    name: `${startYear}-${endYear}`,
    startDate: `${startYear}-06-01`,
    endDate: `${endYear}-07-31`,
  };
}

function PromotionsPageContent() {
  const [selectedSourceYearId, setSelectedSourceYearId] = useState("");
  const [selectedTargetYearId, setSelectedTargetYearId] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [actions, setActions] = useState<Record<string, PromotionAction>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [autoAssignFees, setAutoAssignFees] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createYearOpen, setCreateYearOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const candidates = useQuery(
    api.promotions.getPromotionCandidates,
    selectedSourceYearId && selectedLevelId
      ? {
          standardLevelId: selectedLevelId as Id<"standardLevels">,
          academicYearId: selectedSourceYearId as Id<"academicYears">,
        }
      : "skip",
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const bulkPromote = useMutation(api.promotions.bulkPromote);
  const createYear = useMutation(api.academicYears.create);

  // ── Create Year Form ──────────────────────────────────────────────────
  const createYearForm = useForm<CreateAcademicYearValues>({
    resolver: zodResolver(createAcademicYearSchema),
    defaultValues: { name: "", startDate: "", endDate: "" },
  });

  // ── Initialize actions when candidates load ─────────────────────────────
  useEffect(() => {
    if (!candidates) return;
    const initial: Record<string, PromotionAction> = {};
    for (const c of candidates.filter(isNonNull)) {
      if (c.alreadyPromoted) continue;
      initial[c.enrollmentId] = c.isGraduationCandidate
        ? "graduate"
        : "promote";
    }
    setActions(initial);
  }, [candidates]);

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const result = { promote: 0, holdBack: 0, graduate: 0 };
    for (const action of Object.values(actions)) {
      if (action === "promote") result.promote++;
      else if (action === "hold_back") result.holdBack++;
      else if (action === "graduate") result.graduate++;
    }
    return result;
  }, [actions]);

  const actionableCount = Object.keys(actions).length;

  // ── Submit handler ──────────────────────────────────────────────────────
  async function handleConfirmPromotion() {
    if (!selectedTargetYearId) {
      toast.error("Please select a target academic year");
      return;
    }
    setIsSubmitting(true);
    try {
      const promotionItems = (candidates ?? [])
        .filter(isNonNull)
        .filter((c) => !c.alreadyPromoted)
        .map((c) => ({
          studentId: c.studentId,
          enrollmentId: c.enrollmentId,
          action:
            actions[c.enrollmentId] ??
            (c.isGraduationCandidate
              ? ("graduate" as const)
              : ("promote" as const)),
        }));

      const result = await bulkPromote({
        sourceAcademicYearId: selectedSourceYearId as Id<"academicYears">,
        targetAcademicYearId: selectedTargetYearId as Id<"academicYears">,
        standardLevelId: selectedLevelId as Id<"standardLevels">,
        promotions: promotionItems,
        autoAssignFees,
      });

      toast.success(
        `${result.promoted} promoted, ${result.heldBack} held back, ${result.graduated} graduated. ${result.feesAssigned} fee records created.`,
      );
      setSelectedLevelId("");
      setActions({});
      setConfirmOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Promotion failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Create Year Submit ─────────────────────────────────────────────────
  async function handleCreateYear(values: CreateAcademicYearValues) {
    try {
      const newId = await createYear({
        name: values.name,
        startDate: new Date(values.startDate).getTime(),
        endDate: new Date(values.endDate).getTime(),
      });
      toast.success(`Academic year ${values.name} created`);
      setSelectedTargetYearId(newId);
      setCreateYearOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create academic year";
      toast.error(message);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const filtersSelected = selectedSourceYearId && selectedLevelId;

  function getLevelName(id: string): string {
    return levels?.find((l) => l._id === id)?.name ?? "";
  }

  function getYearName(id: string): string {
    return years?.find((y) => y._id === id)?.name ?? "";
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <ArrowUpCircle className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">
            Student Promotion
          </h1>
        </div>
        <p className="text-sm text-gray-500 mt-1 ml-9">
          Promote students to the next grade level
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Source Academic Year */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="source-year"
            >
              Source Academic Year
            </label>
            <Select
              value={selectedSourceYearId}
              onValueChange={(v) => {
                setSelectedSourceYearId(v);
                // Clear target if it matches the new source
                if (selectedTargetYearId === v) setSelectedTargetYearId("");
              }}
            >
              <SelectTrigger
                id="source-year"
                aria-label="Select source academic year"
              >
                <SelectValue placeholder="Select source year" />
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

          {/* Target Academic Year */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="target-year"
            >
              Target Academic Year
            </label>
            <Select
              value={selectedTargetYearId}
              onValueChange={setSelectedTargetYearId}
              disabled={!selectedSourceYearId || (years?.length ?? 0) <= 1}
            >
              <SelectTrigger
                id="target-year"
                aria-label="Select target academic year"
              >
                <SelectValue placeholder="Select target year" />
              </SelectTrigger>
              <SelectContent>
                {years
                  ?.filter((y) => y._id !== selectedSourceYearId)
                  .map((y) => (
                    <SelectItem key={y._id} value={y._id}>
                      {y.name}
                    </SelectItem>
                  ))}
                <div className="border-t my-1" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-gray-100 text-school-green"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCreateYearOpen(true);
                  }}
                  aria-label="Create new academic year"
                >
                  <Plus className="h-4 w-4" />
                  New Academic Year
                </button>
              </SelectContent>
            </Select>
          </div>

          {/* Grade Level */}
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="grade-level"
            >
              Grade Level
            </label>
            <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
              <SelectTrigger id="grade-level" aria-label="Select grade level">
                <SelectValue placeholder="Select grade level" />
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
        </div>
      </div>

      {/* No target year warning */}
      {years &&
        years.filter((y) => y._id !== selectedSourceYearId).length === 0 &&
        selectedSourceYearId && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>No target year available.</span>
            <Button
              variant="link"
              className="text-school-green p-0 h-auto"
              onClick={() => setCreateYearOpen(true)}
              aria-label="Create new academic year"
            >
              Create a new academic year
            </Button>
          </div>
        )}

      {/* Content Area */}
      {!filtersSelected ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <ArrowUpCircle className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            Select a source year and grade level to view students
          </p>
        </div>
      ) : candidates === undefined ? (
        <div className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Current Level</TableHead>
                  <TableHead>Next Level</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }, (_, i) => `sk-${i}`).map((key) => (
                  <TableRow key={key}>
                    <TableCell>
                      <Skeleton className="h-4 w-6" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-28" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : candidates.filter(isNonNull).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <Users className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            No active students in {getLevelName(selectedLevelId)} for{" "}
            {getYearName(selectedSourceYearId)}
          </p>
        </div>
      ) : (
        <>
          {/* Data Table */}
          <div className="bg-white rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Current Level</TableHead>
                    <TableHead>Next Level</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.filter(isNonNull).map((candidate, index) => (
                    <TableRow
                      key={candidate.enrollmentId}
                      className={candidate.alreadyPromoted ? "opacity-60" : ""}
                    >
                      <TableCell className="text-sm text-gray-500">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {candidate.studentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {candidate.studentNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {candidate.currentLevelName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {candidate.isGraduationCandidate ? (
                          <span className="text-gray-400">
                            N/A (Graduation)
                          </span>
                        ) : (
                          candidate.nextLevelName
                        )}
                      </TableCell>
                      <TableCell>
                        {candidate.alreadyPromoted ? (
                          <Badge className="bg-yellow-400/40 text-yellow-700">
                            Already Promoted
                          </Badge>
                        ) : (
                          <Select
                            value={actions[candidate.enrollmentId] ?? "promote"}
                            onValueChange={(v) =>
                              setActions((prev) => ({
                                ...prev,
                                [candidate.enrollmentId]: v as PromotionAction,
                              }))
                            }
                          >
                            <SelectTrigger
                              className="w-32 h-8 text-xs"
                              aria-label={`Action for ${candidate.studentName}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {candidate.isGraduationCandidate ? (
                                <>
                                  <SelectItem value="graduate">
                                    Graduate
                                  </SelectItem>
                                  <SelectItem value="hold_back">
                                    Hold Back
                                  </SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="promote">
                                    Promote
                                  </SelectItem>
                                  <SelectItem value="hold_back">
                                    Hold Back
                                  </SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-green-400/40 text-green-700">
                {summary.promote} promote
              </Badge>
              <Badge className="bg-yellow-400/40 text-yellow-700">
                {summary.holdBack} hold back
              </Badge>
              <Badge className="bg-purple-400/40 text-purple-700">
                {summary.graduate} graduate
              </Badge>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-fees"
                  checked={autoAssignFees}
                  onCheckedChange={(checked) =>
                    setAutoAssignFees(checked === true)
                  }
                  aria-label="Auto-assign fees for new academic year"
                />
                <label
                  htmlFor="auto-fees"
                  className="text-sm text-gray-700 cursor-pointer select-none"
                >
                  Auto-assign fees for new academic year
                </label>
              </div>

              <Button
                className="bg-school-green hover:bg-school-green/90 text-white"
                disabled={isSubmitting || actionableCount === 0}
                onClick={() => {
                  if (!selectedTargetYearId) {
                    toast.error("Please select a target academic year");
                    return;
                  }
                  setConfirmOpen(true);
                }}
                aria-label="Confirm promotion"
              >
                Confirm Promotion
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Student Promotion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to process {actionableCount} students:{" "}
                  {summary.promote} promotions, {summary.holdBack} held back,{" "}
                  {summary.graduate} graduated.
                </p>
                {autoAssignFees && (
                  <p className="text-sm text-gray-500">
                    Fee structures will be automatically assigned for the target
                    academic year.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPromotion}
              disabled={isSubmitting}
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              {isSubmitting ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Academic Year Dialog */}
      <Dialog
        open={createYearOpen}
        onOpenChange={(open) => {
          setCreateYearOpen(open);
          if (open) {
            const sourceYearName =
              years?.find((y) => y._id === selectedSourceYearId)?.name ?? "";
            const suggestion = suggestNextYear(sourceYearName);
            createYearForm.reset(suggestion);
          }
        }}
      >
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Academic Year</DialogTitle>
          </DialogHeader>
          <Form {...createYearForm}>
            <form
              onSubmit={createYearForm.handleSubmit(handleCreateYear)}
              className="space-y-4"
            >
              <FormField
                control={createYearForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2026-2027" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={createYearForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createYearForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateYearOpen(false)}
                  aria-label="Cancel creating academic year"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-school-green hover:bg-school-green/90 text-white"
                  disabled={createYearForm.formState.isSubmitting}
                  aria-label="Create academic year"
                >
                  {createYearForm.formState.isSubmitting
                    ? "Creating..."
                    : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
