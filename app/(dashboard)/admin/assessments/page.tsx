"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { RoleGate } from "@/components/shared/RoleGate";

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
  const [selectedSemester, setSelectedSemester] = useState<"all" | "1" | "2">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const assessments = useQuery(
    api.assessments.getAssessmentsByLevelYear,
    selectedLevelId && selectedYearId
      ? {
          standardLevelId: selectedLevelId as Id<"standardLevels">,
          academicYearId: selectedYearId as Id<"academicYears">,
          semester: selectedSemester !== "all" ? (parseInt(selectedSemester) as 1 | 2) : undefined,
        }
      : "skip"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <Button
          onClick={() => setCreateOpen(true)}
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
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-44">
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

        <Select value={selectedSemester} onValueChange={(v) => setSelectedSemester(v as "all" | "1" | "2")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Semesters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            <SelectItem value="1">Semester 1</SelectItem>
            <SelectItem value="2">Semester 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assessment list */}
      {!selectedLevelId || !selectedYearId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Select a year and level to view assessments</p>
        </div>
      ) : assessments === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No assessments yet</p>
          <p className="text-sm text-gray-400 mt-1">Create CA-1, CA-2, and CA-3 for each subject.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {assessments.map((a) => (
            <Link
              key={a._id}
              href={`/admin/assessments/${a._id}`}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              aria-label={`View ${a.name} — ${a.subjectDoc?.name ?? "Unknown subject"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{a.name}</span>
                  <Badge variant="outline" className="text-xs">
                    CA-{a.assessmentNumber}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                    Sem {a.semester}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {a.subjectDoc?.name} &bull; {a.totalMarks} marks &bull;{" "}
                  {a.questionCount} question{a.questionCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Badge
                className={
                  a.isActive
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500"
                }
              >
                {a.isActive ? "Active" : "Inactive"}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateAssessmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        standardLevelId={selectedLevelId as Id<"standardLevels">}
        academicYearId={selectedYearId as Id<"academicYears">}
      />
    </div>
  );
}

// ── Create Assessment Dialog ──────────────────────────────���───────────────────

function CreateAssessmentDialog({
  open,
  onClose,
  standardLevelId,
  academicYearId,
}: {
  open: boolean;
  onClose: () => void;
  standardLevelId: Id<"standardLevels">;
  academicYearId: Id<"academicYears">;
}) {
  const subjects = useQuery(api.subjects.list);
  const createAssessment = useMutation(api.assessments.createAssessment);
  const bulkCreate = useMutation(api.assessments.bulkCreateAssessments);
  const [bulkMode, setBulkMode] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      assessmentNumber: "1",
      semester: "1",
      totalMarks: 100,
    },
  });

  async function onSubmit(values: CreateValues) {
    try {
      if (bulkMode) {
        await bulkCreate({
          semester: parseInt(values.semester) as 1 | 2,
          subjectId: values.subjectId as Id<"subjects">,
          standardLevelId,
          academicYearId,
          totalMarks: values.totalMarks,
        });
        toast.success("Created CA-1, CA-2, CA-3 for subject");
      } else {
        await createAssessment({
          name: values.name,
          assessmentNumber: parseInt(values.assessmentNumber) as 1 | 2 | 3,
          semester: parseInt(values.semester) as 1 | 2,
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
      const message = err instanceof Error ? err.message : "Failed to create assessment";
      toast.error(message);
    }
  }

  const activeSubjects = subjects?.filter((s) => s.isActive) ?? [];

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
                      {activeSubjects.map((s) => (
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
                      <Select value={field.value} onValueChange={field.onChange}>
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
