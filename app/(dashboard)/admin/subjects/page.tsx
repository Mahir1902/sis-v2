"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Plus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RoleGate } from "@/components/shared/RoleGate";

// ── Schema ────────────────────────────────────────────────────────────────────

const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(10, "Code must be 10 characters or less"),
  displayOrder: z.number().min(1).optional(),
});

type CreateSubjectValues = z.infer<typeof createSubjectSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <SubjectsPageContent />
    </RoleGate>
  );
}

function SubjectsPageContent() {
  const [createOpen, setCreateOpen] = useState(false);

  const subjects = useQuery(api.subjects.list);
  const toggleActive = useMutation(api.subjects.toggleActive);

  async function handleToggle(subjectId: Id<"subjects">, isActive: boolean) {
    try {
      await toggleActive({ subjectId, isActive });
      toast.success(isActive ? "Subject activated" : "Subject deactivated");
    } catch {
      toast.error("Failed to update subject");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-school-green hover:bg-school-green/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Subject
        </Button>
      </div>

      {/* Subject list */}
      {subjects === undefined ? (
        <div className="bg-white rounded-lg border divide-y">
          {Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((key) => (
            <div key={key} className="flex items-center gap-4 p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 ml-auto" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No subjects yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Add subjects to get started with the assessment system.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-4 bg-school-green hover:bg-school-green/90 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Subject
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {subjects.map((subject) => (
            <div key={subject._id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">
                    {subject.name}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {subject.code}
                  </Badge>
                </div>
                {subject.displayOrder !== undefined && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Display order: {subject.displayOrder}
                  </p>
                )}
              </div>

              <Badge
                className={
                  subject.isActive
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500"
                }
              >
                {subject.isActive ? "Active" : "Inactive"}
              </Badge>

              <Switch
                aria-label={`Toggle ${subject.name} active status`}
                checked={subject.isActive ?? false}
                onCheckedChange={(checked) =>
                  handleToggle(subject._id, checked)
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Summary footer */}
      {subjects && subjects.length > 0 && (
        <p className="text-sm text-gray-500">
          {subjects.filter((s) => s.isActive).length} of {subjects.length}{" "}
          subjects active
        </p>
      )}

      {/* Create dialog */}
      <CreateSubjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ── Create Subject Dialog ──────────────────────────────────────────────────────

function CreateSubjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createSubject = useMutation(api.subjects.create);

  const form = useForm<CreateSubjectValues>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  async function onSubmit(values: CreateSubjectValues) {
    try {
      await createSubject({
        name: values.name,
        code: values.code.toUpperCase(),
        displayOrder: values.displayOrder,
      });
      toast.success("Subject created");
      form.reset();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create subject";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Subject</DialogTitle>
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
                    <Input placeholder="e.g. Mathematics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. MATH"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g. 1"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseInt(e.target.value, 10)
                            : undefined,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-school-green hover:bg-school-green/90 text-white"
              >
                Add Subject
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
