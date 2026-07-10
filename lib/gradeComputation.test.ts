import { describe, expect, it } from "vitest";
import { type CaInput, computeRenormalizedGrade } from "./gradeComputation";

/** A present, fully-marked CA: hasAnswers, positive denominator. */
function ca(
  assessmentNumber: 1 | 2 | 3,
  marksObtained: number,
  marksAllocated: number,
): CaInput {
  return { assessmentNumber, hasAnswers: true, marksObtained, marksAllocated };
}

describe("computeRenormalizedGrade", () => {
  it("averages three present CAs and grades the mean", () => {
    // 80%, 70%, 90% → mean 80% → "A"
    const result = computeRenormalizedGrade([
      ca(1, 40, 50),
      ca(2, 35, 50),
      ca(3, 45, 50),
    ]);
    expect(result).not.toBeNull();
    expect(result?.weightedAverage).toBeCloseTo(80);
    expect(result?.letterGrade).toBe("A");
    expect(result?.presentCaCount).toBe(3);
  });

  it("does not deflate a lone present CA by absent weight (the original bug)", () => {
    // Only CA-1 conducted, student scored 90%. Old math stored 30% → "F".
    // Renormalized to the one present CA, it must be 90% → "A+".
    const result = computeRenormalizedGrade([ca(1, 90, 100)]);
    expect(result?.weightedAverage).toBeCloseTo(90);
    expect(result?.letterGrade).toBe("A+");
    expect(result?.presentCaCount).toBe(1);
    expect(result?.ca2).toBeUndefined();
    expect(result?.ca3).toBeUndefined();
  });

  it("excludes an unmarked CA from the denominator (not a zero)", () => {
    // CA-1 marked at 60%, CA-2 has no answer rows yet → averaged over 1 CA = 60,
    // NOT (60 + 0) / 2 = 30.
    const result = computeRenormalizedGrade([
      ca(1, 60, 100),
      {
        assessmentNumber: 2,
        hasAnswers: false,
        marksObtained: 0,
        marksAllocated: 100,
      },
    ]);
    expect(result?.weightedAverage).toBeCloseTo(60);
    expect(result?.presentCaCount).toBe(1);
    expect(result?.ca2).toBeUndefined();
  });

  it("counts an absent CA as a present zero that pulls the average down", () => {
    // CA-1 = 80%, CA-2 absent (marked, marks 0). Absent is present-0, so the
    // mean is (80 + 0) / 2 = 40, distinct from CA-2 being merely unmarked.
    const result = computeRenormalizedGrade([
      ca(1, 80, 100),
      ca(2, 0, 100), // absent: hasAnswers true, marks 0
    ]);
    expect(result?.weightedAverage).toBeCloseTo(40);
    expect(result?.presentCaCount).toBe(2);
    expect(result?.ca2?.percentage).toBeCloseTo(0);
  });

  it("derives each percentage from marksAllocated, never a totalMarks field", () => {
    // 30 / 40 allocated = 75%. There is no `totalMarks` input to divide by.
    const result = computeRenormalizedGrade([ca(1, 30, 40)]);
    expect(result?.ca1?.percentage).toBeCloseTo(75);
    expect(result?.ca1?.totalMarks).toBe(40);
    expect(result?.weightedAverage).toBeCloseTo(75);
  });

  it("returns null when no CA is present (caller writes no row)", () => {
    expect(computeRenormalizedGrade([])).toBeNull();
    expect(
      computeRenormalizedGrade([
        {
          assessmentNumber: 1,
          hasAnswers: false,
          marksObtained: 0,
          marksAllocated: 100,
        },
      ]),
    ).toBeNull();
  });

  it("treats a CA with zero allocated marks as not present (no divide-by-zero)", () => {
    // Assessment has answer rows but no questions → denominator 0 → excluded.
    // It is the only CA, so the whole subject is ungraded.
    const result = computeRenormalizedGrade([
      {
        assessmentNumber: 1,
        hasAnswers: true,
        marksObtained: 0,
        marksAllocated: 0,
      },
    ]);
    expect(result).toBeNull();
  });

  it("applies the school's letter-grade thresholds at the boundaries", () => {
    const grade = (obtained: number) =>
      computeRenormalizedGrade([ca(1, obtained, 100)])?.letterGrade;
    expect(grade(90)).toBe("A+");
    expect(grade(80)).toBe("A");
    expect(grade(70)).toBe("B");
    expect(grade(60)).toBe("C");
    expect(grade(50)).toBe("D");
    expect(grade(49)).toBe("F");
  });
});
