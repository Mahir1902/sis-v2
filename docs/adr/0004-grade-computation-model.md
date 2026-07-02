---
status: accepted
date: 2026-06-26
---

# Grade computation: renormalize to present CAs, question-derived denominator

## Context and decision

A term grade is the weighted average of up to three Continuous Assessments (CA-1, CA-2, CA-3) per subject/semester. The original `computeGradesForStudent` had three latent defects: a not-yet-conducted CA contributed 0% while still carrying its full weight (90% on CA-1 alone stored as 30% → "F"); a level that never runs CA-3 capped every student at 66.7%; and per-CA percentage divided by a hand-typed `assessment.totalMarks` that could exceed the sum of the questions actually on the paper, so the grades table and the per-question drill-down reported different percentages for the same CA.

We are changing the computation to:

- **Renormalize to present CAs.** A CA's weight enters the denominator only if it is "present" for the student. The weighted average divides by the summed weight of present CAs, not by a fixed 1.0. Mid-semester grades are therefore meaningful, and a missing CA never caps the achievable score.
- **Present = assessment exists AND the student has ≥1 entered mark for it.** A student marked **absent** counts as a *present 0* (you cannot drop a CA by missing it — this finally gives the `isAbsent` flag a behavioural role). A student with **no answer rows at all** is *not yet graded* and is excluded from the denominator rather than scored 0.
- **Denominator = sum of the questions' `marksAllocated`.** This is the marks actually on the paper. `assessment.totalMarks` is demoted to a display-only target (candidate for removal) and is no longer used in any percentage. A CA with zero questions has denominator 0 and is therefore "not present" → excluded, consistent with the rule above.
- **Weighting is always equal across present CAs.** The `assessmentWeightingRules` table, its mutation, its query, and its lookup are removed — there was never a UI to set a weight, so every grade already used the 1/3 fallback. See ADR consequence below.

## Considered options

- **Block computation until all CAs exist** (the other defensible fix for the deflation bug). Rejected: the school wants to see grades mid-semester, and "all marks entered" is awkward to enforce — one student's missing mark would otherwise block the whole class. Renormalization gives a truthful running grade with no gate.
- **Treat a not-yet-conducted CA as a genuine 0.** Rejected: that *is* the bug — it punishes students for assessments that have not happened.
- **Keep `assessment.totalMarks` as the authoritative denominator** (unallocated marks are intentionally unearnable). Rejected: it silently bakes unearnable points into every average and contradicts the drill-down, which already divides by the question sum. One denominator, derived from the questions.
- **Force `totalMarks == sum(marksAllocated)` by validation.** Rejected: forces full allocation before any grade computes, and keeps a redundant field whose only job is to mirror a number the questions already define.
- **Keep the weighting-rules backend for future use.** Rejected as carried dead code (YAGNI). Re-introducing unequal weights later is a small, well-understood change that would ship *with* the admin UI it needs, instead of leaving unreachable backend behind.

## Consequences

- **Existing `computedGrades` rows must be recomputed.** Stored `weightedAverage`/`letterGrade` reflect the old (deflated) math; this is a backfill, not a forward-only change.
- **`isAbsent` is now load-bearing.** `computeGradesForStudent` must distinguish absent (present 0) from no-answer (excluded) — previously it ignored the flag entirely.
- **`assessmentWeightingRules` removal is a schema change** (drop table + mutation + query + the lookup). Equal split across present CAs is hardcoded.
- **`assessment.totalMarks` becomes display-only.** The ~4 validation blocks that guarded "questions must not exceed totalMarks" can be reconsidered; the field may be dropped in a follow-up.
- **Reversible in shape, not in data.** The math change is easy to alter later, but each change implies another recompute of stored grades.
