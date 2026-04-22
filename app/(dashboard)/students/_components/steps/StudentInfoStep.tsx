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
    <div className="space-y-4">
      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="h-20 w-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-school-green transition-colors"
        >
          {photoPreview ? (
            <Image src={photoPreview} alt="Preview" width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <span className="text-xs text-gray-400 text-center px-1">Upload Photo</span>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <p className="text-xs text-gray-500">Optional · Max 4MB · Images only</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <FormLabel>Birth Certificate Number *</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

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

      <FormField control={form.control} name="presentAddress" render={({ field }) => (
        <FormItem>
          <FormLabel>Present Address *</FormLabel>
          <FormControl><Input placeholder="Full address" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="previousSchoolName" render={({ field }) => (
        <FormItem>
          <FormLabel>Previous School Name</FormLabel>
          <FormControl><Input placeholder="Optional" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      {/* Health */}
      <div className="space-y-2">
        <FormField control={form.control} name="hasHealthIssues" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="cursor-pointer">Student has health issues</FormLabel>
          </FormItem>
        )} />
        {hasHealthIssues && (
          <FormField control={form.control} name="healthIssueDescription" render={({ field }) => (
            <FormItem>
              <FormLabel>Health Issue Description *</FormLabel>
              <FormControl><Input placeholder="Describe the health issue" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </div>
    </div>
  );
}
