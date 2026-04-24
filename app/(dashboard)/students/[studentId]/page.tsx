"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { AcademicHistoryTab } from "./_components/AcademicHistoryTab";
import { FeesTab } from "./_components/FeesTab";
import { GradesTab } from "./_components/GradesTab";
import { ReportCardsTab } from "./_components/ReportCardsTab";
import { StudentHeader } from "./_components/StudentHeader";
import { StudentInfoSidebar } from "./_components/StudentInfoSidebar";

type Tab = "fees" | "academic" | "grades" | "reports";

const tabs: { id: Tab; label: string }[] = [
  { id: "fees", label: "Fees" },
  { id: "grades", label: "Grades" },
  { id: "academic", label: "Academic History" },
  { id: "reports", label: "Report Cards" },
];

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as Id<"students">;
  const [activeTab, setActiveTab] = useState<Tab>("fees");

  const student = useQuery(api.students.getStudentById, { studentId });
  const currentEnrollment = useQuery(api.enrollments.getCurrentEnrollment, {
    studentId,
  });
  const fees = useQuery(api.studentFees.getByStudent, { studentId });
  const reportCards = useQuery(api.reportCards.getByStudent, { studentId });

  // Badge counts
  const unpaidCount = fees?.filter((f) => f.status !== "paid").length ?? 0;
  const reportCardCount = reportCards?.length ?? 0;

  if (student === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-[310px_1fr] gap-4">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg mt-3" />
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Student not found.</p>
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="mt-4 text-school-green text-sm hover:underline"
        >
          Back to students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/students")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        aria-label="Back to students list"
      >
        <ArrowLeft className="h-4 w-4" />
        All Students
      </button>

      {/* Header */}
      <StudentHeader
        studentId={studentId}
        student={student}
        currentEnrollment={currentEnrollment}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[310px_1fr] gap-4">
        {/* Left: Info sidebar */}
        <aside className="bg-slate-50/50 border rounded-lg overflow-y-auto md:max-h-[calc(100vh-220px)]">
          <StudentInfoSidebar studentId={studentId} />
        </aside>

        {/* Right: Tabbed content */}
        <div className="flex flex-col min-w-0">
          {/* Tab navigation */}
          <div
            className="flex border-b bg-white rounded-t-lg overflow-x-auto"
            role="tablist"
            aria-label="Student detail tabs"
          >
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={activeTab === tab.id}
                className={cn(
                  "px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none relative",
                  activeTab === tab.id
                    ? "border-b-2 border-school-green text-school-green"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.id === "fees" && unpaidCount > 0 && (
                  <span className="ml-1.5 bg-red-50 text-red-600 rounded-full px-1.5 text-[9px] font-medium">
                    {unpaidCount}
                  </span>
                )}
                {tab.id === "reports" && reportCardCount > 0 && (
                  <span className="ml-1.5 text-muted-foreground text-[9px]">
                    {reportCardCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white border border-t-0 rounded-b-lg p-4 md:p-5 overflow-y-auto md:max-h-[calc(100vh-268px)]">
            <ErrorBoundary key={activeTab}>
              {activeTab === "fees" && <FeesTab studentId={studentId} />}
              {activeTab === "grades" && <GradesTab studentId={studentId} />}
              {activeTab === "academic" && (
                <AcademicHistoryTab studentId={studentId} />
              )}
              {activeTab === "reports" && (
                <ReportCardsTab studentId={studentId} />
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
