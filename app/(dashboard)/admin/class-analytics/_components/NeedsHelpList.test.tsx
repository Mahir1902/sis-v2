import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { NeedsHelpRow, NeedsHelpStudent } from "@/lib/cohortView";
import { NeedsHelpList } from "./NeedsHelpList";

const stu = (s: string) => s as Id<"students">;
const sub = (s: string) => s as Id<"subjects">;

const grouped: NeedsHelpStudent[] = [
  {
    studentId: stu("s1"),
    studentName: "Hasan Mahmud",
    subjects: [
      {
        subjectId: sub("math"),
        subjectName: "Math",
        weightedAverage: 35,
        letterGrade: "F",
      },
      {
        subjectId: sub("eng"),
        subjectName: "English",
        weightedAverage: 42,
        letterGrade: "F",
      },
    ],
  },
  {
    studentId: stu("s2"),
    studentName: "Gulnaz",
    subjects: [
      {
        subjectId: sub("math"),
        subjectName: "Math",
        weightedAverage: 48,
        letterGrade: "F",
      },
    ],
  },
];

const flat: NeedsHelpRow[] = [
  {
    studentId: stu("s1"),
    studentName: "Hasan Mahmud",
    subjectId: sub("math"),
    subjectName: "Math",
    weightedAverage: 35,
    letterGrade: "F",
  },
  {
    studentId: stu("s2"),
    studentName: "Gulnaz",
    subjectId: sub("math"),
    subjectName: "Math",
    weightedAverage: 48,
    letterGrade: "F",
  },
];

describe("NeedsHelpList — grouped mode (no subject selected)", () => {
  it("lists each student once with their failing subjects nested", () => {
    render(<NeedsHelpList mode="grouped" students={grouped} />);

    // Each student name appears exactly once.
    expect(screen.getByText("Hasan Mahmud")).toBeInTheDocument();
    expect(screen.getByText("Gulnaz")).toBeInTheDocument();

    // Hasan's two failing subjects are both listed under him.
    const hasan = screen.getByText("Hasan Mahmud").closest("li");
    expect(hasan).not.toBeNull();
    if (hasan) {
      expect(within(hasan).getByText(/Math/)).toBeInTheDocument();
      expect(within(hasan).getByText(/English/)).toBeInTheDocument();
      expect(within(hasan).getByText("35.0%")).toBeInTheDocument();
      expect(within(hasan).getByText("42.0%")).toBeInTheDocument();
    }
  });
});

describe("NeedsHelpList — flat mode (subject selected)", () => {
  it("renders one row per student with the subject as a subtitle line", () => {
    render(<NeedsHelpList mode="flat" rows={flat} />);

    expect(screen.getByText("Hasan Mahmud")).toBeInTheDocument();
    expect(screen.getByText("Gulnaz")).toBeInTheDocument();
    expect(screen.getByText("35.0%")).toBeInTheDocument();
    expect(screen.getByText("48.0%")).toBeInTheDocument();
    // Subject shown as a subtitle for each row.
    expect(screen.getAllByText("Math").length).toBe(2);
  });
});
