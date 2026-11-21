import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The roster page per role (issue #122): no dead Add Student button, and no roster for a student account. */

type Ref = Parameters<typeof getFunctionName>[0];
const data = new Map<string, unknown>();
const subscribed: string[] = [];
const replace = vi.fn();

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
  useRouter: () => ({ push: vi.fn(), replace }),
}));

import StudentsPage from "./page";

function signInAs(me: { role: string; studentId?: string }) {
  data.set("users:getMe", {
    _id: "u1",
    name: "Test",
    email: "t@school.edu",
    isActive: true,
    ...me,
  });
  data.set("students:getAllStudents", []);
}

afterEach(() => {
  data.clear();
  subscribed.length = 0;
  vi.clearAllMocks();
});

describe("students list", () => {
  it("offers Add Student to an admin", () => {
    signInAs({ role: "admin" });
    render(<StudentsPage />);
    expect(
      screen.getAllByRole("button", { name: /Add Student/ }).length,
    ).toBeGreaterThan(0);
  });

  it("shows a teacher the roster without Add Student", () => {
    signInAs({ role: "teacher" });
    render(<StudentsPage />);
    expect(screen.getByText("All Students")).toBeInTheDocument();
    expect(subscribed).toContain("students:getAllStudents");
    expect(
      screen.queryByRole("button", { name: /Add Student/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a student account to its own record instead of the roster", () => {
    signInAs({ role: "student", studentId: "s1" });
    render(<StudentsPage />);
    expect(replace).toHaveBeenCalledWith("/students/s1");
    expect(subscribed).not.toContain("students:getAllStudents");
    expect(screen.queryByText("All Students")).not.toBeInTheDocument();
  });

  it("tells a student account with no linked record so, without asking for the roster", () => {
    signInAs({ role: "student" });
    render(<StudentsPage />);
    expect(screen.getByText("No student record linked")).toBeInTheDocument();
    expect(subscribed).not.toContain("students:getAllStudents");
    expect(replace).not.toHaveBeenCalled();
  });
});
