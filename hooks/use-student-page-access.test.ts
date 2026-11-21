import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";

const getMe = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => getMe(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import { useStudentPageAccess } from "./use-student-page-access";

const S1 = "s1" as Id<"students">;
const signInAs = (me: object) =>
  getMe.mockReturnValue({
    _id: "u1",
    name: "Test",
    email: "t@school.edu",
    isActive: true,
    ...me,
  });
const access = (studentId = S1) =>
  renderHook(() => useStudentPageAccess(studentId));

afterEach(() => vi.clearAllMocks());

describe("useStudentPageAccess — what a role gets on a student's page", () => {
  it("gives an admin every tab, opening on Fees", () => {
    signInAs({ role: "admin" });
    const { result } = access();
    expect(result.current.mayView).toBe(true);
    expect(result.current.tabs).toEqual([
      "fees",
      "grades",
      "academic",
      "reports",
      "attendance",
    ]);
    expect(result.current.activeTab).toBe("fees");
    expect(result.current.canListStudents).toBe(true);
  });

  it("gives a teacher everything but Fees, opening on Grades", () => {
    signInAs({ role: "teacher" });
    const { result } = access();
    expect(result.current.tabs).toEqual([
      "grades",
      "academic",
      "reports",
      "attendance",
    ]);
    expect(result.current.access.fees).toBe(false);
    expect(result.current.activeTab).toBe("grades");
  });

  it("gives a student their own Fees and Grades only", () => {
    signInAs({ role: "student", studentId: "s1" });
    const { result } = access();
    expect(result.current.mayView).toBe(true);
    expect(result.current.tabs).toEqual(["fees", "grades"]);
    expect(result.current.canListStudents).toBe(false);
  });

  it("gives a student nothing on another student's page", () => {
    signInAs({ role: "student", studentId: "s1" });
    const { result } = access("s2" as Id<"students">);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mayView).toBe(false);
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBeUndefined();
  });

  it("grants nothing while the account is still loading", () => {
    getMe.mockReturnValue(undefined);
    const { result } = access();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.mayView).toBe(false);
    expect(result.current.tabs).toEqual([]);
  });

  it("opens the tab that was chosen", () => {
    signInAs({ role: "teacher" });
    const { result } = access();
    act(() => result.current.setActiveTab("attendance"));
    expect(result.current.activeTab).toBe("attendance");
  });

  it("falls back to the first tab when the chosen one is no longer granted", () => {
    signInAs({ role: "admin" });
    const { result, rerender } = access();
    act(() => result.current.setActiveTab("fees"));
    // The account becomes a teacher while the page is open.
    signInAs({ role: "teacher" });
    rerender();
    expect(result.current.activeTab).toBe("grades");
  });
});
