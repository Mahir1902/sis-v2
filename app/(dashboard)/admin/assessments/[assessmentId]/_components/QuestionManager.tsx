"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestionManagerProps {
  open: boolean;
  onClose: () => void;
  assessmentId: Id<"assessments">;
  totalMarks: number;
  existingQuestions: Array<{
    _id: Id<"assessmentQuestions">;
    questionNumber: number;
    marksAllocated: number;
    questionText?: string;
  }>;
}

interface CustomRow {
  id: string;
  marks: number;
  questionText: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

const quickFillSchema = z.object({
  numberOfQuestions: z.number().int().min(1, "At least 1 question"),
  marksPerQuestion: z.number().min(0.5, "Marks must be at least 0.5"),
});

type QuickFillValues = z.infer<typeof quickFillSchema>;

// ── Component ──────────────────────────────────────────────────────────────────

export function QuestionManager({
  open,
  onClose,
  assessmentId,
  totalMarks,
  existingQuestions,
}: QuestionManagerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customRows, setCustomRows] = useState<CustomRow[]>([
    { id: crypto.randomUUID(), marks: 0, questionText: "" },
  ]);
  const [editingId, setEditingId] = useState<Id<"assessmentQuestions"> | null>(
    null,
  );
  const [editMarks, setEditMarks] = useState(0);
  const [editText, setEditText] = useState("");

  const bulkCreate = useMutation(api.assessmentQuestions.bulkCreateQuestions);
  const updateQuestion = useMutation(api.assessmentQuestions.updateQuestion);
  const deleteQuestion = useMutation(api.assessmentQuestions.deleteQuestion);

  const existingMarksTotal = existingQuestions.reduce(
    (sum, q) => sum + q.marksAllocated,
    0,
  );
  const remainingMarks = totalMarks - existingMarksTotal;
  const allocationPercent = Math.min(
    (existingMarksTotal / totalMarks) * 100,
    100,
  );

  // ── Quick Fill form ────────────────────────────────────────────────────────

  const quickForm = useForm<QuickFillValues>({
    resolver: zodResolver(quickFillSchema),
    defaultValues: {
      numberOfQuestions: 1,
      marksPerQuestion: remainingMarks > 0 ? remainingMarks : 1,
    },
  });

  const watchedCount = quickForm.watch("numberOfQuestions");
  const watchedMarks = quickForm.watch("marksPerQuestion");
  const quickProjectedTotal = (watchedCount || 0) * (watchedMarks || 0);
  const quickFitsRemaining = quickProjectedTotal <= remainingMarks;

  async function onQuickFillSubmit(values: QuickFillValues) {
    const sum = values.numberOfQuestions * values.marksPerQuestion;
    if (sum > remainingMarks) {
      toast.error(`${sum} marks exceeds remaining marks (${remainingMarks})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await bulkCreate({
        assessmentId,
        questions: Array.from({ length: values.numberOfQuestions }, (_, i) => ({
          questionNumber: existingQuestions.length + i + 1,
          marksAllocated: values.marksPerQuestion,
        })),
      });
      toast.success(
        `Added ${values.numberOfQuestions} question${values.numberOfQuestions > 1 ? "s" : ""}`,
      );
      quickForm.reset({
        numberOfQuestions: 1,
        marksPerQuestion: 1,
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add questions";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Custom rows ────────────────────────────────────────────────────────────

  function addCustomRow() {
    setCustomRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), marks: 0, questionText: "" },
    ]);
  }

  function removeCustomRow(id: string) {
    setCustomRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateCustomRow(
    id: string,
    field: "marks" | "questionText",
    value: string | number,
  ) {
    setCustomRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  const customTotal = customRows.reduce((sum, r) => sum + (r.marks || 0), 0);
  const customFitsRemaining = customTotal <= remainingMarks;
  const customHasValidRows = customRows.some((r) => r.marks > 0);

  async function onCustomSubmit() {
    const validRows = customRows.filter((r) => r.marks > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one question with marks > 0");
      return;
    }
    if (customTotal > remainingMarks) {
      toast.error(
        `Total marks (${customTotal}) exceed remaining marks (${remainingMarks})`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await bulkCreate({
        assessmentId,
        questions: validRows.map((r, i) => ({
          questionNumber: existingQuestions.length + i + 1,
          marksAllocated: r.marks,
          questionText: r.questionText || undefined,
        })),
      });
      toast.success(
        `Added ${validRows.length} question${validRows.length > 1 ? "s" : ""}`,
      );
      setCustomRows([{ id: crypto.randomUUID(), marks: 0, questionText: "" }]);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add questions";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Existing question actions ──────────────────────────────────────────────

  function startEdit(q: QuestionManagerProps["existingQuestions"][0]) {
    setEditingId(q._id);
    setEditMarks(q.marksAllocated);
    setEditText(q.questionText ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMarks(0);
    setEditText("");
  }

  async function saveEdit(questionId: Id<"assessmentQuestions">) {
    try {
      await updateQuestion({
        questionId,
        marksAllocated: editMarks,
        questionText: editText || undefined,
      });
      toast.success("Question updated");
      cancelEdit();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update question";
      toast.error(message);
    }
  }

  async function handleDelete(questionId: Id<"assessmentQuestions">) {
    try {
      await deleteQuestion({ questionId });
      toast.success("Question deleted");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete question";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Questions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Progress bar ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Marks Allocated</span>
              <span className="font-medium">
                {existingMarksTotal}{" "}
                <span className="text-gray-400">/ {totalMarks}</span>
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-gray-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={existingMarksTotal}
              aria-valuemin={0}
              aria-valuemax={totalMarks}
              aria-label={`${existingMarksTotal} of ${totalMarks} marks allocated`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  existingMarksTotal === totalMarks
                    ? "bg-school-green"
                    : existingMarksTotal > totalMarks
                      ? "bg-red-500"
                      : "bg-school-yellow"
                }`}
                style={{ width: `${allocationPercent}%` }}
              />
            </div>
            {remainingMarks > 0 && (
              <p className="text-xs text-gray-500">
                {remainingMarks} marks remaining
              </p>
            )}
            {remainingMarks === 0 && existingQuestions.length > 0 && (
              <p className="text-xs text-school-green font-medium">
                All marks allocated
              </p>
            )}
          </div>

          {/* ── Existing questions ─────────────────────────────────── */}
          {existingQuestions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Questions ({existingQuestions.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {existingQuestions.map((q) => (
                    <div
                      key={q._id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      {editingId === q._id ? (
                        <>
                          <span className="text-gray-500 font-medium shrink-0">
                            Q{q.questionNumber}
                          </span>
                          <Input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={editMarks}
                            onChange={(e) =>
                              setEditMarks(parseFloat(e.target.value) || 0)
                            }
                            className="w-20 h-7 text-xs"
                            aria-label={`Marks for question ${q.questionNumber}`}
                          />
                          <Input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            placeholder="Question text (optional)"
                            className="h-7 text-xs flex-1"
                            aria-label={`Text for question ${q.questionNumber}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            onClick={() => saveEdit(q._id)}
                            aria-label="Save changes"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-gray-600"
                            onClick={cancelEdit}
                            aria-label="Cancel editing"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-700 flex-1">
                            Q{q.questionNumber}
                            {q.questionText ? `: ${q.questionText}` : ""}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0"
                          >
                            {q.marksAllocated} marks
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-gray-600"
                            onClick={() => startEdit(q)}
                            aria-label={`Edit question ${q.questionNumber}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-500"
                            onClick={() => handleDelete(q._id)}
                            aria-label={`Delete question ${q.questionNumber}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Add questions ──────────────────────────────────────── */}
          {remainingMarks > 0 && (
            <>
              <Separator />
              <Tabs defaultValue="custom" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="custom" className="flex-1">
                    Custom Marks
                  </TabsTrigger>
                  <TabsTrigger value="quick" className="flex-1">
                    Quick Fill
                  </TabsTrigger>
                </TabsList>

                {/* ── Custom tab ──────────────────────────────────── */}
                <TabsContent value="custom" className="space-y-3 mt-3">
                  <p className="text-xs text-gray-500">
                    Add questions with different marks for each.
                  </p>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {customRows.map((row, idx) => (
                      <div key={row.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-8 shrink-0">
                          Q{existingQuestions.length + idx + 1}
                        </span>
                        <Input
                          type="number"
                          min={0.5}
                          step={0.5}
                          placeholder="Marks"
                          value={row.marks || ""}
                          onChange={(e) =>
                            updateCustomRow(
                              row.id,
                              "marks",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-20 h-8 text-sm"
                          aria-label={`Marks for new question ${idx + 1}`}
                        />
                        <Input
                          type="text"
                          placeholder="Question text (optional)"
                          value={row.questionText}
                          onChange={(e) =>
                            updateCustomRow(
                              row.id,
                              "questionText",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm flex-1"
                          aria-label={`Text for new question ${idx + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500 shrink-0"
                          onClick={() => removeCustomRow(row.id)}
                          disabled={customRows.length <= 1}
                          aria-label={`Remove question row ${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addCustomRow}
                    aria-label="Add another question row"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Row
                  </Button>

                  {/* Running total */}
                  <output
                    className={`block text-xs px-3 py-2 rounded-md ${
                      customTotal === 0
                        ? "bg-gray-50 text-gray-500"
                        : customFitsRemaining
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                    }`}
                    aria-live="polite"
                  >
                    Adding: {customTotal} marks
                    {customTotal > 0 && (
                      <span className="text-gray-400">
                        {" "}
                        (
                        {remainingMarks - customTotal >= 0
                          ? `${remainingMarks - customTotal} remaining after`
                          : `exceeds remaining by ${customTotal - remainingMarks}`}
                        )
                      </span>
                    )}
                  </output>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-school-green hover:bg-school-green/90 text-white"
                      disabled={
                        isSubmitting ||
                        !customFitsRemaining ||
                        !customHasValidRows
                      }
                      onClick={onCustomSubmit}
                      aria-label="Add custom questions"
                    >
                      {isSubmitting
                        ? "Adding..."
                        : `Add ${customRows.filter((r) => r.marks > 0).length} Question${customRows.filter((r) => r.marks > 0).length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </TabsContent>

                {/* ── Quick Fill tab ──────────────────────────────── */}
                <TabsContent value="quick" className="space-y-3 mt-3">
                  <p className="text-xs text-gray-500">
                    Add multiple questions with the same marks each.
                  </p>
                  <Form {...quickForm}>
                    <form
                      onSubmit={quickForm.handleSubmit(onQuickFillSubmit)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={quickForm.control}
                          name="numberOfQuestions"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Questions</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                  aria-label="Number of questions to add"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={quickForm.control}
                          name="marksPerQuestion"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marks per Question</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  aria-label="Marks allocated per question"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <output
                        className={`block text-xs px-3 py-2 rounded-md ${
                          quickProjectedTotal === 0
                            ? "bg-gray-50 text-gray-500"
                            : quickFitsRemaining
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                        }`}
                        aria-live="polite"
                      >
                        Projected total: {quickProjectedTotal} marks
                        {quickProjectedTotal > 0 && (
                          <span className="text-gray-400">
                            {" "}
                            (
                            {remainingMarks - quickProjectedTotal >= 0
                              ? `${remainingMarks - quickProjectedTotal} remaining after`
                              : `exceeds remaining by ${quickProjectedTotal - remainingMarks}`}
                            )
                          </span>
                        )}
                      </output>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-school-green hover:bg-school-green/90 text-white"
                          disabled={
                            isSubmitting ||
                            !quickFitsRemaining ||
                            quickProjectedTotal === 0
                          }
                          aria-label="Add questions to assessment"
                        >
                          {isSubmitting
                            ? "Adding..."
                            : `Add ${watchedCount || 0} Question${(watchedCount || 0) !== 1 ? "s" : ""}`}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* All marks allocated — no add section */}
          {remainingMarks <= 0 && existingQuestions.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
