"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AccessDenied } from "@/components/shared/RoleGate";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AcademicHistoryTab } from "./_components/AcademicHistoryTab";
import { AttendanceTab } from "./_components/AttendanceTab";
import { FeesTab } from "./_components/FeesTab";
import { GradesTab } from "./_components/GradesTab";
import { ReportCardsTab } from "./_components/ReportCardsTab";
import { StudentHeader } from "./_components/StudentHeader";
import { StudentInfoSidebar } from "./_components/StudentInfoSidebar";

type Tab = "fees" | "academic" | "grades" | "reports" | "attendance";

const tabLabels: Record<Tab, string> = {
  fees: "Fees",
  grades: "Grades",
  academic: "Academic History",
  reports: "Report Cards",
  attendance: "Attendance",
};

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as Id<"students">;
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const { isLoading, can, canOnStudent } = useCapabilities();

  // A role is shown — and subscribes to — only what the Access Policy grants
  // it. One refused query would take the whole page to "Access denied".
  const mayView = canOnStudent("viewStudent", studentId);
  const access: Record<Tab, boolean> = {
    fees: canOnStudent("viewStudentFees", studentId),
    grades: canOnStudent("viewStudentGrades", studentId),
    academic: mayView && can("viewClasses"),
    reports: mayView && can("viewReportCards"),
    attendance: mayView && can("viewAttendance"),
  };
  const tabs = (Object.keys(tabLabels) as Tab[]).filter((id) => access[id]);
  const activeTab = chosenTab && access[chosenTab] ? chosenTab : tabs[0];
  const canListStudents = can("listStudents");

  const student = useQuery(
    api.students.getStudentById,
    mayView ? { studentId } : "skip",
  );
  const currentEnrollment = useQuery(
    api.enrollments.getCurrentEnrollment,
    mayView ? { studentId } : "skip",
  );
  const fees = useQuery(
    api.studentFees.getByStudent,
    access.fees ? { studentId } : "skip",
  );
  const reportCards = useQuery(
    api.reportCards.getByStudent,
    access.reports ? { studentId } : "skip",
  );

  // Badge counts
  const unpaidCount = fees?.filter((f) => f.status !== "paid").length ?? 0;
  const reportCardCount = reportCards?.length ?? 0;

  if (!isLoading && !mayView) return <AccessDenied />;

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
        {canListStudents && (
          <button
            type="button"
            onClick={() => router.push("/students")}
            className="mt-4 text-school-green text-sm hover:underline"
          >
            Back to students
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button — only for a role that can open the roster */}
      {canListStudents && (
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          aria-label="Back to students list"
        >
          <ArrowLeft className="h-4 w-4" />
          All Students
        </button>
      )}

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
          <Tabs
            value={activeTab}
            onValueChange={(tab) => setChosenTab(tab as Tab)}
            className="gap-0"
          >
            <TabsList
              variant="line"
              aria-label="Student detail tabs"
              className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-t-lg border-b bg-white p-0"
            >
              {tabs.map((id) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex-none rounded-none px-4 py-3 text-xs text-muted-foreground after:bg-school-green group-data-[orientation=horizontal]/tabs:after:bottom-0 data-[state=active]:text-school-green"
                >
                  {tabLabels[id]}
                  {id === "fees" && unpaidCount > 0 && (
                    <span className="bg-red-50 text-red-600 rounded-full px-1.5 text-[9px] font-medium">
                      {unpaidCount}
                    </span>
                  )}
                  {id === "reports" && reportCardCount > 0 && (
                    <span className="text-muted-foreground text-[9px]">
                      {reportCardCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab content */}
            <TabsContent
              value={activeTab}
              className="bg-white border border-t-0 rounded-b-lg p-4 md:p-5 overflow-y-auto md:max-h-[calc(100vh-268px)]"
            >
              <ErrorBoundary key={activeTab}>
                {activeTab === "fees" && <FeesTab studentId={studentId} />}
                {activeTab === "grades" && <GradesTab studentId={studentId} />}
                {activeTab === "academic" && (
                  <AcademicHistoryTab studentId={studentId} />
                )}
                {activeTab === "reports" && (
                  <ReportCardsTab studentId={studentId} />
                )}
                {activeTab === "attendance" && (
                  <AttendanceTab studentId={studentId} />
                )}
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
