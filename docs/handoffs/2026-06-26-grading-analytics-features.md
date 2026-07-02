# Handoff — Grading Analytics Features (post-review build)

**Date:** 2026-06-26
**Branch context:** work began on `review/grading-cards`
**Purpose:** Implement the four academic-analytics features surfaced during the grading code review. These are **net-new features**, deliberately scoped *out* of the review's correctness/cleanup work.

---

## What this is NOT

This handoff does **not** cover the review-scope fixes (calc bugs, deletions, small bug fixes). Those are recorded separately:

- **Grade-math changes** → `docs/adr/0004-grade-computation-model.md` (renormalize to present CAs, absent=present-0, question-derived denominator, delete `assessmentWeightingRules`).
- **Domain language** → `CONTEXT.md` → "Grading & Academic Records" section (read this first — it defines CA, Present CA, Absent vs Unmarked, Computed Grade, etc.).

⚠️ **Dependency:** ADR-0004 changes the *meaning* of `computedGrades.weightedAverage` (it becomes renormalized). Build these features on the corrected field. If the review fixes haven't landed yet, coordinate ordering — the vs-class-average feature in particular must compare like-for-like renormalized values.

---

## The four features (priority order)

### 1. Vs-class-average line on the subject performance chart  ⭐ top pick
**Why:** Raw % across grade levels isn't difficulty-adjusted. Comparing a student to the class average (same level, same paper) cancels difficulty out and is the honest "improvement" signal.
**Shape:** Add a second line to the existing subject chart in `AcademicHistoryTab.tsx` showing the class average for the same `standardLevelId` + `academicYear` + `subjectId` + `semester` at each point.
**Data:** All in `computedGrades`. To assemble a class: `enrollments.getEnrollmentsByLevelYear` → their `computedGrades` filtered by subject/semester. **Backend gap:** no direct index for "all computedGrades for a level/year/subject" — likely needs a new aggregate query and possibly an index. Run it through `convex-performance-audit` (it reads many students' grades).

### 2. CA-1 → CA-2 → CA-3 within-term progression chart
**Why:** Same level + same term = same difficulty → a clean "is the kid climbing as they learn this material" signal.
**Shape:** Small per-subject chart plotting the three CA percentages for one enrollment/semester.
**Data:** Already stored on a single `computedGrades` row: `ca1Percentage`, `ca2Percentage`, `ca3Percentage`. Cheapest feature — mostly frontend.

### 3. Per-question class analytics + student comparison
**Why (user's words):** "see how the class performed in each question… where students are lacking… compare what Amir answered vs others."
**Shape:** A class-level view per assessment: per-question average, mark distribution, and student-vs-student comparison. The current `AssessmentDetailDialog` only shows *one* student's questions — this is the missing class dimension.
**Data:** `studentAssessmentAnswers.getAnswersByAssessment` already returns all answers for an assessment (`.take(5000)`); `assessmentQuestions` via `by_assessment`. Aggregate `marksObtained` per `questionId` across students. New query for per-question stats; new UI (likely under `app/(dashboard)/admin/assessments/[assessmentId]/`).

### 4. Concept tagging UI + weak-concept analytics
**Why:** Surface which *concepts* students struggle with, to inform teaching.
**Shape:** (a) Add `conceptTag` / `learningObjective` inputs to `QuestionManager.tsx` (write side — currently no UI sets them). (b) Analytics view grouping question performance by `conceptTag`.
**Data:** Fields exist on `assessmentQuestions` (schema + `createQuestion`/`bulkCreateQuestions` already accept them) but are **unreachable in both directions today** — nothing writes or reads them. This feature makes them live. Builds naturally on top of feature 3's aggregation.

---

## Key files

| Area | Path |
|------|------|
| Grade aggregation / queries | `convex/computedGrades.ts` |
| Per-question marks | `convex/studentAssessmentAnswers.ts` |
| Assessments / questions | `convex/assessments.ts`, `convex/assessmentQuestions.ts` |
| Charts (features 1, 2) | `app/(dashboard)/students/[studentId]/_components/AcademicHistoryTab.tsx` |
| Existing per-student drill-down (reference for 3) | `.../_components/AssessmentDetailDialog.tsx` |
| Mark entry grid (reference for 3) | `app/(dashboard)/admin/assessments/[assessmentId]/_components/MarkEntryGrid.tsx` |
| Question editor (feature 4 write side) | `.../_components/QuestionManager.tsx` |
| Schema | `convex/schema.ts` (`assessmentQuestions`, `studentAssessmentAnswers`, `computedGrades`) |

---

## Constraints & gotchas (from CLAUDE.md + this codebase)

- **Mandatory agent workflow:** Planning → Devil's Advocate → Backend/Frontend → Review agents, with `TASK_LOG.md` updated before/after each sub-task. New tables/queries and any new page **must** trigger Devil's Advocate + Backend Review per CLAUDE.md.
- **Server-side rules:** percentages/letter grades computed server-side; new aggregate queries need `requireRole(["admin","teacher"])` and declared indexes for any `withIndex`. No unbounded `.collect()` on large tables; batch with `Promise.all`.
- **Permissions:** grade queries are admin/teacher only today (student self-view is Phase 5, not built). Class aggregates are fine for admin/teacher.
- **Charts:** Recharts (already used). Brand colors via CSS vars — `var(--color-school-green)`, `var(--color-school-yellow)` — never hardcoded hex.
- **Honesty principle:** cross-level raw-% lines must be labeled as raw history, not "improvement." Features 1 & 2 are the difficulty-controlled views; don't reintroduce apples-to-oranges trends.
- After code changes, run `graphify update .` to refresh the knowledge graph. `npm run build` + `npm run lint` must pass before any feature is marked complete.

---

## Suggested skills

Invoke per the project's agent system; these map to the work:

- **superpowers:brainstorming** — run first on features 3 & 4; the analytics UX has open design questions (what stats, how to compare students, how to surface weak concepts).
- **superpowers:writing-plans** (or **writing-plans**) — each feature is multi-step; plan before coding, write to `TASK_LOG.md`.
- **convex** + **convex-performance-audit** — backend queries and the class-aggregate read in feature 1 (read amplification risk).
- **frontend-design** + **shadcn** — charts and the new analytics screens.
- **vercel-react-best-practices** / **next-best-practices** — component/data-fetching patterns.
- **graphify** — navigate the codebase; `graphify query` before grepping.
- **playwright-cli** — E2E verification of the new screens (per user's preferred workflow).

---

## Starting point for the next session

1. Read `CONTEXT.md` → "Grading & Academic Records" and `docs/adr/0004-grade-computation-model.md`.
2. Confirm whether ADR-0004's review-scope fixes have landed (affects feature 1's correctness).
3. Brainstorm → plan feature 1 (highest value, mostly reuses existing data), then 2, 3, 4.
