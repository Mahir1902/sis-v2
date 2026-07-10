import type { Id } from "@/convex/_generated/dataModel";

/**
 * Pure view-model for the admin "Class Analytics" cohort page (Phase D / D.1).
 * Mirrors the Phase C `academicHistoryView.ts` pattern: no React, no Convex, no
 * DOM — it takes the two Phase B query results (`getGradeSpread` /
 * `getStudentsNeedingHelp`) and shapes them for the presentational components,
 * so all the branching (chart series, empty-state discrimination, needs-help
 * grouping) is unit-testable in isolation.
 */

/** The school's six letter grades, worst→best kept explicit and ordered A+…F. */
export type LetterGrade = "A+" | "A" | "B" | "C" | "D" | "F";
const LETTER_GRADES: LetterGrade[] = ["A+", "A", "B", "C", "D", "F"];

/** The `spread` object returned by `getGradeSpread` — a count per letter. */
export type GradeSpread = Record<LetterGrade, number>;

/** One bar of the grade-spread chart. */
export type GradeSpreadDatum = { grade: LetterGrade; count: number };

/**
 * Turn the `getGradeSpread` spread object into an ordered A+…F series the bar
 * chart renders left→right. The order is fixed (not object-key order) so the
 * chart is stable and every bucket is present even at zero.
 */
export function buildGradeSpreadSeries(
  spread: GradeSpread,
): GradeSpreadDatum[] {
  return LETTER_GRADES.map((grade) => ({ grade, count: spread[grade] ?? 0 }));
}

/**
 * Human count label for a cohort total, e.g. "17 grades" / "1 grade". The noun
 * is singular only for a total of exactly 1.
 */
export function gradeCountLabel(total: number): string {
  return `${total} grade${total === 1 ? "" : "s"}`;
}

/**
 * The five ways the cohort view can present, discriminated by `kind`. The four
 * empty/good-news variants (DA #4) are kept distinct so the "good news" copy
 * (all passing) never reads as "no data yet":
 *  - `empty`               — no grades at all for the class (total 0, no subject);
 *  - `empty_subject`       — a subject is selected but has no grades yet;
 *  - `all_passing`         — grades exist across the class, none below 50%;
 *  - `all_passing_subject` — grades exist for the selected subject, none below 50%;
 *  - `has_at_risk`         — one or more students are below 50% (render the list).
 */
export type CohortStateKind =
  | "empty"
  | "empty_subject"
  | "all_passing"
  | "all_passing_subject"
  | "has_at_risk";

export type CohortState = { kind: CohortStateKind };

/**
 * Discriminate the cohort view from the two Phase B query summaries plus whether
 * a specific subject is selected. `total` is `getGradeSpread().total`;
 * `needsHelpCount` is the length of `getStudentsNeedingHelp()`.
 */
export function cohortState(args: {
  total: number;
  needsHelpCount: number;
  subjectSelected: boolean;
}): CohortState {
  if (args.total === 0) {
    return { kind: args.subjectSelected ? "empty_subject" : "empty" };
  }
  if (args.needsHelpCount === 0) {
    return {
      kind: args.subjectSelected ? "all_passing_subject" : "all_passing",
    };
  }
  return { kind: "has_at_risk" };
}

/** No grades exist for the class at all — the true "nothing recorded" state. */
export const EMPTY_CLASS_COPY = "No grades recorded for this class yet.";

/** A subject is selected but has no grades yet — distinct from a passing class. */
export const EMPTY_SUBJECT_COPY = "No grades recorded for this subject yet.";

/** Good-news copy for the whole class — must NOT read as "no data yet" (DA #4). */
export const ALL_PASSING_COPY =
  "No students below 50% for this selection — every student is passing.";

/** Good-news copy when a subject is selected and all its students are passing. */
export const ALL_PASSING_SUBJECT_COPY =
  "No students below 50% in this subject — every student is passing.";

/**
 * Title for the grade-spread chart (DA #6). Deliberately "Current Standing",
 * NOT "Results" — the spread includes in-progress/provisional grades, so it must
 * not read as a final result. The word "Results" must not appear as a heading or
 * label anywhere on this page.
 */
export const CURRENT_STANDING_TITLE = "Current Standing";

/**
 * Visible (not hover-only) subtitle under the grade-spread chart (DA #6),
 * warning that the distribution counts grades still in progress. Exported as a
 * constant so the component renders exactly this copy and it stays testable.
 */
export const CURRENT_STANDING_SUBTITLE =
  "Includes grades in progress — not final results.";

/** One row of `getStudentsNeedingHelp` — a student failing one subject. */
export type NeedsHelpRow = {
  studentId: Id<"students">;
  studentName: string;
  subjectId: Id<"subjects">;
  subjectName: string;
  weightedAverage: number;
  letterGrade: string;
};

/** A student's failing subjects (without the repeated student fields). */
export type NeedsHelpSubject = {
  subjectId: Id<"subjects">;
  subjectName: string;
  weightedAverage: number;
  letterGrade: string;
};

/** One student and every subject they are failing, worst subject first. */
export type NeedsHelpStudent = {
  studentId: Id<"students">;
  studentName: string;
  subjects: NeedsHelpSubject[];
};

/**
 * Group the flat `getStudentsNeedingHelp` rows by student so each at-risk
 * student appears ONCE with their failing subjects nested (DA #5, the "All
 * subjects" view). Within a student, subjects are ordered worst (lowest
 * weighted average) first; students are ordered by their own worst subject,
 * lowest first, so the most at-risk student surfaces at the top — matching the
 * flat list's lowest-first intent.
 *
 * The container renders this grouped shape only when NO subject is selected;
 * with a specific subject it renders the flat rows directly (one per student).
 */
export function groupNeedsHelpByStudent(
  rows: NeedsHelpRow[],
): NeedsHelpStudent[] {
  const byStudent = new Map<Id<"students">, NeedsHelpStudent>();
  for (const r of rows) {
    let entry = byStudent.get(r.studentId);
    if (!entry) {
      entry = {
        studentId: r.studentId,
        studentName: r.studentName,
        subjects: [],
      };
      byStudent.set(r.studentId, entry);
    }
    entry.subjects.push({
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      weightedAverage: r.weightedAverage,
      letterGrade: r.letterGrade,
    });
  }

  const students = [...byStudent.values()];
  for (const s of students) {
    s.subjects.sort((a, b) => a.weightedAverage - b.weightedAverage);
  }
  // Order students by their worst (already first) subject grade, lowest first.
  students.sort(
    (a, b) => a.subjects[0].weightedAverage - b.subjects[0].weightedAverage,
  );
  return students;
}
