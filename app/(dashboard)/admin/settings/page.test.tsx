import { fireEvent, render, screen, within } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GRANTABLE_CAPABILITIES } from "@/lib/accessPolicy";

/** Settings → Users: the Access column and the "Manage access" sheet. */

type Ref = Parameters<typeof getFunctionName>[0];
const data = new Map<string, unknown>();

vi.mock("convex/react", () => ({
  useQuery: (ref: Ref, args?: unknown) =>
    args === "skip" ? undefined : data.get(getFunctionName(ref)),
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import AdminSettingsPage from "./page";

// jsdom has no ResizeObserver; Radix Switch measures itself with one.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const user = (over: object) => ({
  isActive: true,
  studentId: undefined,
  linkedStudent: null,
  grants: [],
  ...over,
});

function signInAsAdmin() {
  data.set("users:getMe", {
    _id: "u1",
    name: "Farhana Islam",
    email: "farhana@school.edu",
    role: "admin",
    isActive: true,
  });
  data.set("invites:listInvites", []);
  data.set("students:getAllStudents", [
    {
      _id: "s1",
      studentFullName: "Rahim Uddin",
      studentNumber: "S-0142",
      standardLevelName: "Grade 5",
    },
  ]);
  data.set("users:listUsers", [
    user({
      _id: "u1",
      name: "Farhana Islam",
      email: "farhana@school.edu",
      role: "admin",
    }),
    user({
      _id: "u2",
      name: "Kamal Rahman",
      email: "kamal@school.edu",
      role: "teacher",
      // The stale name is not grantable, so it does not count.
      grants: ["promoteStudents", "viewAuditLog", "manageUsers"],
      isActive: false,
    }),
    user({
      _id: "u3",
      name: "Rahim Uddin",
      email: "rahim@school.edu",
      role: "student",
      studentId: "s1",
      linkedStudent: {
        studentFullName: "Rahim Uddin",
        studentNumber: "S-0142",
      },
    }),
    user({
      _id: "u4",
      name: "Nusrat Jahan",
      email: "nusrat@school.edu",
      role: "student",
    }),
  ]);
}

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
};
const manage = (name: string) =>
  fireEvent.click(
    screen.getByRole("button", { name: `Manage access for ${name}` }),
  );

afterEach(() => {
  data.clear();
  vi.clearAllMocks();
});

describe("Settings → Users", () => {
  it("summarises each account's access in the table", () => {
    signInAsAdmin();
    render(<AdminSettingsPage />);
    expect(rowOf("kamal@school.edu").getByText("+ 2 extra")).toBeVisible();
    expect(rowOf("kamal@school.edu").getByText("Inactive")).toBeVisible();
    expect(
      rowOf("rahim@school.edu").getByText("Rahim Uddin · S-0142"),
    ).toBeVisible();
    expect(
      rowOf("nusrat@school.edu").getByText("Needs a student"),
    ).toBeVisible();
    // The role is edited in the sheet, not in the row.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens a teacher's sheet on a switch per grantable feature", () => {
    signInAsAdmin();
    render(<AdminSettingsPage />);
    manage("Kamal Rahman");
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Access for Kamal Rahman")).toBeVisible();
    expect(sheet.getAllByRole("switch")).toHaveLength(
      GRANTABLE_CAPABILITIES.length,
    );
    expect(sheet.getByRole("switch", { name: "Promotions" })).toBeChecked();
    expect(sheet.getByRole("switch", { name: "Subjects" })).not.toBeChecked();
    // Deactivated: the grants are kept, and the sheet says so.
    expect(sheet.getByText(/deactivated/)).toBeVisible();
    // Nothing changed yet, so there is nothing to save.
    expect(sheet.getByRole("button", { name: "Save access" })).toBeDisabled();
    fireEvent.click(sheet.getByRole("switch", { name: "Subjects" }));
    expect(sheet.getByRole("button", { name: "Save access" })).toBeEnabled();
  });

  it("asks for a student on a student account that has none", () => {
    signInAsAdmin();
    render(<AdminSettingsPage />);
    manage("Nusrat Jahan");
    const sheet = within(screen.getByRole("dialog"));
    expect(
      sheet.getByRole("combobox", { name: "Linked student" }),
    ).toHaveTextContent("Select student…");
    expect(sheet.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("does not let an admin change their own role", () => {
    signInAsAdmin();
    render(<AdminSettingsPage />);
    manage("Farhana Islam");
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("combobox", { name: "Role" })).toBeDisabled();
    expect(sheet.getByText("You cannot change your own role.")).toBeVisible();
  });
});
