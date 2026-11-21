import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The student page shows a role only what the Access Policy grants it, and —
 * the point of defect 1 — never subscribes to a query the server will refuse
 * (one refused query used to take the whole page to "Access denied").
 */

type Ref = Parameters<typeof getFunctionName>[0];
const data = new Map<string, unknown>();
const subscribed: string[] = [];
let studentId = "s1";

vi.mock("convex/react", () => ({
  useQuery: (ref: Ref, args?: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    subscribed.push(name);
    return data.get(name);
  },
  useMutation: () => vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ studentId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import StudentDetailPage from "./page";

function signInAs(me: { role: string; studentId?: string }) {
  data.set("users:getMe", {
    _id: "u1",
    name: "Test",
    email: "t@school.edu",
    isActive: true,
    ...me,
  });
  data.set("students:getStudentById", {
    _id: studentId,
    studentNumber: "S-1",
    studentFullName: "Rahim Uddin",
    status: "active",
    fatherName: "Karim",
    placement: null,
    standardLevelDoc: null,
    academicYearDoc: null,
    campusDoc: null,
  });
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);

afterEach(() => {
  data.clear();
  subscribed.length = 0;
  studentId = "s1";
});

describe("student page — what each role is shown and asks for", () => {
  it("opens for a teacher without the fees query, the Fees tab or admin actions", () => {
    signInAs({ role: "teacher" });
    render(<StudentDetailPage />);

    expect(screen.getByText("Rahim Uddin")).toBeInTheDocument();
    expect(subscribed).not.toContain("studentFees:getByStudent");
    expect(tabNames()).toEqual([
      "Grades",
      "Academic History",
      "Report Cards",
      "Attendance",
    ]);
    expect(screen.queryByText("Fees Due")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit student" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete student" }),
    ).not.toBeInTheDocument();
  });

  it("gives an admin fees and the edit and delete actions", () => {
    signInAs({ role: "admin" });
    render(<StudentDetailPage />);

    expect(subscribed).toContain("studentFees:getByStudent");
    expect(tabNames()).toEqual([
      "Fees",
      "Grades",
      "Academic History",
      "Report Cards",
      "Attendance",
    ]);
    expect(screen.getByText("Fees Due")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit student" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete student" }),
    ).toBeInTheDocument();
  });

  it("gives a student their own fees and grades, and no staff-only query", () => {
    signInAs({ role: "student", studentId: "s1" });
    render(<StudentDetailPage />);

    expect(tabNames()).toEqual(["Fees", "Grades"]);
    expect(subscribed).toContain("studentFees:getByStudent");
    for (const staffOnly of [
      "reportCards:getByStudent",
      "students:getSiblingsByStudent",
      "subjects:list",
      "attendance:getStudentAttendance",
    ]) {
      expect(subscribed).not.toContain(staffOnly);
    }
    expect(
      screen.queryByRole("button", { name: "Edit student" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("All Students")).not.toBeInTheDocument();
  });

  it("refuses a student another student's page without asking the server", () => {
    studentId = "s2";
    signInAs({ role: "student", studentId: "s1" });
    render(<StudentDetailPage />);

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(subscribed).not.toContain("students:getStudentById");
    expect(screen.queryByText("Rahim Uddin")).not.toBeInTheDocument();
  });
});
