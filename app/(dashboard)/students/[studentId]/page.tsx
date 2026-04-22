"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "../_components/StatusBadge";
import { OverviewTab } from "./_components/OverviewTab";
import { GradesTab } from "./_components/GradesTab";
import { AcademicHistoryTab } from "./_components/AcademicHistoryTab";
import { ReportCardsTab } from "./_components/ReportCardsTab";
import { FeesTab } from "./_components/FeesTab";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "fees" | "academic" | "grades" | "reports";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "academic", label: "Academic History" },
  { id: "grades", label: "Grades" },
  { id: "reports", label: "Report Cards" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as Id<"students">;
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const student = useQuery(api.students.getStudentById, { studentId });

  if (student === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Student not found.</p>
        <button
          onClick={() => router.push("/students")}
          className="mt-4 text-school-green text-sm hover:underline"
        >
          Back to students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/students")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        aria-label="Back to students list"
      >
        <ArrowLeft className="h-4 w-4" />
        All Students
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 bg-white rounded-lg p-6 border">
        <Avatar className="h-20 w-20 border-4 border-white shadow-md shrink-0">
          <AvatarImage
            src={typeof student.studentPhotoUrl === "string" ? student.studentPhotoUrl : undefined}
            alt={student.studentFullName}
          />
          <AvatarFallback className="bg-school-green/10 text-school-green text-xl font-bold">
            {getInitials(student.studentFullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {student.studentFullName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{student.studentNumber}</p>
          <div className="mt-2">
            <StatusBadge studentId={studentId} status={student.status} />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <nav className="flex border-b">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              className={cn(
                "px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none",
                activeTab === tab.id
                  ? "border-b-2 border-school-green text-school-green"
                  : "text-gray-500 hover:text-gray-900",
                i > 0 && "border-l border-gray-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-6">
          <ErrorBoundary key={activeTab}>
            {activeTab === "overview" && <OverviewTab studentId={studentId} />}
            {activeTab === "fees" && <FeesTab studentId={studentId} />}
            {activeTab === "academic" && <AcademicHistoryTab studentId={studentId} />}
            {activeTab === "grades" && <GradesTab studentId={studentId} />}
            {activeTab === "reports" && <ReportCardsTab studentId={studentId} />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
