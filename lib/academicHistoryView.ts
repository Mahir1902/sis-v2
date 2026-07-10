import type { Id } from "@/convex/_generated/dataModel";

export type Direction = "up" | "down" | "flat";
export type Rank = { rank: number; outOf: number };
export type OverallSuppressedReason =
  | "not_graded"
  | "provisional"
  | "insufficient_peers"
  | null;

/**
 * Seed the CONTAINER can build from getClassPositions.bySubject[] + the
 * student's own computedGrades row.
 */
export type SubjectRowSeed = {
  subjectId: Id<"subjects">;
  subjectName: string;
  weightedAverage: number;
  position: Rank | null;
  provisional: boolean;
  presentCaCount: number;
  expectedCaCount: number;
};

/** Full data a presentational row renders (seed + per-subject class-average fetch). */
export type SubjectRowView = SubjectRowSeed & {
  classAverage: number | null;
  delta: number | null;
};

export type PerCaChartPoint = {
  ca: string;
  you: number | null;
  classMean: number | null;
};

/** A single CA's cohort mean plus the number of peers it aggregates. */
export type CaBaselinePoint = { mean: number; n: number };

/** Per-CA cohort baseline; a CA is `null` when it has no cohort data. */
export type PerCaBaseline = {
  ca1: CaBaselinePoint | null;
  ca2: CaBaselinePoint | null;
  ca3: CaBaselinePoint | null;
};

/** The student's own per-CA percentages (absent CAs are undefined/null). */
export type StudentCaPercentages = {
  ca1Percentage?: number | null;
  ca2Percentage?: number | null;
  ca3Percentage?: number | null;
};

export type OverallPositionCopy = { headline: string; detail: string | null };

/**
 * English ordinal suffix for a positive integer.
 * Handles the 11/12/13 teens exception and 1st/2nd/3rd endings.
 */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Headline + optional detail describing the student's overall class position.
 * When `overall` is present the position is shown; otherwise `reason` selects
 * the pending/not-graded copy.
 */
export function overallPositionCopy(
  overall: Rank | null,
  reason: OverallSuppressedReason,
): OverallPositionCopy {
  if (overall) {
    return {
      headline: `Stood ${ordinal(overall.rank)} of ${overall.outOf} in class`,
      detail: null,
    };
  }
  switch (reason) {
    case "provisional":
      return {
        headline: "Class position pending",
        detail: "Class position posts when all subjects are final",
      };
    case "insufficient_peers":
      return {
        headline: "Class position pending",
        detail: "Needs 5 or more fully-graded classmates",
      };
    case "not_graded":
      return { headline: "Not yet graded this term", detail: null };
    default:
      return { headline: "Class position pending", detail: null };
  }
}

/**
 * Format a student-vs-class delta rounded to one decimal.
 * Positive → leading "+" and "up"; negative → "down"; rounds-to-zero → "0.0"
 * with no sign and "flat". `null` passes through as `null`.
 */
export function formatDelta(
  delta: number | null,
): { text: string; direction: Direction } | null {
  if (delta === null) {
    return null;
  }
  // Normalise -0 to 0 so a value that rounds to zero never renders "-0.0".
  const rounded = Math.round(delta * 10) / 10 + 0;
  if (rounded === 0) {
    return { text: "0.0", direction: "flat" };
  }
  if (rounded > 0) {
    return { text: `+${rounded.toFixed(1)}`, direction: "up" };
  }
  return { text: rounded.toFixed(1), direction: "down" };
}

/**
 * Sub-label for a provisional subject row, e.g. "Based on 1 of 3 CAs".
 * The noun is singular ("CA") only when the expected count is exactly 1.
 */
export function provisionalLabel(
  presentCaCount: number,
  expectedCaCount: number,
): string {
  const noun = expectedCaCount === 1 ? "CA" : "CAs";
  return `Based on ${presentCaCount} of ${expectedCaCount} ${noun}`;
}

/** One entry of `getClassPositions.bySubject[]` (the container's B.3 input). */
export type PositionBySubject = {
  subjectId: Id<"subjects">;
  subjectName: string;
  weightedAverage: number;
  provisional: boolean;
  position: Rank | null;
};

/** The slice of a student's computedGrades row this join needs. */
export type SubjectGradeRow = {
  subjectId: Id<"subjects">;
  expectedCaCount?: number | null;
  ca1Percentage?: number | null;
  ca2Percentage?: number | null;
  ca3Percentage?: number | null;
};

/**
 * Join `getClassPositions.bySubject[]` (B.3) with the student's own
 * computedGrades rows for the term to produce the `SubjectRowSeed[]` the
 * ClassComparisonCard renders. The bySubject entry carries the position and
 * provisional flag; the grade row supplies the CA counts.
 *
 * For each bySubject entry (order preserved):
 *  - `presentCaCount` = number of non-null CA percentages on the matching grade
 *    row (0 when there is no matching row);
 *  - `expectedCaCount` = the matching row's `expectedCaCount`, or `presentCaCount`
 *    when the row omits it or there is no matching row.
 */
export function buildSubjectRowSeeds(
  bySubject: PositionBySubject[],
  gradeRows: SubjectGradeRow[],
): SubjectRowSeed[] {
  return bySubject.map((subject) => {
    const gradeRow = gradeRows.find((r) => r.subjectId === subject.subjectId);
    const presentCaCount =
      (gradeRow?.ca1Percentage != null ? 1 : 0) +
      (gradeRow?.ca2Percentage != null ? 1 : 0) +
      (gradeRow?.ca3Percentage != null ? 1 : 0);
    const expectedCaCount = gradeRow?.expectedCaCount ?? presentCaCount;
    return {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      weightedAverage: subject.weightedAverage,
      provisional: subject.provisional,
      position: subject.position,
      presentCaCount,
      expectedCaCount,
    };
  });
}

/**
 * Build the three-point per-CA chart series (CA-1, CA-2, CA-3 in order).
 * Missing values stay `null` so the chart renders line gaps — they must
 * never be coerced to 0.
 */
export function buildPerCaChartData(
  baseline: PerCaBaseline,
  student: StudentCaPercentages,
): PerCaChartPoint[] {
  return [
    {
      ca: "CA-1",
      you: student.ca1Percentage ?? null,
      classMean: baseline.ca1?.mean ?? null,
    },
    {
      ca: "CA-2",
      you: student.ca2Percentage ?? null,
      classMean: baseline.ca2?.mean ?? null,
    },
    {
      ca: "CA-3",
      you: student.ca3Percentage ?? null,
      classMean: baseline.ca3?.mean ?? null,
    },
  ];
}
