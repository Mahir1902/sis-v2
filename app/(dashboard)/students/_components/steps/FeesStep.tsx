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
    <div className="space-y-6">
      {/* Read-only summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <p><span className="text-gray-500">Student Number:</span> <span className="font-medium">{form.watch("studentNumber") || "—"}</span></p>
        <p><span className="text-gray-500">Academic Year:</span> <span className="font-medium">{academicYear || "—"}</span></p>
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

      {/* Fee amounts */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">Fee Assignment</h3>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["admission", "tuition", "registration"] as const).map((type) => {
              const structure = feeStructures?.find((f) => f.feeType === type);
              const isAutoFilled = !!structure;
              return (
                <FormField
                  key={type}
                  control={form.control}
                  name={`${type}Fee`}
                  render={({ field }) => {
                    // Auto-fill from fee structure
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
