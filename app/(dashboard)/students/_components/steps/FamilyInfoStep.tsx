"use client";

import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

function ParentCard({ prefix, label }: { prefix: string; label: string }) {
  const form = useFormContext();
  return (
    <div className="border rounded-xl p-4">
      <h4 className="text-xs font-semibold text-slate-700 mb-3">{label}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={`${prefix}Name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}Occupation`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Occupation *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}NidNumber`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>NID Number *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}PhoneNumber`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number *</FormLabel>
              <FormControl>
                <Input type="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

export function FamilyInfoStep() {
  const form = useFormContext();
  return (
    <div className="space-y-3">
      <ParentCard prefix="father" label="Father's Information" />
      <ParentCard prefix="mother" label="Mother's Information" />

      {/* Guardian & Financial Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">
          Guardian & Financial
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="guardianName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardianRelation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relation to Student *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Uncle" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardianNidNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NID Number *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardianPhoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="sm:col-span-2">
            <FormField
              control={form.control}
              name="familyAnnualIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Annual Income *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 500,000 BDT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
