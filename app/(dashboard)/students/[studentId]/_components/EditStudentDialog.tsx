"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const editStudentSchema = z.object({
  studentFullName: z.string().min(2, "Full name is required"),
  gender: z.enum(["Male", "Female"]),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  placeOfBirth: z.string().min(1, "Place of birth is required"),
  citizenship: z.string().min(1, "Citizenship is required"),
  religion: z.string().min(1, "Religion is required"),
  bloodGroup: z.string().min(1, "Blood group is required"),
  birthCertificateNumber: z
    .string()
    .min(1, "Birth certificate number is required"),
  passportNumber: z.string().optional(),
  passportValidTill: z.string().optional(),
  standardLevel: z.string().min(1, "Standard level is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  campus: z.string().min(1, "Campus is required"),
  presentAddress: z.string().min(1, "Present address is required"),
  permanentAddress: z.string().optional(),
  previousSchoolName: z.string().optional(),
  previousSchoolAddress: z.string().optional(),
  hasHealthIssues: z.boolean(),
  healthIssueDescription: z.string().optional(),
  fatherName: z.string().min(1, "Father name is required"),
  fatherOccupation: z.string().min(1, "Father occupation is required"),
  fatherNidNumber: z.string().min(1, "Father NID is required"),
  fatherPhoneNumber: z.string().min(1, "Father phone is required"),
  motherName: z.string().min(1, "Mother name is required"),
  motherOccupation: z.string().min(1, "Mother occupation is required"),
  motherNidNumber: z.string().min(1, "Mother NID is required"),
  motherPhoneNumber: z.string().min(1, "Mother phone is required"),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianRelation: z.string().min(1, "Guardian relation is required"),
  guardianNidNumber: z.string().min(1, "Guardian NID is required"),
  guardianPhoneNumber: z.string().min(1, "Guardian phone is required"),
  familyAnnualIncome: z.string().min(1, "Family annual income is required"),
  consultantName: z.string().min(1, "Consultant name is required"),
});

type EditStudentValues = z.infer<typeof editStudentSchema>;

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id<"students">;
}

function formatTimestampToDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditStudentDialog({
  open,
  onOpenChange,
  studentId,
}: EditStudentDialogProps) {
  const student = useQuery(api.students.getStudentById, { studentId });
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const campuses = useQuery(api.campus.list);
  const updateStudent = useMutation(api.students.updateStudent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditStudentValues>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      studentFullName: "",
      gender: "Male",
      dateOfBirth: "",
      placeOfBirth: "",
      citizenship: "",
      religion: "",
      bloodGroup: "",
      birthCertificateNumber: "",
      passportNumber: "",
      passportValidTill: "",
      standardLevel: "",
      academicYear: "",
      campus: "",
      presentAddress: "",
      permanentAddress: "",
      previousSchoolName: "",
      previousSchoolAddress: "",
      hasHealthIssues: false,
      healthIssueDescription: "",
      fatherName: "",
      fatherOccupation: "",
      fatherNidNumber: "",
      fatherPhoneNumber: "",
      motherName: "",
      motherOccupation: "",
      motherNidNumber: "",
      motherPhoneNumber: "",
      guardianName: "",
      guardianRelation: "",
      guardianNidNumber: "",
      guardianPhoneNumber: "",
      familyAnnualIncome: "",
      consultantName: "",
    },
  });

  const hasHealthIssues = form.watch("hasHealthIssues");

  useEffect(() => {
    if (student && open) {
      // Some fields may be stripped for student-role callers.
      // Cast to a wider type so we can safely access optional sensitive fields.
      const data = student as Record<string, unknown>;

      form.reset({
        studentFullName: student.studentFullName,
        gender: student.gender,
        dateOfBirth: formatTimestampToDateString(student.dateOfBirth),
        placeOfBirth: student.placeOfBirth,
        citizenship: student.citizenship,
        religion: student.religion,
        bloodGroup: student.bloodGroup,
        birthCertificateNumber: student.birthCertificateNumber,
        passportNumber: (data.passportNumber as string) ?? "",
        passportValidTill:
          typeof data.passportValidTill === "number"
            ? formatTimestampToDateString(data.passportValidTill)
            : "",
        standardLevel: student.standardLevel,
        academicYear: student.academicYear,
        campus: student.campus,
        presentAddress: student.presentAddress,
        permanentAddress: student.permanentAddress ?? "",
        previousSchoolName: student.previousSchoolName ?? "",
        previousSchoolAddress: student.previousSchoolAddress ?? "",
        hasHealthIssues: student.healthIssue.hasHealthIssues,
        healthIssueDescription: student.healthIssue.issueDescription ?? "",
        fatherName: student.fatherName,
        fatherOccupation: student.fatherOccupation,
        fatherNidNumber: (data.fatherNidNumber as string) ?? "",
        fatherPhoneNumber: student.fatherPhoneNumber,
        motherName: student.motherName,
        motherOccupation: student.motherOccupation,
        motherNidNumber: (data.motherNidNumber as string) ?? "",
        motherPhoneNumber: student.motherPhoneNumber,
        guardianName: student.guardianName,
        guardianRelation: student.guardianRelation,
        guardianNidNumber: (data.guardianNidNumber as string) ?? "",
        guardianPhoneNumber: student.guardianPhoneNumber,
        familyAnnualIncome: (data.familyAnnualIncome as string) ?? "",
        consultantName: student.consultantName,
      });
    }
  }, [student, open, form]);

  async function onSubmit(values: EditStudentValues) {
    setIsSubmitting(true);
    try {
      await updateStudent({
        studentId,
        studentFullName: values.studentFullName,
        gender: values.gender,
        dateOfBirth: new Date(values.dateOfBirth).getTime(),
        placeOfBirth: values.placeOfBirth,
        citizenship: values.citizenship,
        religion: values.religion,
        bloodGroup: values.bloodGroup,
        birthCertificateNumber: values.birthCertificateNumber,
        passportNumber: values.passportNumber || undefined,
        passportValidTill: values.passportValidTill
          ? new Date(values.passportValidTill).getTime()
          : undefined,
        standardLevel: values.standardLevel as Id<"standardLevels">,
        academicYear: values.academicYear as Id<"academicYears">,
        campus: values.campus as Id<"campuses">,
        presentAddress: values.presentAddress,
        permanentAddress: values.permanentAddress || undefined,
        previousSchoolName: values.previousSchoolName || undefined,
        previousSchoolAddress: values.previousSchoolAddress || undefined,
        healthIssue: {
          hasHealthIssues: values.hasHealthIssues,
          issueDescription: values.healthIssueDescription || undefined,
        },
        fatherName: values.fatherName,
        fatherOccupation: values.fatherOccupation,
        fatherNidNumber: values.fatherNidNumber,
        fatherPhoneNumber: values.fatherPhoneNumber,
        motherName: values.motherName,
        motherOccupation: values.motherOccupation,
        motherNidNumber: values.motherNidNumber,
        motherPhoneNumber: values.motherPhoneNumber,
        guardianName: values.guardianName,
        guardianRelation: values.guardianRelation,
        guardianNidNumber: values.guardianNidNumber,
        guardianPhoneNumber: values.guardianPhoneNumber,
        familyAnnualIncome: values.familyAnnualIncome,
        consultantName: values.consultantName,
      });
      toast.success("Student updated successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update student");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Update student information. All required fields must be filled.
          </DialogDescription>
        </DialogHeader>

        {student === undefined ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Loading student data...
            </p>
          </div>
        ) : !student ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-red-600">Student not found.</p>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="overflow-y-auto flex-1 px-6 py-4 -mx-6 space-y-4">
                {/* Student Information */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Student Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="studentFullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="placeOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Place of Birth *</FormLabel>
                          <FormControl>
                            <Input placeholder="City, Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="citizenship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Citizenship *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Bangladeshi" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="religion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religion *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Islam" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bloodGroup"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blood Group *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select blood group" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[
                                "A+",
                                "A-",
                                "B+",
                                "B-",
                                "AB+",
                                "AB-",
                                "O+",
                                "O-",
                              ].map((bg) => (
                                <SelectItem key={bg} value={bg}>
                                  {bg}
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
                      name="birthCertificateNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Birth Certificate No. *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passportNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passport No.</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passportValidTill"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passport Valid Till</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Academic Placement */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Academic Placement
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="standardLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standard Level *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(levels ?? []).map((l) => (
                                <SelectItem key={l._id} value={l._id}>
                                  {l.name}
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
                      name="academicYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Academic Year *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(years ?? []).map((y) => (
                                <SelectItem key={y._id} value={y._id}>
                                  {y.name}
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
                      name="campus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campus *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select campus" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(campuses ?? []).map((c) => (
                                <SelectItem key={c._id} value={c._id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Address
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="presentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Present Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="Full address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="permanentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Permanent Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Previous School */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Previous School
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="previousSchoolName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>School Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="previousSchoolAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>School Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Health */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Health
                  </h4>
                  <FormField
                    control={form.control}
                    name="hasHealthIssues"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">
                          Student has health issues
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {hasHealthIssues && (
                    <div className="mt-3">
                      <FormField
                        control={form.control}
                        name="healthIssueDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Health Issue Description *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Describe the health issue"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Father's Information */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Father&apos;s Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="fatherName"
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
                      name="fatherOccupation"
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
                      name="fatherNidNumber"
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
                      name="fatherPhoneNumber"
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

                {/* Mother's Information */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Mother&apos;s Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="motherName"
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
                      name="motherOccupation"
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
                      name="motherNidNumber"
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
                      name="motherPhoneNumber"
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

                {/* Guardian & Financial */}
                <div className="border rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Guardian &amp; Financial
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
                              <Input
                                placeholder="e.g. 500,000 BDT"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name="consultantName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Consultant Name *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-school-green hover:bg-school-green/90 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving\u2026" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
