"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, BookOpen, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleGate } from "@/components/shared/RoleGate";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ── Types ─────────────────────────────────────────────────────────────────────

type EnrichedAssessment = {
  _id: Id<"assessments">;
  name: string;
  assessmentNumber: 1 | 2 | 3;
  semester: 1 | 2;
  subjectId: Id<"subjects">;
  totalMarks: number;
  isActive: boolean;
  questionCount: number;
  totalQMarks: number;
  subjectDoc: {
    _id: Id<"subjects">;
    name: string;
    displayOrder?: number;
  } | null;
};

type GroupedSubject = {
  subject: { _id: Id<"subjects">; name: string; displayOrder?: number };
  assessments: Record<1 | 2 | 3, EnrichedAssessment | null>;
};

// ── Create Assessment schema ──────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  assessmentNumber: z.enum(["1", "2", "3"]),
  semester: z.enum(["1", "2"]),
  subjectId: z.string().min(1, "Subject is required"),
  totalMarks: z.number().min(1, "Total marks must be at least 1"),
  passingMarks: z.number().optional(),
});

type CreateValues = z.infer<typeof createSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <AssessmentsPageContent />
    </RoleGate>
  );
}

function AssessmentsPageContent() {
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    subjectId?: string;
    semester?: "1" | "2";
    assessmentNumber?: "1" | "2" | "3";
  }>({});

  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const subjects = useQuery(api.subjects.list);

  // Fetch ALL assessments for this level+year (no semester filter — we filter client-side)
  const assessments = useQuery(
    api.assessments.getAssessmentsByLevelYear,
    selectedLevelId && selectedYearId
      ? {
          standardLevelId: selectedLevelId as Id<"standardLevels">,
          academicYearId: selectedYearId as Id<"academicYears">,
        }
      : "skip",
  );

  // Auto-select current academic year
  useEffect(() => {
    if (years && years.length > 0 && !selectedYearId) {
      setSelectedYearId(years[0]._id);
    }
  }, [years, selectedYearId]);

  const activeSubjects = useMemo(
    () => subjects?.filter((s) => s.isActive) ?? [],
    [subjects],
  );

  // Group assessments by subject for current semester
  const grouped = useMemo((): GroupedSubject[] | null => {
    if (!assessments || !activeSubjects.length) return null;

    const semesterNum = parseInt(selectedSemester, 10) as 1 | 2;
    const filtered = assessments.filter((a) => a.semester === semesterNum);

    const map = new Map<string, GroupedSubject>();

    // Initialize all active subjects
    for (const s of activeSubjects) {
      map.set(s._id, {
        subject: {
          _id: s._id as Id<"subjects">,
          name: s.name,
          displayOrder: s.displayOrder ?? undefined,
        },
        assessments: { 1: null, 2: null, 3: null },
      });
    }

    // Fill in existing assessments
    for (const a of filtered) {
      let entry = map.get(a.subjectId);
      if (!entry && a.subjectDoc) {
        // Subject exists in assessments but not in active subjects (deactivated)
        entry = {
          subject: {
            _id: a.subjectId,
            name: a.subjectDoc.name,
            displayOrder: a.subjectDoc.displayOrder,
          },
          assessments: { 1: null, 2: null, 3: null },
        };
        map.set(a.subjectId, entry);
      }
      if (entry) {
        entry.assessments[a.assessmentNumber as 1 | 2 | 3] =
          a as EnrichedAssessment;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        (a.subject.displayOrder ?? 999) - (b.subject.displayOrder ?? 999),
    );
  }, [assessments, activeSubjects, selectedSemester]);

  // Summary stats
  const stats = useMemo(() => {
    if (!grouped) return null;
    const totalSubjects = grouped.length;
    let created = 0;
    let withQuestions = 0;
    for (const g of grouped) {
      for (const ca of [1, 2, 3] as const) {
        if (g.assessments[ca]) {
          created++;
          if (
            g.assessments[ca]?.questionCount &&
            g.assessments[ca].questionCount > 0
          )
            withQuestions++;
        }
      }
    }
    return {
      totalSubjects,
      created,
      possible: totalSubjects * 3,
      withQuestions,
    };
  }, [grouped]);

  function openCreatePrefilled(
    subjectId: string,
    semester: "1" | "2",
    assessmentNumber: "1" | "2" | "3",
  ) {
    setCreateDefaults({ subjectId, semester, assessmentNumber });
    setCreateOpen(true);
  }

  function openCreateFresh() {
    setCreateDefaults({});
    setCreateOpen(true);
  }

  const selectedLevel = levels?.find((l) => l._id === selectedLevelId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          {selectedLevel && (
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedLevel.name} &mdash;{" "}
              {years?.find((y) => y._id === selectedYearId)?.name}
            </p>
          )}
        </div>
        <Button
          onClick={openCreateFresh}
          disabled={!selectedLevelId || !selectedYearId}
          className="bg-school-green hover:bg-school-green/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Assessment
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-3">
        <Select value={selectedYearId} onValueChange={setSelectedYearId}>
          <SelectTrigger className="w-44" aria-label="Select academic year">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            {years?.map((y) => (
              <SelectItem key={y._id} value={y._id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
          <SelectTrigger className="w-44" aria-label="Select standard level">
            <SelectValue placeholder="Standard Level" />
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

      {/* Main content */}
      {!selectedLevelId ? (
        <LevelPickerGrid levels={levels} onSelect={setSelectedLevelId} />
      ) : assessments === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary stats */}
          {stats && (
            <SummaryStats
              totalSubjects={stats.totalSubjects}
              created={stats.created}
              possible={stats.possible}
              withQuestions={stats.withQuestions}
            />
          )}

          {/* Semester tabs + grid */}
          <Tabs
            value={selectedSemester}
            onValueChange={(v) => setSelectedSemester(v as "1" | "2")}
          >
            <TabsList>
              <TabsTrigger value="1">Semester 1</TabsTrigger>
              <TabsTrigger value="2">Semester 2</TabsTrigger>
            </TabsList>
            <TabsContent value="1">
              <AssessmentGrid
                grouped={grouped}
                semester="1"
                onCreateClick={openCreatePrefilled}
                standardLevelId={selectedLevelId as Id<"standardLevels">}
                academicYearId={selectedYearId as Id<"academicYears">}
              />
            </TabsContent>
            <TabsContent value="2">
              <AssessmentGrid
                grouped={grouped}
                semester="2"
                onCreateClick={openCreatePrefilled}
                standardLevelId={selectedLevelId as Id<"standardLevels">}
                academicYearId={selectedYearId as Id<"academicYears">}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Create dialog */}
      <CreateAssessmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        standardLevelId={selectedLevelId as Id<"standardLevels">}
        academicYearId={selectedYearId as Id<"academicYears">}
        subjects={activeSubjects}
        defaultValues={createDefaults}
      />
    </div>
  );
}

// ── Level Picker Grid ─────────────────────────────────────────────────────────

function LevelPickerGrid({
  levels,
  onSelect,
}: {
  levels: { _id: string; name: string; code: string }[] | undefined;
  onSelect: (id: string) => void;
}) {
  if (!levels) {
    return (
      <div className="bg-white rounded-lg border p-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-10 w-20 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-8 text-center">
      <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-600 font-medium mb-4">
        Select a level to view assessments
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {levels.map((l) => (
          <button
            type="button"
            key={l._id}
            onClick={() => onSelect(l._id)}
            className="px-4 py-2 rounded-md border text-sm font-medium text-gray-700 hover:border-school-green hover:text-school-green hover:bg-school-green/5 transition-colors"
            aria-label={`Select ${l.name}`}
          >
            {l.code}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Summary Stats ─────────────────────────────────────────────────────────────

function SummaryStats({
  totalSubjects,
  created,
  possible,
  withQuestions,
}: {
  totalSubjects: number;
  created: number;
  possible: number;
  withQuestions: number;
}) {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-500">
      <span>
        {totalSubjects} subject{totalSubjects !== 1 ? "s" : ""}
      </span>
      <span className="text-gray-300">|</span>
      <span>
        {created} of {possible} assessments created
      </span>
      <span className="text-gray-300">|</span>
      <span>{withQuestions} have questions</span>
    </div>
  );
}

// ── Assessment Grid ───────────────────────────────────────────────────────────

function AssessmentGrid({
  grouped,
  semester,
  onCreateClick,
  standardLevelId,
  academicYearId,
}: {
  grouped: GroupedSubject[] | null;
  semester: "1" | "2";
  onCreateClick: (
    subjectId: string,
    semester: "1" | "2",
    assessmentNumber: "1" | "2" | "3",
  ) => void;
  standardLevelId: Id<"standardLevels">;
  academicYearId: Id<"academicYears">;
}) {
  const bulkCreate = useMutation(api.assessments.bulkCreateAssessments);

  async function handleBulkCreate(subjectId: Id<"subjects">) {
    try {
      await bulkCreate({
        semester: parseInt(semester, 10) as 1 | 2,
        subjectId,
        standardLevelId,
        academicYearId,
        totalMarks: 100,
      });
      toast.success("Created CA-1, CA-2, CA-3");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create assessments";
      toast.error(message);
    }
  }

  if (!grouped || grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border mt-2">
        <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">No subjects found</p>
        <p className="text-sm text-gray-400 mt-1">
          Add subjects first, then create assessments.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Subject</TableHead>
            <TableHead>CA-1</TableHead>
            <TableHead>CA-2</TableHead>
            <TableHead>CA-3</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((g) => {
            const allMissing =
              !g.assessments[1] && !g.assessments[2] && !g.assessments[3];
            return (
              <TableRow key={g.subject._id}>
                <TableCell className="font-medium text-gray-900">
                  {g.subject.name}
                </TableCell>
                {([1, 2, 3] as const).map((ca) => (
                  <TableCell key={ca}>
                    <AssessmentCell
                      assessment={g.assessments[ca]}
                      onCreateClick={() =>
                        onCreateClick(
                          g.subject._id,
                          semester,
                          String(ca) as "1" | "2" | "3",
                        )
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>
                  {allMissing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleBulkCreate(g.subject._id as Id<"subjects">)
                      }
                      className="text-xs"
                      aria-label={`Create all assessments for ${g.subject.name}`}
                    >
                      Create All
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Assessment Cell ───────────────────────────────────────────────────────────

function AssessmentCell({
  assessment,
  onCreateClick,
}: {
  assessment: EnrichedAssessment | null;
  onCreateClick: () => void;
}) {
  // Not created
  if (!assessment) {
    return (
      <button
        type="button"
        onClick={onCreateClick}
        className="flex flex-col items-center justify-center w-full py-3 px-2 rounded-md border border-dashed border-gray-200 hover:border-school-green hover:bg-school-green/5 text-gray-400 hover:text-school-green transition-colors"
        aria-label="Create assessment"
      >
        <Plus className="h-4 w-4" />
        <span className="text-xs mt-0.5">Create</span>
      </button>
    );
  }

  // Exists but no questions
  if (assessment.questionCount === 0) {
    return (
      <Link
        href={`/admin/assessments/${assessment._id}`}
        className="block py-2 px-3 rounded-md hover:bg-amber-50 border border-dashed border-amber-200 transition-colors"
        aria-label={`${assessment.name} — no questions yet`}
      >
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-medium text-amber-600">
            No questions
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {assessment.totalMarks} marks total
        </p>
      </Link>
    );
  }

  // Has questions
  return (
    <Link
      href={`/admin/assessments/${assessment._id}`}
      className="block py-2 px-3 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
      aria-label={`${assessment.name} — ${assessment.questionCount} questions`}
    >
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        <span className="text-sm font-medium text-gray-900">
          {assessment.questionCount} question
          {assessment.questionCount !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        {assessment.totalQMarks}/{assessment.totalMarks} marks allocated
      </p>
    </Link>
  );
}

// ── Create Assessment Dialog ──────────────────────────────────────────────────

function CreateAssessmentDialog({
  open,
  onClose,
  standardLevelId,
  academicYearId,
  subjects,
  defaultValues,
}: {
  open: boolean;
  onClose: () => void;
  standardLevelId: Id<"standardLevels">;
  academicYearId: Id<"academicYears">;
  subjects: { _id: string; name: string }[];
  defaultValues?: {
    subjectId?: string;
    semester?: "1" | "2";
    assessmentNumber?: "1" | "2" | "3";
  };
}) {
  const createAssessment = useMutation(api.assessments.createAssessment);
  const bulkCreate = useMutation(api.assessments.bulkCreateAssessments);
  const [bulkMode, setBulkMode] = useState(false);

  const hasPrefill = !!(
    defaultValues?.subjectId && defaultValues?.assessmentNumber
  );

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      assessmentNumber: "1",
      semester: "1",
      totalMarks: 100,
    },
  });

  // Reset form when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      if (hasPrefill) {
        setBulkMode(false);
        form.reset({
          name: `CA-${defaultValues.assessmentNumber}`,
          assessmentNumber: defaultValues.assessmentNumber ?? "1",
          semester: defaultValues.semester ?? "1",
          subjectId: defaultValues.subjectId ?? "",
          totalMarks: 100,
        });
      } else {
        form.reset({
          name: "",
          assessmentNumber: "1",
          semester: "1",
          totalMarks: 100,
        });
      }
    }
  }, [
    open,
    hasPrefill,
    defaultValues?.subjectId,
    defaultValues?.semester,
    defaultValues?.assessmentNumber,
    form,
  ]);

  async function onSubmit(values: CreateValues) {
    try {
      if (bulkMode) {
        await bulkCreate({
          semester: parseInt(values.semester, 10) as 1 | 2,
          subjectId: values.subjectId as Id<"subjects">,
          standardLevelId,
          academicYearId,
          totalMarks: values.totalMarks,
        });
        toast.success("Created CA-1, CA-2, CA-3 for subject");
      } else {
        await createAssessment({
          name: values.name,
          assessmentNumber: parseInt(values.assessmentNumber, 10) as 1 | 2 | 3,
          semester: parseInt(values.semester, 10) as 1 | 2,
          subjectId: values.subjectId as Id<"subjects">,
          standardLevelId,
          academicYearId,
          totalMarks: values.totalMarks,
          passingMarks: values.passingMarks,
        });
        toast.success("Assessment created");
      }
      form.reset();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create assessment";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assessment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                aria-label="Single assessment mode"
                aria-pressed={!bulkMode}
                onClick={() => setBulkMode(false)}
                className={`px-3 py-1.5 rounded-md transition-colors ${!bulkMode ? "bg-school-green text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Single
              </button>
              <button
                type="button"
                aria-label="Bulk create CA-1, CA-2, and CA-3 mode"
                aria-pressed={bulkMode}
                onClick={() => setBulkMode(true)}
                className={`px-3 py-1.5 rounded-md transition-colors ${bulkMode ? "bg-school-green text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Bulk (CA-1/2/3)
              </button>
            </div>

            {!bulkMode && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CA-1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="subjectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              {!bulkMode && (
                <FormField
                  control={form.control}
                  name="assessmentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CA Number</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">CA-1</SelectItem>
                          <SelectItem value="2">CA-2</SelectItem>
                          <SelectItem value="3">CA-3</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Semester 1</SelectItem>
                        <SelectItem value="2">Semester 2</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalMarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Marks</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-school-green hover:bg-school-green/90 text-white"
              >
                {bulkMode ? "Create CA-1/2/3" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
