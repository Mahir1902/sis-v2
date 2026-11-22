import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const mutate = vi.fn(async (_args: unknown) => undefined);

vi.mock("convex/react", () => ({
  useQuery: (ref: Ref, args?: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    subscribed.push(name);
    return data.get(name);
  },
  useMutation: () => mutate,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ studentId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import StudentDetailPage from "./page";

// jsdom has neither; the sibling search list (cmdk) needs both.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollIntoView = () => {};

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
  mutate.mockClear();
  toastSuccess.mockClear();
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

  it("asks the server for nothing but the account while the role is unknown", () => {
    // getMe still loading: no role-dependent query may fire yet.
    render(<StudentDetailPage />);
    expect([...new Set(subscribed)]).toEqual(["users:getMe"]);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
  });

  it("lets a student open their Grades tab without a staff-only query", () => {
    signInAs({ role: "student", studentId: "s1" });
    data.set("enrollments:getEnrollmentHistory", []);
    data.set("enrollments:getCurrentEnrollment", null);
    render(<StudentDetailPage />);

    const grades = screen.getByRole("tab", { name: "Grades" });
    // Radix Tabs activates on mouse down / focus rather than click.
    fireEvent.mouseDown(grades, { button: 0 });
    fireEvent.focus(grades);

    expect(grades).toHaveAttribute("aria-selected", "true");
    const allowed = new Set([
      "users:getMe",
      "students:getStudentById",
      "enrollments:getCurrentEnrollment",
      "enrollments:getEnrollmentHistory",
      "studentFees:getByStudent",
      "computedGrades:getComputedGradesByStudent",
      "computedGrades:getGradesByEnrollmentSemester",
    ]);
    expect(subscribed.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it("tells a deactivated account so instead of showing the student", () => {
    signInAs({ role: "admin" });
    data.set("users:getMe", {
      ...(data.get("users:getMe") as object),
      isActive: false,
    });
    render(<StudentDetailPage />);
    expect(screen.getByText("Account Deactivated")).toBeInTheDocument();
    expect(subscribed).not.toContain("students:getStudentById");
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

describe("student page — sibling links (#89)", () => {
  const zara = {
    _id: "s2",
    studentNumber: "S-2",
    studentFullName: "Zara Uddin",
    standardLevelName: "Grade 6",
  };
  const openSiblings = () =>
    fireEvent.click(screen.getByRole("button", { name: /Siblings/ }));

  it("lets an admin unlink a sibling, sending the list without them", async () => {
    signInAs({ role: "admin" });
    data.set("students:getSiblingsByStudent", [zara]);
    const { rerender } = render(<StudentDetailPage />);
    openSiblings();

    fireEvent.click(screen.getByRole("button", { name: "Unlink Zara Uddin" }));

    expect(mutate).toHaveBeenCalledWith({ studentId: "s1", siblingIds: [] });
    // The roster is only fetched once the search is opened.
    expect(subscribed).not.toContain("students:getAllStudents");

    // Undo on the toast links them again, onto the list as it now stands.
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toBe("Unlinked Zara Uddin");
    data.set("students:getSiblingsByStudent", []);
    rerender(<StudentDetailPage />);
    toastSuccess.mock.calls[0][1].action.onClick();
    expect(mutate).toHaveBeenLastCalledWith({
      studentId: "s1",
      siblingIds: ["s2"],
    });
  });

  it("lets an admin link a student, offering neither this student nor one already linked", () => {
    signInAs({ role: "admin" });
    data.set("students:getSiblingsByStudent", [zara]);
    data.set("students:getAllStudents", [
      { _id: "s1", studentNumber: "S-1", studentFullName: "Rahim Uddin" },
      zara,
      // Imported student: no name, shown by student number (#93).
      { _id: "s3", studentNumber: "S-3", standardLevelName: null },
    ]);
    render(<StudentDetailPage />);
    openSiblings();
    fireEvent.click(screen.getByRole("button", { name: "Link sibling" }));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("S-3");
    fireEvent.click(options[0]);

    expect(mutate).toHaveBeenCalledWith({
      studentId: "s1",
      siblingIds: ["s2", "s3"],
    });
  });

  it("gives an admin somewhere to link from when there are no siblings", () => {
    signInAs({ role: "admin" });
    data.set("students:getSiblingsByStudent", []);
    render(<StudentDetailPage />);
    openSiblings();

    expect(screen.getByText("No siblings linked yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Link sibling" }),
    ).toBeInTheDocument();
  });

  it("shows a teacher the siblings without link or unlink controls", () => {
    signInAs({ role: "teacher" });
    data.set("students:getSiblingsByStudent", [zara]);
    render(<StudentDetailPage />);
    openSiblings();

    expect(screen.getByText("Zara Uddin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlink Zara Uddin" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Link sibling" }),
    ).not.toBeInTheDocument();
  });

  it("hides the empty siblings card from a teacher", () => {
    signInAs({ role: "teacher" });
    data.set("students:getSiblingsByStudent", []);
    render(<StudentDetailPage />);

    expect(
      screen.queryByRole("button", { name: /Siblings/ }),
    ).not.toBeInTheDocument();
  });
});
