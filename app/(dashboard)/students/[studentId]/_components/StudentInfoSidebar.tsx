"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface StudentInfoSidebarProps {
  studentId: Id<"students">;
}

function maskSensitive(value: string | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{value || "—"}</span>
    </div>
  );
}

export function StudentInfoSidebar({ studentId }: StudentInfoSidebarProps) {
  const student = useQuery(api.students.getStudentById, { studentId });
  const me = useQuery(api.users.getMe);
  const currentEnrollment = useQuery(api.enrollments.getCurrentEnrollment, {
    studentId,
  });
  const siblings = useQuery(api.students.getSiblingsByStudent, { studentId });
  const fees = useQuery(api.studentFees.getByStudent, { studentId });
  const allGrades = useQuery(api.computedGrades.getComputedGradesByStudent, {
    studentId,
  });

  const isAdmin = me?.role === "admin";

  if (student === undefined) {
    return (
      <div className="flex flex-col gap-3 p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    );
  }

  if (!student) return null;

  // Compute metrics
  const totalBalance = fees?.reduce((s, f) => s + f.balance, 0) ?? 0;
  const unpaidCount = fees?.filter((f) => f.status !== "paid").length ?? 0;

  // Compute average grade from most recent grades
  let avgGrade: number | null = null;
  if (allGrades && allGrades.length > 0) {
    const percentages = allGrades
      .map((g) => g.weightedAverage)
      .filter((p): p is number => p !== null && p !== undefined);
    if (percentages.length > 0) {
      avgGrade = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    }
  }

  // Count documents
  const docCount = [
    student.birthCertificateNumber,
    "passportNumber" in student
      ? (student as Record<string, unknown>).passportNumber
      : null,
    "passportValidTill" in student
      ? (student as Record<string, unknown>).passportValidTill
      : null,
  ].filter(Boolean).length;

  const siblingCount = siblings?.length ?? 0;

  return (
    <div className="flex flex-col gap-3 p-3.5 text-xs overflow-y-auto">
      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Avg Grade
          </div>
          <div className="text-xl font-bold mt-0.5">
            {avgGrade !== null ? `${avgGrade.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Fees Due
          </div>
          <div
            className={cn(
              "text-xl font-bold mt-0.5",
              totalBalance > 0 ? "text-red-600" : "text-foreground",
            )}
          >
            {totalBalance > 0 ? `৳${(totalBalance / 1000).toFixed(0)}K` : "৳0"}
          </div>
          {unpaidCount > 0 && (
            <div className="text-[10px] text-red-600 mt-0.5">
              {unpaidCount} unpaid
            </div>
          )}
        </div>
      </div>

      {/* ── Accordion Sections ── */}
      <Accordion
        type="multiple"
        defaultValue={["personal", "enrollment", "family", "addresses"]}
        className="flex flex-col gap-2"
      >
        {/* Personal Info */}
        <AccordionItem
          value="personal"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            Personal Info
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Gender" value={student.gender} />
              <InfoRow
                label="Date of Birth"
                value={format(new Date(student.dateOfBirth), "dd MMM yyyy")}
              />
              <InfoRow label="Birthplace" value={student.placeOfBirth} />
              <InfoRow label="Citizenship" value={student.citizenship} />
              <InfoRow label="Religion" value={student.religion} />
              <InfoRow label="Blood Group" value={student.bloodGroup} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Enrollment */}
        <AccordionItem
          value="enrollment"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            Enrollment
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Level" value={student.standardLevelDoc?.name} />
              <InfoRow
                label="Section / Roll"
                value={
                  currentEnrollment
                    ? [
                        currentEnrollment.section,
                        currentEnrollment.rollNumber
                          ? `#${currentEnrollment.rollNumber}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—"
                    : "—"
                }
              />
              <InfoRow label="Campus" value={student.campusDoc?.name} />
              <InfoRow label="Type" value={currentEnrollment?.enrollmentType} />
              <InfoRow
                label="Admitted"
                value={format(new Date(student.admissionDate), "dd MMM yyyy")}
              />
              <InfoRow
                label="Class Start"
                value={format(new Date(student.classStartDate), "dd MMM yyyy")}
              />
              <InfoRow label="Consultant" value={student.consultantName} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Family & Contacts */}
        <AccordionItem
          value="family"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            Family &amp; Contacts
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-2.5">
              {/* Father */}
              <div className="bg-slate-50 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-md bg-slate-200 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {student.fatherName
                      .split(" ")
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-xs">
                      {student.fatherName}
                    </div>
                    <div className="text-school-green text-[10px]">Father</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pl-9">
                  <InfoRow
                    label="Occupation"
                    value={student.fatherOccupation}
                  />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Phone
                    </span>
                    <a
                      href={`tel:${student.fatherPhoneNumber}`}
                      className="font-medium text-school-green hover:underline text-right truncate"
                    >
                      {student.fatherPhoneNumber}
                    </a>
                  </div>
                  {"fatherNidNumber" in student && (
                    <InfoRow
                      label="NID"
                      value={
                        isAdmin
                          ? ((student as Record<string, unknown>)
                              .fatherNidNumber as string)
                          : maskSensitive(
                              (student as Record<string, unknown>)
                                .fatherNidNumber as string | undefined,
                            )
                      }
                    />
                  )}
                </div>
              </div>

              {/* Mother */}
              <div className="bg-slate-50 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-md bg-pink-100 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {student.motherName
                      .split(" ")
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-xs">
                      {student.motherName}
                    </div>
                    <div className="text-school-green text-[10px]">Mother</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pl-9">
                  <InfoRow
                    label="Occupation"
                    value={student.motherOccupation}
                  />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Phone
                    </span>
                    <a
                      href={`tel:${student.motherPhoneNumber}`}
                      className="font-medium text-school-green hover:underline text-right truncate"
                    >
                      {student.motherPhoneNumber}
                    </a>
                  </div>
                  {"motherNidNumber" in student && (
                    <InfoRow
                      label="NID"
                      value={
                        isAdmin
                          ? ((student as Record<string, unknown>)
                              .motherNidNumber as string)
                          : maskSensitive(
                              (student as Record<string, unknown>)
                                .motherNidNumber as string | undefined,
                            )
                      }
                    />
                  )}
                </div>
              </div>

              {/* Guardian */}
              <div className="bg-slate-50 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {student.guardianName
                      .split(" ")
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-xs">
                      {student.guardianName}
                    </div>
                    <div className="text-school-green text-[10px]">
                      Guardian · {student.guardianRelation}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pl-9">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Phone
                    </span>
                    <a
                      href={`tel:${student.guardianPhoneNumber}`}
                      className="font-medium text-school-green hover:underline text-right truncate"
                    >
                      {student.guardianPhoneNumber}
                    </a>
                  </div>
                  {"guardianNidNumber" in student && (
                    <InfoRow
                      label="NID"
                      value={
                        isAdmin
                          ? ((student as Record<string, unknown>)
                              .guardianNidNumber as string)
                          : maskSensitive(
                              (student as Record<string, unknown>)
                                .guardianNidNumber as string | undefined,
                            )
                      }
                    />
                  )}
                </div>
              </div>

              {/* Income */}
              {"familyAnnualIncome" in student && isAdmin && (
                <div className="flex justify-between gap-2 border-t pt-2">
                  <span className="text-muted-foreground">Annual Income</span>
                  <span className="font-medium">
                    {((student as Record<string, unknown>)
                      .familyAnnualIncome as string) || "—"}
                  </span>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Addresses */}
        <AccordionItem
          value="addresses"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            Addresses
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-2">
              <div>
                <div className="text-muted-foreground text-[10px] mb-0.5">
                  Present
                </div>
                <div className="font-medium">{student.presentAddress}</div>
              </div>
              {student.permanentAddress && (
                <div className="border-t pt-2">
                  <div className="text-muted-foreground text-[10px] mb-0.5">
                    Permanent
                  </div>
                  <div className="font-medium">{student.permanentAddress}</div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Documents (collapsed by default) */}
        <AccordionItem
          value="documents"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center justify-between w-full pr-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Documents
              </span>
              <span className="text-[9px] text-muted-foreground">
                {docCount} doc{docCount !== 1 ? "s" : ""}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-1.5">
              <InfoRow
                label="Birth Cert"
                value={
                  isAdmin
                    ? student.birthCertificateNumber
                    : maskSensitive(student.birthCertificateNumber)
                }
              />
              <InfoRow
                label="Passport"
                value={
                  "passportNumber" in student
                    ? isAdmin
                      ? ((student as Record<string, unknown>)
                          .passportNumber as string)
                      : maskSensitive(
                          (student as Record<string, unknown>).passportNumber as
                            | string
                            | undefined,
                        )
                    : "—"
                }
              />
              <InfoRow
                label="Passport Expiry"
                value={
                  "passportValidTill" in student &&
                  (student as Record<string, unknown>).passportValidTill
                    ? format(
                        new Date(
                          (student as Record<string, unknown>)
                            .passportValidTill as number,
                        ),
                        "dd MMM yyyy",
                      )
                    : "—"
                }
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Health (collapsed by default) */}
        <AccordionItem
          value="health"
          className="bg-white border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3.5 py-2.5 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center justify-between w-full pr-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Health
              </span>
              <span
                className={cn(
                  "text-[9px] font-medium",
                  student.healthIssue.hasHealthIssues
                    ? "text-red-600"
                    : "text-green-600",
                )}
              >
                {student.healthIssue.hasHealthIssues
                  ? "Has issues"
                  : "No issues"}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-3 pt-0">
            <div className="flex flex-col gap-1.5">
              <InfoRow
                label="Has Issues"
                value={student.healthIssue.hasHealthIssues ? "Yes" : "No"}
              />
              {student.healthIssue.issueDescription && (
                <div>
                  <span className="text-muted-foreground text-xs">
                    Description
                  </span>
                  <p className="font-medium text-sm mt-0.5 break-words">
                    {student.healthIssue.issueDescription}
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Previous School (collapsed, conditional) */}
        {student.previousSchoolName && (
          <AccordionItem
            value="previousSchool"
            className="bg-white border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="px-3.5 py-2.5 hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Previous School
                </span>
                <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                  {student.previousSchoolName}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3.5 pb-3 pt-0">
              <div className="flex flex-col gap-1.5">
                <InfoRow label="School" value={student.previousSchoolName} />
                <InfoRow
                  label="Address"
                  value={student.previousSchoolAddress}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Siblings (collapsed, conditional) */}
        {siblings && siblings.length > 0 && (
          <AccordionItem
            value="siblings"
            className="bg-white border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="px-3.5 py-2.5 hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Siblings
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {siblingCount} linked
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3.5 pb-3 pt-0">
              <div className="flex flex-col gap-2">
                {siblings.map(
                  (s) =>
                    s && (
                      <Link
                        key={s._id}
                        href={`/students/${s._id}`}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-md hover:bg-green-50 hover:border-school-green transition-colors border border-transparent"
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-semibold shrink-0">
                          {s.studentFullName
                            .split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs truncate">
                            {s.studentFullName}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {s.standardLevelName} · {s.campusName}
                          </div>
                        </div>
                      </Link>
                    ),
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Footer: Created date */}
      <div className="text-[9px] text-muted-foreground text-center pt-1">
        Created{" "}
        {student.createdAt
          ? format(new Date(student.createdAt), "dd MMM yyyy")
          : "—"}
      </div>
    </div>
  );
}
