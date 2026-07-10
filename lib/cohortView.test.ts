import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildGradeSpreadSeries,
  CURRENT_STANDING_SUBTITLE,
  CURRENT_STANDING_TITLE,
  cohortState,
  gradeCountLabel,
  groupNeedsHelpByStudent,
  type NeedsHelpRow,
} from "./cohortView";

/** Tiny cast helpers so fixtures can use readable string ids. */
const stu = (s: string) => s as Id<"students">;
const sub = (s: string) => s as Id<"subjects">;

describe("buildGradeSpreadSeries", () => {
  it("returns the six buckets in fixed A+…F order with their counts", () => {
    const spread = { "A+": 2, A: 3, B: 3, C: 4, D: 3, F: 2 };
    expect(buildGradeSpreadSeries(spread)).toEqual([
      { grade: "A+", count: 2 },
      { grade: "A", count: 3 },
      { grade: "B", count: 3 },
      { grade: "C", count: 4 },
      { grade: "D", count: 3 },
      { grade: "F", count: 2 },
    ]);
  });
});

describe("gradeCountLabel", () => {
  it("pluralises a multi-grade total", () => {
    expect(gradeCountLabel(17)).toBe("17 grades");
  });

  it("uses the singular noun for exactly one grade", () => {
    expect(gradeCountLabel(1)).toBe("1 grade");
  });

  it("still pluralises a zero total", () => {
    expect(gradeCountLabel(0)).toBe("0 grades");
  });
});

describe("cohortState", () => {
  it("(a) no grades at all, no subject selected → empty", () => {
    expect(
      cohortState({ total: 0, needsHelpCount: 0, subjectSelected: false }),
    ).toEqual({ kind: "empty" });
  });

  it("(c) subject selected but that subject has no grades → empty_subject", () => {
    expect(
      cohortState({ total: 0, needsHelpCount: 0, subjectSelected: true }),
    ).toEqual({ kind: "empty_subject" });
  });

  it("(b) grades exist but none below 50%, no subject → all_passing (good news)", () => {
    expect(
      cohortState({ total: 17, needsHelpCount: 0, subjectSelected: false }),
    ).toEqual({ kind: "all_passing" });
  });

  it("(d) subject selected, grades exist but none below 50% → all_passing_subject", () => {
    expect(
      cohortState({ total: 8, needsHelpCount: 0, subjectSelected: true }),
    ).toEqual({ kind: "all_passing_subject" });
  });

  it("some students below 50% → has_at_risk (whole class)", () => {
    expect(
      cohortState({ total: 17, needsHelpCount: 2, subjectSelected: false }),
    ).toEqual({ kind: "has_at_risk" });
  });

  it("some students below 50% with a subject selected → has_at_risk", () => {
    expect(
      cohortState({ total: 8, needsHelpCount: 3, subjectSelected: true }),
    ).toEqual({ kind: "has_at_risk" });
  });
});

describe("groupNeedsHelpByStudent", () => {
  const row = (
    studentId: string,
    studentName: string,
    subjectId: string,
    subjectName: string,
    weightedAverage: number,
    letterGrade: string,
  ): NeedsHelpRow => ({
    studentId: stu(studentId),
    studentName,
    subjectId: sub(subjectId),
    subjectName,
    weightedAverage,
    letterGrade,
  });

  it("returns an empty array for no rows", () => {
    expect(groupNeedsHelpByStudent([])).toEqual([]);
  });

  it("groups each student once with their failing subjects nested", () => {
    const rows: NeedsHelpRow[] = [
      row("s1", "Hasan Mahmud", "math", "Math", 35, "F"),
      row("s1", "Hasan Mahmud", "eng", "English", 42, "F"),
      row("s2", "Gulnaz", "math", "Math", 48, "F"),
    ];
    expect(groupNeedsHelpByStudent(rows)).toEqual([
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
    ]);
  });

  it("orders each student's subjects worst (lowest) grade first", () => {
    const rows: NeedsHelpRow[] = [
      row("s1", "Ada", "eng", "English", 45, "F"),
      row("s1", "Ada", "math", "Math", 30, "F"),
    ];
    const grouped = groupNeedsHelpByStudent(rows);
    expect(grouped[0].subjects.map((s) => s.subjectName)).toEqual([
      "Math",
      "English",
    ]);
  });

  it("orders students by their worst subject grade, lowest first", () => {
    // s2's worst (20) is below s1's worst (35), so s2 must come first even
    // though s1 appears first in the input.
    const rows: NeedsHelpRow[] = [
      row("s1", "One", "math", "Math", 35, "F"),
      row("s2", "Two", "sci", "Science", 20, "F"),
    ];
    const grouped = groupNeedsHelpByStudent(rows);
    expect(grouped.map((g) => g.studentName)).toEqual(["Two", "One"]);
  });
});

describe("Current Standing copy constants", () => {
  it("titles the grade-spread chart 'Current Standing' (never 'Results')", () => {
    expect(CURRENT_STANDING_TITLE).toBe("Current Standing");
    expect(CURRENT_STANDING_TITLE).not.toMatch(/results/i);
  });

  it("exports the exact in-progress subtitle", () => {
    expect(CURRENT_STANDING_SUBTITLE).toBe(
      "Includes grades in progress — not final results.",
    );
  });
});
