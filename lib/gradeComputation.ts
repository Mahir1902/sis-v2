import { calculateLetterGrade } from "./gradeUtils";

/**
 * Pure grade math for the CA-1/2/3 renormalized model (ADR-0004).
 *
 * A subject's term grade is the equal-weighted average of a student's *present*
 * CAs, renormalized to the present ones. With equal weights, that renormalized
 * average is just the arithmetic mean of the present CA percentages — so this
 * module needs no weight table.
 * ponytail: mean == equal-weight renormalization. If unequal weights ever
 * return, replace the mean with Σ(pct·w)/Σw and thread a weight onto CaInput.
 */

/** One CA's raw inputs, as gathered from the DB by the mutation. */
export interface CaInput {
  assessmentNumber: 1 | 2 | 3;
  /** True when the student has ≥1 answer row for this assessment (incl. absent). */
  hasAnswers: boolean;
  /** Σ marksObtained across the student's answer rows (absent rows contribute 0). */
  marksObtained: number;
  /** Σ of the assessment's question `marksAllocated` — the real denominator. */
  marksAllocated: number;
}

/** Per-CA breakdown stored on the grade row for the drill-down UI. */
export interface CaBreakdown {
  marks: number;
  totalMarks: number;
  percentage: number;
}

export interface ComputedGrade {
  ca1?: CaBreakdown;
  ca2?: CaBreakdown;
  ca3?: CaBreakdown;
  weightedAverage: number;
  letterGrade: string;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  presentCaCount: number;
}

/**
 * A CA contributes to the grade iff the student was marked for it AND it has a
 * positive denominator. A CA with no questions (Σ marksAllocated = 0) is never
 * present, which also guards the percentage from dividing by zero.
 */
export function isPresent(ca: CaInput): boolean {
  return ca.hasAnswers && ca.marksAllocated > 0;
}

/**
 * Renormalized grade over the present CAs, or `null` when NONE are present —
 * in which case the caller writes no `computedGrades` row (and deletes any
 * stale one). "Not yet graded" is the absence of a row, never a stored 0/F.
 */
export function computeRenormalizedGrade(cas: CaInput[]): ComputedGrade | null {
  const present = cas.filter(isPresent);
  if (present.length === 0) return null;

  const breakdowns = new Map<number, CaBreakdown>();
  let sumPercentage = 0;
  let totalMarksObtained = 0;
  let totalPossibleMarks = 0;

  for (const item of present) {
    const percentage = (item.marksObtained / item.marksAllocated) * 100;
    breakdowns.set(item.assessmentNumber, {
      marks: item.marksObtained,
      totalMarks: item.marksAllocated,
      percentage,
    });
    sumPercentage += percentage;
    totalMarksObtained += item.marksObtained;
    totalPossibleMarks += item.marksAllocated;
  }

  const weightedAverage = sumPercentage / present.length;

  return {
    ca1: breakdowns.get(1),
    ca2: breakdowns.get(2),
    ca3: breakdowns.get(3),
    weightedAverage,
    letterGrade: calculateLetterGrade(weightedAverage),
    totalMarksObtained,
    totalPossibleMarks,
    presentCaCount: present.length,
  };
}
