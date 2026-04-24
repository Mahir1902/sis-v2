"use client";

import { useFormContext } from "react-hook-form";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useRef, useState } from "react";
import Image from "next/image";

export function StudentInfoStep() {
  const form = useFormContext();
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const campuses = useQuery(api.campus.list);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasHealthIssues = form.watch("hasHealthIssues");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("studentPhoto", file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  return (
    <div className="space-y-3">
      {/* Identity Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Identity</h4>
        <div className="flex gap-4">
          <div className="shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-school-green transition-colors"
            >
              {photoPreview ? (
                <Image src={photoPreview} alt="Preview" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <span className="text-[10px] text-gray-400 text-center px-1">Upload Photo</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="studentNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Student Number *</FormLabel>
                <FormControl><Input placeholder="STD-2025-0001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="studentFullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel>Gender *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>
      </div>

      {/* Personal Details Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Personal Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <FormField control={form.control} name="placeOfBirth" render={({ field }) => (
            <FormItem>
              <FormLabel>Place of Birth *</FormLabel>
              <FormControl><Input placeholder="City, Country" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="citizenship" render={({ field }) => (
            <FormItem>
              <FormLabel>Citizenship *</FormLabel>
              <FormControl><Input placeholder="e.g. Bangladeshi" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="religion" render={({ field }) => (
            <FormItem>
              <FormLabel>Religion *</FormLabel>
              <FormControl><Input placeholder="e.g. Islam" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="bloodGroup" render={({ field }) => (
            <FormItem>
              <FormLabel>Blood Group *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                <SelectContent>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="birthCertificateNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Birth Certificate No. *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="passportNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Passport No.</FormLabel>
              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Academic Placement Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Academic Placement</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField control={form.control} name="standardLevel" render={({ field }) => (
            <FormItem>
              <FormLabel>Standard Level *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                <SelectContent>
                  {(levels ?? []).map(l => (
                    <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="academicYear" render={({ field }) => (
            <FormItem>
              <FormLabel>Academic Year *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger></FormControl>
                <SelectContent>
                  {(years ?? []).map(y => (
                    <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="campus" render={({ field }) => (
            <FormItem>
              <FormLabel>Campus *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger></FormControl>
                <SelectContent>
                  {(campuses ?? []).map(c => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Address Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Address</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="presentAddress" render={({ field }) => (
            <FormItem>
              <FormLabel>Present Address *</FormLabel>
              <FormControl><Input placeholder="Full address" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="permanentAddress" render={({ field }) => (
            <FormItem>
              <FormLabel>Permanent Address</FormLabel>
              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Previous School Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Previous School</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="previousSchoolName" render={({ field }) => (
            <FormItem>
              <FormLabel>School Name</FormLabel>
              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="previousSchoolAddress" render={({ field }) => (
            <FormItem>
              <FormLabel>School Address</FormLabel>
              <FormControl><Input placeholder="Optional" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Health Card */}
      <div className="border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Health</h4>
        <FormField control={form.control} name="hasHealthIssues" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="cursor-pointer">Student has health issues</FormLabel>
          </FormItem>
        )} />
        {hasHealthIssues && (
          <div className="mt-3">
            <FormField control={form.control} name="healthIssueDescription" render={({ field }) => (
              <FormItem>
                <FormLabel>Health Issue Description *</FormLabel>
                <FormControl><Input placeholder="Describe the health issue" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
