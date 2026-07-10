---
name: grade-computation-model
description: ADR-0004 renormalized grade model + ADR-0005 Phase B class analytics — how computedGrades is written/read and reviewed
metadata:
  type: project
---

The computedGrades write path (ADR-0004, `docs/adr/0004-grade-computation-model.md`) and the Phase B class-analytics read path (ADR-0005, `docs/adr/0005-difficulty-adjusted-academic-analytics.md`).

**Model:** A subject's term grade is the equal-weight renormalized average over *present* CAs, which with equal weights == arithmetic mean of present CA percentages. Pure math lives in `lib/gradeComputation.ts` (`computeRenormalizedGrade`); there is no weight table — `assessmentWeightingRules` was removed in A.3.

Key review invariants confirmed in the Phase A review (2026-07-02):

- **Present CA** = `hasAnswers` (≥1 answer row) AND `marksAllocated > 0`. This also guards divide-by-zero.
- **Denominator** = Σ `assessmentQuestions.marksAllocated` (loaded via `by_assessment`), NOT `assessment.totalMarks`. Flag any code that uses `totalMarks` as the denominator.
- **Zero present CAs ⇒ ungraded**: delete any existing row, write none. "Not graded" is the ABSENCE of a row, never a stored 0/F.
- **`ctx.db.replace` (NOT patch)** on the update path is deliberate and correct: Convex `patch` keeps `undefined` keys stale, so a CA going present→unmarked would leave a stale `caN` field. `replace` drops `computedGrades.remarks` — verified safe: the only cross-file reader is `students.ts` cascade-delete which reads `._id` only; nothing reads `.remarks`.
- **`recomputeGrade(ctx, args)` is an exported shared helper** used by both the public mutation and the A.4 migration. It intentionally does NO permission check — the public `computeGradesForStudent` mutation gates with `requireRole(["admin","teacher"])`; the migration is an internalMutation. This split is the approved pattern; do not flag the helper's missing requireRole.
- **B.1 denormalised fields** `standardLevelId` + `academicYear` are populated from the enrollment (immutable once the grade exists) to enable the `by_level_year_subject_semester` class-analytics index in one read. Still `v.optional` in schema pending widen-migrate-narrow narrowing.
- **`expectedCaCount = assessments.length`** is a snapshot at compute time and CAN GO STALE if assessments are added later. Final/provisional gates MUST reconcile against live `assessments.length`, not this stored value.

Phase B class-analytics review invariants (approved 2026-07-03, `convex/computedGrades.ts` below the `// ─── Phase B` banner):

- **Class = active enrollments at level+year; section ignored.** Currency is `exitDate === undefined` (never `status`). The shared `activeRows` helper joins each computedGrades row to its enrollment (batched over unique ids) and drops withdrawn students BEFORE any average/floor/rank. Confirm `activeRows` is applied in every analytics query — DA B-1.
- **Approved index-scan pattern:** `classTermRows`/`getGradeSpread` range on the `[standardLevelId, academicYear]` PREFIX of `by_level_year_subject_semester` and post-filter semester/subject in memory. This is legal (subject sits before semester in the index) and bounded to one class (~cohort × subjects × 2 semesters, low thousands worst case). One-class-bounded `.collect()` is ACCEPTED here — no `.take()` required.
- **Final = present-CA count == LIVE active-assessment count** via `liveAssessmentCount` (reuses `by_subject_semester` + level/year/isActive filter), NOT stored `expectedCaCount`. Must be batched over UNIQUE subjects (never inside the rank loop) — DA B-5.
- **≥5 graded-peer floor** (`MIN_CLASS_PEERS = 5`): applied to class averages and positions; per-CA baseline applies it per-CA independently (DA B-6). List-shaped queries (grade spread, who-needs-help) correctly apply NO floor — an aggregate/per-row list doesn't single out a peer.
- **No NaN escapes:** all averages go through `mean()` which returns `null` on empty; queries return explicit `sufficient`/`overallSuppressedReason` signals — DA B-3.
- **Overall class rank** suppressed unless the target's whole graded term is final AND ≥5 term-complete peers. "term-complete" = every subject the student HAS a grade in is final; does NOT require coverage of every class subject (full-coverage deferred to Phase C, marked with a `ponytail:` comment). Locked — do not relitigate.
- **Role scope for all 5 analytics queries is `["admin","teacher"]`** (student-facing variant is Phase C). Returning student names to teachers is in-scope, not a leak.

**Why:** These are locked design decisions, not open questions — review for correctness/safety against them, do not re-litigate the design.
