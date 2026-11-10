"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { placementErrorMessage } from "@/lib/placementErrors";
import {
  type ReadmitValues,
  readmitSchema,
} from "@/lib/validations/readmitSchema";

interface ReadmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id<"students">;
}

const fields = [
  { name: "standardLevelId", label: "Standard Level" },
  { name: "academicYear", label: "Academic Year" },
  { name: "campus", label: "Campus" },
] as const;

/**
 * Re-admission of a leaver: opens a new enrollment in the chosen class and
 * sets the student active (`students.readmitStudent`). A leaver cannot simply
 * be switched back to active — they have no class to return to.
 */
export function ReadmitDialog({
  open,
  onOpenChange,
  studentId,
}: ReadmitDialogProps) {
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const campuses = useQuery(api.campus.list);
  const readmit = useMutation(api.students.readmitStudent);

  const form = useForm<ReadmitValues>({
    resolver: zodResolver(readmitSchema),
    defaultValues: { standardLevelId: "", academicYear: "", campus: "" },
  });

  const loading =
    levels === undefined || years === undefined || campuses === undefined;
  const options = {
    standardLevelId: levels ?? [],
    academicYear: years ?? [],
    campus: campuses ?? [],
  };

  async function onSubmit(values: ReadmitValues) {
    try {
      await readmit({
        studentId,
        standardLevelId: values.standardLevelId as Id<"standardLevels">,
        academicYear: values.academicYear as Id<"academicYears">,
        campus: values.campus as Id<"campuses">,
      });
      toast.success("Student re-admitted");
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(placementErrorMessage(err, "Failed to re-admit student"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Re-admit student</DialogTitle>
          <DialogDescription>
            This student has left. Re-admitting places them in a class with a
            new enrollment and sets their status to active.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {fields.map(({ name, label }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label} *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loading || options[name].length === 0}
                    >
                      <FormControl>
                        <SelectTrigger aria-label={label}>
                          <SelectValue
                            placeholder={
                              loading
                                ? "Loading…"
                                : options[name].length === 0
                                  ? `No ${label.toLowerCase()} set up`
                                  : `Select ${label.toLowerCase()}`
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {options[name].map((o) => (
                          <SelectItem key={o._id} value={o._id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || form.formState.isSubmitting}
                className="bg-school-green hover:bg-school-green/90"
              >
                {form.formState.isSubmitting ? "Re-admitting…" : "Re-admit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
