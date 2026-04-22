"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { RoleGate } from "@/components/shared/RoleGate";

const feeTypes = ["admission", "tuition", "registration", "library", "sports", "computer"] as const;

const frequencies = ["one-time", "monthly", "yearly"] as const;

const createFeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  feeType: z.enum(feeTypes),
  baseAmount: z.number().min(0, "Amount must be non-negative"),
  frequency: z.enum(frequencies),
  dueDate: z.string().optional(),
  lateFeeEnabled: z.boolean(),
  lateFeeAmount: z.number().optional(),
});
type CreateFeeValues = z.infer<typeof createFeeSchema>;

export default function FeesPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <FeesPageContent />
    </RoleGate>
  );
}

function FeesPageContent() {
  const [createFor, setCreateFor] = useState<Id<"standardLevels"> | null>(null);

  const levels = useQuery(api.standardLevels.list);
  const allFees = useQuery(api.feeStructure.list);

  if (levels === undefined || allFees === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Fee Structures</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {levels.map((level) => {
          const levelFees = allFees.filter((f) => f.standardLevel === level._id);
          const lastUpdated = levelFees.length > 0
            ? Math.max(...levelFees.map((f) => f._creationTime))
            : null;

          return (
            <div key={level._id} className="bg-white border rounded-lg p-4 space-y-3 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-gray-900">{level.name}</h3>
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-school-green/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-school-green">{levelFees.length}</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500">
                  Total Fee Types: {levelFees.length}
                </p>
                {lastUpdated && (
                  <p className="text-xs text-gray-400">
                    Last updated: {format(new Date(lastUpdated), "dd MMM yyyy")}
                  </p>
                )}
              </div>
              {levelFees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {levelFees.map((f) => (
                    <Badge key={f._id} variant="outline" className="text-xs capitalize">
                      {f.feeType}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => setCreateFor(level._id)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Fee Type
              </Button>
            </div>
          );
        })}
      </div>

      <CreateFeeDialog
        open={!!createFor}
        onClose={() => setCreateFor(null)}
        standardLevelId={createFor!}
      />
    </div>
  );
}

// ── Create Fee Dialog ─────────────────────────────────────────────────────────

function CreateFeeDialog({
  open,
  onClose,
  standardLevelId,
}: {
  open: boolean;
  onClose: () => void;
  standardLevelId: Id<"standardLevels">;
}) {
  const createFee = useMutation(api.feeStructure.createFee);

  const form = useForm<CreateFeeValues>({
    resolver: zodResolver(createFeeSchema),
    defaultValues: {
      name: "",
      feeType: "tuition",
      baseAmount: 0,
      frequency: "monthly",
      lateFeeEnabled: false,
    },
  });

  const lateFeeEnabled = form.watch("lateFeeEnabled");

  async function onSubmit(values: CreateFeeValues) {
    try {
      await createFee({
        name: values.name,
        feeType: values.feeType,
        baseAmount: values.baseAmount,
        frequency: values.frequency,
        standardLevel: standardLevelId,
        dueDate: values.dueDate ? new Date(values.dueDate).getTime() : undefined,
        lateFeeConfig: values.lateFeeEnabled
          ? { enabled: true, amount: values.lateFeeAmount ?? 0 }
          : undefined,
      });
      toast.success("Fee structure created");
      form.reset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create fee";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Fee Type</DialogTitle>
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
                    <Input placeholder="e.g. Monthly Tuition Fee" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="feeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {feeTypes.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["monthly", "yearly", "one-time", "semester"].map((f) => (
                          <SelectItem key={f} value={f} className="capitalize">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="baseAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Amount (৳)</FormLabel>
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

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lateFeeEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Late Fee</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {lateFeeEnabled && (
              <FormField
                control={form.control}
                name="lateFeeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late Fee Amount (৳)</FormLabel>
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
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-school-green hover:bg-school-green/90 text-white"
              >
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
