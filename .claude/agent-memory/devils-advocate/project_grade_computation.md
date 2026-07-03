---
name: grade-computation-pitfalls
description: Confirmed and suspected pitfalls in the SIS v2 grade computation system (ADR-0004 Phase A and ADR-0005 Phase B analytics)
type: project
---

**`db.replace` required (not `db.patch`) when updating `computedGrades` rows.**
See [[Schema Gotchas]] for the full explanation. Short version: `db.patch` with `undefined` values does not clear optional fields. Use `db.replace` on the update path in `recomputeGrade`.

**Why:** Confirmed during Phase A adversarial review (2026-07-01). A CA transitioning from present to unmarked would leave stale `ca2Percentage`/`ca2Marks`/`ca2TotalMarks` in the stored row, silently corrupting the next read.

**How to apply:** Code review of any `computedGrades` mutation: reject `db.patch` on existing rows, require `db.replace`.

---

**`expectedCaCount` must NOT drive the provisional/final determination in the frontend.**
`expectedCaCount` is set at compute time and goes stale if assessments are added afterward. If the frontend uses `present count < expectedCaCount` to label a grade as provisional/final, it will silently mark a grade as "final" when a new CA was added after the last compute run. The provisional/final determination must be derived from `assessments.length` fetched live at query time, compared against the count of `caXPercentage` fields that are set on the stored grade row. `expectedCaCount` is only valid for display strings like "based on N of M CAs" — it is NOT authoritative for provisional classification.

**Why:** Confirmed during Phase A adversarial review (2026-07-01). Existing DA finding #7. Acceptable to leave `expectedCaCount` stale for Phase A, but the frontend must not use it for the provisional gate.

**How to apply:** When reviewing GradesTab or any component that renders a Provisional Grade indicator, verify the provisional check uses a live assessment count query, not `expectedCaCount`.

---

**A.4 migration batch size needs monitoring against Convex's per-mutation read limit.**
`recomputeGrade` does 2 indexed reads per assessment (questions + answers), batched in parallel across up to 3 assessments per call = up to 6 reads per grade row. At the default migration batch size of 100 rows, that is up to 600 reads per migration mutation. For a class of 30 students × 5 subjects × 2 semesters = 300 rows; a single batch at 100 rows is fine. But on a larger dataset approaching Convex's per-mutation read ceiling (8192 document reads), batch size must be reduced. Start with default batch size; if migration fails with a read limit error, reduce to 25 via the `batchSize` option on the migration runner.

**Why:** Confirmed during Phase A adversarial review (2026-07-01). The migration calls `recomputeGrade` per row, which is itself a multi-read operation. Standard batch-size advice doesn't account for the nested read fan-out.

**How to apply:** Document the batch size caveat in the migration JSDoc. Monitor the first migration run on any dataset > 200 grade rows.

---

**Zero-question assessments: exclude the CA entirely, do not divide-by-zero.**
An `isActive=true` assessment with no `assessmentQuestions` rows has Σ`marksAllocated` = 0. If the student has answer rows for it (orphaned from a previous state), the CA must still be excluded — `questionSum === 0` check must come before the percentage calculation. The present-CA check (`≥1 answer row AND questionSum > 0`) handles this correctly per ADR-0004. Confirmed safe; the guard must be explicit in the rewrite.

**How to apply:** Code review of `recomputeGrade`: verify the zero-question exclusion check is before division, not after.

---

**`getComputedGradesByStudent` uses unbounded `.collect()` — future pagination candidate.**
The `by_student` index query in `getComputedGradesByStudent` has no `.take(n)` limit. For a student with many years of grades this is low risk today but should be flagged as a pagination candidate when longitudinal analytics are surfaced more broadly.

**How to apply:** Flag in any future analytics query that touches `computedGrades` without a limit.

---

## Phase B Analytics (ADR-0005) — confirmed risks from adversarial review 2026-07-03

**B.3 overall rank: mixed final/provisional subjects leave eligibility undefined.**
The spec gates Class Position on final grades only, but does not specify whether a student with some final and some provisional subjects gets an overall rank. The safest default is to suppress overall rank until all subjects are final (one provisional blocks it). This must be a named constant in `lib/gradeAnalytics.ts`. The `getClassPositions` return shape needs a per-student `overallRankSuppressed: boolean` field so the UI can explain the suppression.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). Leaving this implicit causes the frontend to show ranks for incompletely-graded students mid-term.

**How to apply:** Before writing `getClassPositions`, confirm the suppression rule with the team and encode it as a constant. Reject any implementation that silently omits the rank without a signal to the caller.

---

**B.3 final-gate assessment count fetch is O(students × subjects) without deduplication.**
The live CA count fetch for final-gating must be batched by unique (subjectId, levelId, yearId, semester) tuples before the ranking loop, stored in a Map, then looked up per row. If done inside the student/row loop it becomes a serial or even O(N_students × N_subjects) read fan-out. Assessments table also lacks a composite index covering all four columns — the `by_subject_semester` index requires a post-filter on level+year, scanning all levels for a subject.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). The schema needs a new index: `by_subject_level_year_semester: ["subjectId", "standardLevelId", "academicYearId", "semester"]`. Flag this as a required schema change before Phase B backend work begins.

**How to apply:** Backend Agent must add the index before writing B.3. Promise.all over unique subject tuples — never await inside the ranking loop.

---

**Withdrawn students with stale computedGrades rows inflate the ≥5 floor and class average.**
The `by_level_year_subject_semester` index returns all rows regardless of enrollment status. A student who was graded then withdrawn still has rows. B.2, B.3, and B.5 must join each grade row to its enrollment and exclude rows where `enrollment.exitDate !== undefined`. Batch enrollment fetches with Promise.all keyed on unique enrollmentIds.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). Could cause a 4-active-student class to cross the ≥5 floor using a withdrawn student's grade, producing misleading positions and averages.

**How to apply:** All Phase B queries that collect over `by_level_year_subject_semester` must filter to active enrollments as a post-collect step before any math.

---

**B.4 per-CA baseline: ≥5 floor must be applied per-CA independently, not to the whole class.**
Different students may have different CAs present (CA-1 done for 8 students, CA-2 done for only 3). Applying a single floor across the class would show a CA-2 baseline derived from 3 students. Return shape must be `{ ca1: { mean, n } | null, ca2: ... | null, ca3: ... | null }` with null meaning suppressed for that CA.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). Interface change required — callers must handle per-CA nullability.

---

**B.2 mean and all analytics functions must return null (not 0, not NaN) on empty input.**
If `.collect()` returns 0 rows (or all rows are filtered out as withdrawn), dividing sum/count = NaN propagates silently. The mean function in `lib/gradeAnalytics.ts` must guard `if (values.length === 0) return null`. Every B.x query must return a `suppressed: true` signal when count < 5, never a NaN or misleading 0.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). NaN can escape into the return value and reach Recharts, producing invisible chart breaks.

---

**B.3 competition ranking must operate on values rounded to 2dp to avoid float-tie misses.**
Renormalized means computed via different sum paths (1 CA vs 3 CAs) may differ at the 15th decimal place even when they should be equal. The sort and strict-greater comparison for competition ranking (rank = 1 + count strictly greater) must operate on values rounded to 2 decimal places. This rounding belongs in `lib/gradeAnalytics.ts`, not in the query handler.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). Would cause two students with the same display grade to receive different ranks.

---

**Phase B queries are silently partial if the A.4 migration has not completed.**
`standardLevelId` and `academicYear` on `computedGrades` are `v.optional()` pending backfill. Pre-migration rows are invisible to the `by_level_year_subject_semester` index. If migration is incomplete, B.2/B.3 return partial results with no error. Add a runtime assertion or migration-complete guard in Phase B query handlers for the development period.

**Why:** Confirmed during Phase B adversarial review (2026-07-03). A class that appears to have 2 graded students may actually have 10 — the other 8 pre-date the migration.

**How to apply:** Document in TASK_LOG.md that Phase B is only valid after A.4 migration is confirmed complete. Add a JSDoc warning on each B.x query.
