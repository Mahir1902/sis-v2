"use client";

import { useFormContext } from "react-hook-form";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function FeesStep() {
  const form = useFormContext();
  const standardLevel = form.watch("standardLevel") as Id<"standardLevels"> | undefined;
  const academicYear = form.watch("academicYear");

  const feeStructures = useQuery(
    api.feeStructure.getFormFeeStructure,
    standardLevel ? { standardLevel } : "skip"
  );

  const isLoading = standardLevel && feeStructures === undefined;

  return (
    <div className="space-y-3">
      {/* Enrollment Details Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Enrollment Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Student Number</p>
            <p className="text-sm font-medium bg-slate-50 rounded-md px-3 py-2">{form.watch("studentNumber") || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Academic Year</p>
            <p className="text-sm font-medium bg-slate-50 rounded-md px-3 py-2">{academicYear || "—"}</p>
          </div>
          <FormField control={form.control} name="classStartDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Class Start Date *</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="consultantName" render={({ field }) => (
            <FormItem>
              <FormLabel>Consultant Name *</FormLabel>
              <FormControl><Input placeholder="Staff member name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Fee Assignment Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Fee Assignment</h4>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["admission", "tuition", "registration"] as const).map((type) => {
              const structure = feeStructures?.find((f) => f.feeType === type);
              const isAutoFilled = !!structure;
              return (
                <FormField
                  key={type}
                  control={form.control}
                  name={`${type}Fee`}
                  render={({ field }) => {
                    if (isAutoFilled && field.value === undefined) {
                      field.onChange(structure.baseAmount);
                    }
                    return (
                      <FormItem>
                        <FormLabel className="capitalize">{type} Fee</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            disabled={isAutoFilled}
                            value={isAutoFilled ? structure.baseAmount : (field.value ?? "")}
                            onChange={(e) => !isAutoFilled && field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        {isAutoFilled && (
                          <p className="text-xs text-school-green">Auto-filled from fee structure</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
