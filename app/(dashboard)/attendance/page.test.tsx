import { fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive every useQuery by function name so the page renders against mocked
// data with no backend (the register's seven states, spec §5.3).
const queries = new Map<string, unknown>();
const saveRegister = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    queries.get(getFunctionName(ref)),
  useMutation: () => saveRegister,
}));

import AttendanceRegisterPage from "./page";

const students = [
  { studentId: "s1", studentName: "Mina", studentNumber: "S1", status: null },
  { studentId: "s2", studentName: "Rafi", studentNumber: "S2", status: null },
  { studentId: "s3", studentName: "Lina", studentNumber: "S3", status: null },
];

const register = (over: Record<string, unknown> = {}) => ({
  date: "2026-10-15",
  canWrite: true,
  lockReason: null,
  closure: null,
  markedAt: null,
  markedBy: null,
  students,
  ...over,
});

beforeEach(() => {
  queries.clear();
  queries.set("campus:list", [{ _id: "c1", name: "Campus A" }]);
  queries.set("standardLevels:list", [{ _id: "l1", name: "Grade 4" }]);
  queries.set("academicYears:list", [
    { _id: "y1", name: "2026", startDate: 0, endDate: 1e15 },
  ]);
  localStorage.setItem(
    "attendance.lastClass",
    JSON.stringify({ campus: "c1", standardLevelId: "l1", academicYear: "y1" }),
  );
  saveRegister.mockResolvedValue({ created: 3, updated: 0, unchanged: 0 });
});
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("/attendance register", () => {
  it("asks to choose a class when nothing is remembered", () => {
    localStorage.clear();
    render(<AttendanceRegisterPage />);
    expect(screen.getByText("Choose a class")).toBeInTheDocument();
  });

  it("fresh day: everyone present, one tap on a segment sets the row and the button carries the tally", () => {
    queries.set("attendance:getRegister", register());
    render(<AttendanceRegisterPage />);
    expect(
      screen.getByRole("button", { name: "Confirm all 3 present" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing tapped yet/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Rafi: present" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Mark Rafi present" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Mark Rafi absent" }));
    expect(
      screen.getByRole("radio", { name: "Mark Rafi absent" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", {
        name: "Save — 2 present · 0 late · 1 absent",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Marked exceptions" }),
    ).toHaveTextContent("Rafi");

    // Straight from absent to late — no cycling through present.
    fireEvent.click(screen.getByRole("radio", { name: "Mark Rafi late" }));
    expect(
      screen.getByRole("button", {
        name: "Save — 2 present · 1 late · 0 absent",
      }),
    ).toBeInTheDocument();

    // Tapping the selected segment again keeps it selected.
    fireEvent.click(screen.getByRole("radio", { name: "Mark Rafi late" }));
    expect(
      screen.getByRole("radio", { name: "Mark Rafi late" }),
    ).toHaveAttribute("aria-checked", "true");

    // Removing the chip returns the row to present.
    fireEvent.click(screen.getByRole("button", { name: /Rafi late — tap/ }));
    expect(
      screen.getByRole("button", { name: "Confirm all 3 present" }),
    ).toBeInTheDocument();
  });

  it("saves one mark per student on the roster", async () => {
    queries.set("attendance:getRegister", register());
    render(<AttendanceRegisterPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Mark Mina absent" }));
    fireEvent.click(screen.getByRole("button", { name: /^Save — 2 present/ }));
    await vi.waitFor(() => expect(saveRegister).toHaveBeenCalledTimes(1));
    expect(saveRegister.mock.calls[0][0]).toMatchObject({
      campus: "c1",
      standardLevelId: "l1",
      academicYear: "y1",
      marks: [
        { studentId: "s1", status: "absent" },
        { studentId: "s2", status: "present" },
        { studentId: "s3", status: "present" },
      ],
    });
  });

  it("already-marked day: prefilled, names the last marker, offers Update register", () => {
    queries.set(
      "attendance:getRegister",
      register({
        markedAt: Date.UTC(2026, 9, 15, 2, 12),
        markedBy: { name: "A. Rahman" },
        students: students.map((s, i) => ({
          ...s,
          status: i === 0 ? "absent" : "present",
        })),
      }),
    );
    render(<AttendanceRegisterPage />);
    expect(
      screen.getByText("Marked at 08:12 by A. Rahman. Saving replaces it."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update register" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("list", { name: "Marked exceptions" }),
    ).toHaveTextContent("Mina");
  });

  it("closed day: red banner names the reason and saving is blocked", () => {
    queries.set(
      "attendance:getRegister",
      register({
        canWrite: false,
        lockReason: "closed",
        closure: { reason: "Eid-ul-Fitr" },
      }),
    );
    render(<AttendanceRegisterPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Eid-ul-Fitr");
    expect(
      screen.getByRole("button", { name: "Confirm all 3 present" }),
    ).toBeDisabled();
    for (const s of ["present", "late", "absent"]) {
      expect(
        screen.getByRole("radio", { name: `Mark Rafi ${s}` }),
      ).toBeDisabled();
    }
  });

  it("outside the window: amber banner names the office, register stays readable", () => {
    queries.set(
      "attendance:getRegister",
      register({ canWrite: false, lockReason: "outside_window" }),
    );
    render(<AttendanceRegisterPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/ask the office/i);
    expect(screen.getByText("Rafi")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Mark Rafi present" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: "Mark Rafi absent" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Confirm all 3 present" }),
    ).toBeDisabled();
  });

  it("empty roster", () => {
    queries.set("attendance:getRegister", register({ students: [] }));
    render(<AttendanceRegisterPage />);
    expect(screen.getByText("No students in this class")).toBeInTheDocument();
  });
});
