import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/students",
}));

import { Sidebar } from "./Sidebar";

const links = () => screen.getAllByRole("link").map((a) => a.textContent);

describe("Sidebar — an account is offered the screens it can open", () => {
  it("shows a teacher the teacher screens only", () => {
    render(<Sidebar caller={{ role: "teacher" }} />);
    expect(links()).toEqual(["Students", "Attendance"]);
  });

  it("adds the features granted to that teacher, and nothing else", () => {
    render(
      <Sidebar
        caller={{
          role: "teacher",
          grants: ["viewAuditLog", "promoteStudents"],
        }}
      />,
    );
    expect(links()).toEqual([
      "Students",
      "Attendance",
      "Promotions",
      "Audit Log",
    ]);
  });

  it("shows an admin every screen", () => {
    render(<Sidebar caller={{ role: "admin" }} />);
    expect(links()).toHaveLength(15);
    expect(links()).toContain("Settings");
  });

  it("gives a student account its own record and no roster", () => {
    render(<Sidebar caller={{ role: "student", studentId: "s1" }} />);
    expect(links()).toEqual(["My Record"]);
    expect(screen.getByRole("link", { name: "My Record" })).toHaveAttribute(
      "href",
      "/students/s1",
    );
  });

  it("offers nothing before the account is known", () => {
    render(<Sidebar />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
