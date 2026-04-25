"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EditAssessmentDialogProps {
  open: boolean;
  onClose: () => void;
  assessment: {
    _id: Id<"assessments">;
    name: string;
    totalMarks: number;
    passingMarks?: number;
    assessmentDate?: number;
    allocatedMarks: number;
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EditAssessmentDialog({
  open,
  onClose,
  assessment,
}: EditAssessmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateAssessment = useMutation(api.assessments.updateAssessment);

  const editAssessmentSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, "Name is required"),
        totalMarks: z
          .number()
          .min(1, "Total marks must be at least 1")
          .refine(
            (val) => val >= assessment.allocatedMarks,
            `Cannot be less than ${assessment.allocatedMarks} (currently allocated)`,
          ),
        passingMarks: z.number().min(0).optional(),
        assessmentDate: z.string().optional(),
      }),
    [assessment.allocatedMarks],
  );
  type EditAssessmentValues = z.infer<typeof editAssessmentSchema>;

  const form = useForm<EditAssessmentValues>({
    resolver: zodResolver(editAssessmentSchema),
    defaultValues: {
      name: assessment.name,
      totalMarks: assessment.totalMarks,
      passingMarks: assessment.passingMarks ?? undefined,
      assessmentDate: assessment.assessmentDate
        ? new Date(assessment.assessmentDate).toISOString().split("T")[0]
        : undefined,
    },
  });

  async function onSubmit(values: EditAssessmentValues) {
    setIsSubmitting(true);
    try {
      await updateAssessment({
        assessmentId: assessment._id,
        name: values.name,
        totalMarks: values.totalMarks,
        passingMarks: values.passingMarks,
        assessmentDate: values.assessmentDate
          ? new Date(values.assessmentDate).getTime()
          : undefined,
      });
      toast.success("Assessment updated");
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update assessment";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Assessment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} aria-label="Assessment name" />
                  </FormControl>
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
                      min={1}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                      aria-label="Total marks"
                    />
                  </FormControl>
                  {assessment.allocatedMarks > 0 && (
                    <p className="text-xs text-gray-500">
                      {assessment.allocatedMarks} marks currently allocated
                      across questions (minimum value)
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passingMarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passing Marks (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(
                          val === "" ? undefined : parseFloat(val),
                        );
                      }}
                      aria-label="Passing marks"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assessmentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Date (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                      aria-label="Assessment date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-school-green hover:bg-school-green/90 text-white"
                disabled={isSubmitting}
                aria-label="Save assessment changes"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
