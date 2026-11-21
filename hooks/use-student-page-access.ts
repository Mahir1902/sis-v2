"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useCapabilities } from "./use-capabilities";

export type StudentTab =
  | "fees"
  | "grades"
  | "academic"
  | "reports"
  | "attendance";

/** Display order of the student page's tabs. */
const TAB_ORDER: StudentTab[] = [
  "fees",
  "grades",
  "academic",
  "reports",
  "attendance",
];

/**
 * What the signed-in account gets on one student's page: whether it may open
 * the page at all, which tabs it is shown, and which is open.
 *
 * `access[tab]` is also the answer to "may I subscribe to this tab's
 * queries?" — a role is shown, and asks the server for, only what the Access
 * Policy grants it. One refused query would take the whole page to
 * "Access denied".
 */
export function useStudentPageAccess(studentId: Id<"students">) {
  const { isLoading, can, canOnStudent } = useCapabilities();
  const [chosenTab, setChosenTab] = useState<StudentTab | null>(null);

  const mayView = canOnStudent("viewStudent", studentId);
  const access: Record<StudentTab, boolean> = {
    fees: canOnStudent("viewStudentFees", studentId),
    grades: canOnStudent("viewStudentGrades", studentId),
    // The staff-only tabs still need the student to be visible.
    academic: mayView && can("viewClasses"),
    reports: mayView && can("viewReportCards"),
    attendance: mayView && can("viewAttendance"),
  };
  const tabs = TAB_ORDER.filter((tab) => access[tab]);
  // A chosen tab the account no longer has falls back to the first one.
  const activeTab: StudentTab | undefined =
    chosenTab && access[chosenTab] ? chosenTab : tabs[0];

  return {
    /** True until the account is known — show the skeleton, ask for nothing. */
    isLoading,
    mayView,
    /** May the account open the roster (the "All Students" back link)? */
    canListStudents: can("listStudents"),
    access,
    tabs,
    activeTab,
    setActiveTab: setChosenTab,
  };
}
