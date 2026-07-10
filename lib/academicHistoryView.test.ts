import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildPerCaChartData,
  buildSubjectRowSeeds,
  formatDelta,
  ordinal,
  overallPositionCopy,
  provisionalLabel,
} from "./academicHistoryView";

/** Tiny cast helper so test fixtures can use readable string ids. */
const sid = (s: string) => s as Id<"subjects">;

describe("ordinal", () => {
  it("returns '1st' for 1", () => {
    expect(ordinal(1)).toBe("1st");
  });

  it("uses st/nd/rd for 1/2/3 and th for 4", () => {
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
  });

  it("uses 'th' for the 11/12/13 teens exception", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("uses st/nd/rd for 21/22/23", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });

  it("uses 'th' for 111 (teens exception carries past 100)", () => {
    expect(ordinal(111)).toBe("111th");
  });
});

describe("overallPositionCopy", () => {
  it("builds a ranked headline with no detail for a 1st-of-6 position", () => {
    expect(overallPositionCopy({ rank: 1, outOf: 6 }, null)).toEqual({
      headline: "Stood 1st of 6 in class",
      detail: null,
    });
  });

  it("builds a ranked headline for a 4th-of-23 position", () => {
    expect(overallPositionCopy({ rank: 4, outOf: 23 }, null)).toEqual({
      headline: "Stood 4th of 23 in class",
      detail: null,
    });
  });

  it("explains the provisional-suppressed pending state", () => {
    expect(overallPositionCopy(null, "provisional")).toEqual({
      headline: "Class position pending",
      detail: "Class position posts when all subjects are final",
    });
  });

  it("explains the insufficient-peers pending state", () => {
    expect(overallPositionCopy(null, "insufficient_peers")).toEqual({
      headline: "Class position pending",
      detail: "Needs 5 or more fully-graded classmates",
    });
  });

  it("uses the not-yet-graded headline when the term is ungraded", () => {
    expect(overallPositionCopy(null, "not_graded")).toEqual({
      headline: "Not yet graded this term",
      detail: null,
    });
  });

  it("defensively falls back to pending with no detail when reason is null", () => {
    expect(overallPositionCopy(null, null)).toEqual({
      headline: "Class position pending",
      detail: null,
    });
  });
});

describe("formatDelta", () => {
  it("formats a positive delta with a leading + and up direction", () => {
    expect(formatDelta(4.23)).toEqual({ text: "+4.2", direction: "up" });
  });

  it("formats a negative delta with its own sign and down direction", () => {
    expect(formatDelta(-3)).toEqual({ text: "-3.0", direction: "down" });
  });

  it("treats an exact zero as flat with an unsigned 0.0", () => {
    expect(formatDelta(0)).toEqual({ text: "0.0", direction: "flat" });
  });

  it("treats a positive value that rounds to zero as flat", () => {
    expect(formatDelta(0.04)).toEqual({ text: "0.0", direction: "flat" });
  });

  it("treats a negative value that rounds to zero as flat with no minus", () => {
    expect(formatDelta(-0.04)).toEqual({ text: "0.0", direction: "flat" });
  });

  it("passes null through as null (no delta available)", () => {
    expect(formatDelta(null)).toBeNull();
  });
});

describe("provisionalLabel", () => {
  it("labels 1 of 3 CAs with the plural noun", () => {
    expect(provisionalLabel(1, 3)).toBe("Based on 1 of 3 CAs");
  });

  it("labels 2 of 3 CAs with the plural noun", () => {
    expect(provisionalLabel(2, 3)).toBe("Based on 2 of 3 CAs");
  });

  it("uses the singular noun when exactly 1 CA is expected", () => {
    expect(provisionalLabel(1, 1)).toBe("Based on 1 of 1 CA");
  });
});

describe("buildPerCaChartData", () => {
  it("returns three ordered points with student + class means when all data is present", () => {
    const baseline = {
      ca1: { mean: 70, n: 6 },
      ca2: { mean: 65, n: 6 },
      ca3: { mean: 80, n: 6 },
    };
    const student = {
      ca1Percentage: 75,
      ca2Percentage: 60,
      ca3Percentage: 90,
    };
    expect(buildPerCaChartData(baseline, student)).toEqual([
      { ca: "CA-1", you: 75, classMean: 70 },
      { ca: "CA-2", you: 60, classMean: 65 },
      { ca: "CA-3", you: 90, classMean: 80 },
    ]);
  });

  it("preserves nulls as line gaps when the student and baseline are partial", () => {
    const baseline = {
      ca1: { mean: 70, n: 6 },
      ca2: { mean: 65, n: 6 },
      ca3: null,
    };
    const student = { ca1Percentage: 75 };
    expect(buildPerCaChartData(baseline, student)).toEqual([
      { ca: "CA-1", you: 75, classMean: 70 },
      { ca: "CA-2", you: null, classMean: 65 },
      { ca: "CA-3", you: null, classMean: null },
    ]);
  });

  it("returns three all-null points when nothing is graded", () => {
    const baseline = { ca1: null, ca2: null, ca3: null };
    const student = {};
    expect(buildPerCaChartData(baseline, student)).toEqual([
      { ca: "CA-1", you: null, classMean: null },
      { ca: "CA-2", you: null, classMean: null },
      { ca: "CA-3", you: null, classMean: null },
    ]);
  });
});

describe("buildSubjectRowSeeds", () => {
  it("counts all three CAs present and takes expectedCaCount from the grade row", () => {
    const bySubject = [
      {
        subjectId: sid("math"),
        subjectName: "Math",
        weightedAverage: 82,
        provisional: false,
        position: { rank: 2, outOf: 8 },
      },
    ];
    const gradeRows = [
      {
        subjectId: sid("math"),
        expectedCaCount: 3,
        ca1Percentage: 80,
        ca2Percentage: 84,
        ca3Percentage: 82,
      },
    ];
    expect(buildSubjectRowSeeds(bySubject, gradeRows)).toEqual([
      {
        subjectId: sid("math"),
        subjectName: "Math",
        weightedAverage: 82,
        provisional: false,
        position: { rank: 2, outOf: 8 },
        presentCaCount: 3,
        expectedCaCount: 3,
      },
    ]);
  });

  it("counts only the present CAs while keeping the expected count from the row", () => {
    const bySubject = [
      {
        subjectId: sid("eng"),
        subjectName: "English",
        weightedAverage: 70,
        provisional: true,
        position: null,
      },
    ];
    const gradeRows = [
      {
        subjectId: sid("eng"),
        expectedCaCount: 3,
        ca1Percentage: 70,
        ca2Percentage: null,
        ca3Percentage: null,
      },
    ];
    expect(buildSubjectRowSeeds(bySubject, gradeRows)).toEqual([
      {
        subjectId: sid("eng"),
        subjectName: "English",
        weightedAverage: 70,
        provisional: true,
        position: null,
        presentCaCount: 1,
        expectedCaCount: 3,
      },
    ]);
  });

  it("falls back to present=0/expected=0 for a bySubject entry with no matching grade row", () => {
    const bySubject = [
      {
        subjectId: sid("sci"),
        subjectName: "Science",
        weightedAverage: 65,
        provisional: true,
        position: null,
      },
    ];
    const gradeRows = [
      {
        subjectId: sid("math"),
        expectedCaCount: 3,
        ca1Percentage: 80,
      },
    ];
    expect(buildSubjectRowSeeds(bySubject, gradeRows)).toEqual([
      {
        subjectId: sid("sci"),
        subjectName: "Science",
        weightedAverage: 65,
        provisional: true,
        position: null,
        presentCaCount: 0,
        expectedCaCount: 0,
      },
    ]);
  });

  it("preserves the bySubject order", () => {
    const bySubject = [
      {
        subjectId: sid("b"),
        subjectName: "B",
        weightedAverage: 60,
        provisional: false,
        position: null,
      },
      {
        subjectId: sid("a"),
        subjectName: "A",
        weightedAverage: 90,
        provisional: false,
        position: null,
      },
    ];
    const seeds = buildSubjectRowSeeds(bySubject, []);
    expect(seeds.map((s) => s.subjectId)).toEqual([sid("b"), sid("a")]);
  });
});
