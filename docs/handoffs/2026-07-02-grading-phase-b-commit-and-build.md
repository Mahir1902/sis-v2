# Handoff — Grading Overhaul: commit Phase A, then implement Phase B

**Date:** 2026-07-02
**Branch:** `review/grading-cards`
**Your job:** (1) **commit the Phase A change set** (below), then (2) implement **Phase B** — the backend analytics queries. Stop before Phase C unless told otherwise.

---

## TL;DR

Phase A (grade-math fix) is **implemented, both mandatory gates passed (Devil's Advocate + Backend Review APPROVED), all checks green, migration run — but nothing is committed.** Your first action is to commit it. Then build Phase B: `getClassAverages`, `getClassPositions`, per-CA baseline, and the cohort spread/needs-help queries, all reading the `computedGrades.by_level_year_subject_semester` index that B.1 already landed.

**Do not re-litigate the design.** ADR-0004 (math, done), ADR-0005 (analytics, for Phase B), and the CONTEXT glossary are locked. Read them, then build.

---

## STEP 1 — Commit Phase A (do this first)

Use the **`commit` skill**. Branch is already `review/grading-cards` (a feature branch — safe to commit directly). End the message with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` footer.

**Include in the commit (Phase A + its design docs — one coherent "grade computation" commit, or split code vs docs if you prefer):**
```
 M CONTEXT.md                         ← grading glossary (design session)
 M TASK_LOG.md                        ← Phase A plan + notes + approvals
 M convex/_generated/api.d.ts         ← regenerated (weighting-rules removed)
 D convex/assessmentWeightingRules.ts ← deleted (A.3)
 M convex/computedGrades.ts           ← A.1 rewrite + shared recomputeGrade
 M convex/migrations.ts               ← A.4 recomputeAllGrades
 M convex/schema.ts                   ← A.2 expectedCaCount + A.3 table drop
?? docs/adr/0004-grade-computation-model.md
?? docs/adr/0005-difficulty-adjusted-academic-analytics.md
?? docs/handoffs/                     ← 06-26 brief + 06-30 handoff (already in tree)
?? lib/gradeComputation.ts            ← A.1 pure helper
?? lib/gradeComputation.test.ts       ← 8 unit tests
```

**Do NOT commit / leave alone:**
- `convex/_e2eTemp.ts` — **pre-existing, NOT from this work.** The original 06-30 handoff says leave it alone. Keep it out of the commit.
- `.claude/agent-memory/**` (modified + 2 new `project_grade_computation.md`) — subagent memory scratch. Optional; I'd **exclude** it from the feature commit (or commit separately if the repo tracks agent memory intentionally — check `git log` for precedent).

Suggested message shape (conventional commits, per the `commit` skill):
`feat(grades): renormalized CA computation + drop weighting rules (ADR-0004, Phase A)`

After committing, sanity-check `git status` shows only `_e2eTemp.ts` and (if excluded) the agent-memory files remaining.

---

## Where the design + state live (read; don't duplicate)

| What | Path |
|------|------|
| **Full sequenced plan + Phase A approvals + Phase A implementation notes** | `TASK_LOG.md` → "Current Feature: Grading & Academic Analytics Overhaul" |
| **Analytics design (Phase B's spec)** | `docs/adr/0005-difficulty-adjusted-academic-analytics.md` |
| **Grade-math (Phase A, done)** | `docs/adr/0004-grade-computation-model.md` |
| **Glossary** (Class, Class Average, Class Position, Provisional, ≥5 floor) | `CONTEXT.md` → "Grading & Academic Records" |
| **Original feature brief** (the 4 analytics features, priority) | `docs/handoffs/2026-06-26-grading-analytics-features.md` |

---

## Phase A recap (what you're committing — details in TASK_LOG, don't re-read the diff to summarise)

- `lib/gradeComputation.ts` — pure `computeRenormalizedGrade(cas) → ComputedGrade | null`. Equal-weight ⇒ mean of *present* CAs. 8 TDD tests.
- `convex/computedGrades.ts` — `computeGradesForStudent` is now a thin `requireRole(["admin","teacher"])` + audit wrapper over exported `recomputeGrade(ctx, args)` (shared with the migration). Denominator = Σ question `marksAllocated`. Uses `ctx.db.replace` (not `patch`). Zero present CAs → deletes the row. Keeps B.1 `standardLevelId`/`academicYear` populate + sets `expectedCaCount`.
- `convex/schema.ts` — `expectedCaCount` (optional) added; `assessmentWeightingRules` table removed.
- `convex/migrations.ts` — `recomputeAllGrades` (batchSize 25; deletes orphans, else recomputes). **Already ran on dev: `state: success`, processed 1300.**

---

## Critical carry-forwards for Phase B (these WILL bite if ignored)

1. **`expectedCaCount` is a compute-time SNAPSHOT — do not use it as the final/provisional gate.** For **B.3** (`getClassPositions` is "final-gated"), determine final-vs-provisional by reconciling **present CA count vs a LIVE `assessments.length`** fetch for that (subject, level, year, semester), NOT the stored `expectedCaCount`. (Backend Review made this a hard requirement; it goes stale if assessments are added after compute.) `expectedCaCount` is fine only for the "based on N of M" display label in Phase C.
2. **≥5 graded-peer floor** (DA #5): Class Average (B.2) and Class Position (B.3) render only when **≥5 students in the Class have a grade** for that subject+semester. Below that, return a "not enough class data yet" signal — don't compute a misleading average/rank.
3. **Position is final-gated + ties shared** (standard competition ranking: two tied 5th → both 5th, next 7th). Provisional grades are badged, **never ranked**.
4. **Class = level + year.** `section` is cosmetic — do NOT subdivide a Class by section.
5. **The index to use:** `computedGrades.by_level_year_subject_semester` (`[standardLevelId, academicYear, subjectId, semester]`) — one indexed `.collect()` returns a whole class for a subject+term. This is exactly what B.1 built it for. Still run **`convex-performance-audit`** on the aggregate queries (DA #3: read amplification) and bound reads.
6. **Present count is derived** from which `caXPercentage` fields are set on a row (no separate stored count).
7. **Class Average = mean of the renormalized `weightedAverage`** of students who have a Computed Grade for that subject+semester. **Per-CA baseline (B.4)** = mean of *present* students' percentages for that specific CA (`caNPercentage`), for Shape B's you-vs-class line.

---

## Phase B work (from TASK_LOG; ADR-0005 is the spec — pointers here are the extras)

| # | Task | Gate |
|---|------|------|
| B.2 | `getClassAverages(level, year, subject, semester)` → per-subject class avg + this-student delta; enforce ≥5 floor | Backend Review + perf audit |
| B.3 | `getClassPositions` → per-subject + overall rank; **final-gated (live assessments.length)**; ties shared | Backend Review + perf audit |
| B.4 | Per-CA class baseline (mean of present students' CA% per CA) for Shape B | Backend Review |
| B.5 | Cohort: `getGradeSpread` (A–F distribution) + `getStudentsNeedingHelp` (below 50%) | Backend Review |

**Mandatory gates (CLAUDE.md, enforced):** Devil's Advocate before building (any new query touching cross-student grade data) → Backend Review + `convex-performance-audit` before marking each done. Update `TASK_LOG.md` before/after. Follow backend rules: `requireRole` first, declared indexes for every `withIndex`, no unbounded `.collect()`, `Promise.all` batching, percentages server-side.

**Permissions to decide (raise in the DA pass):** these class-wide queries expose peers' grades in aggregate. Gate to `["admin","teacher"]`. A student seeing their *own* position/delta is a Phase C/UI concern — Phase B queries themselves should be admin/teacher, or explicitly scoped if a student-facing variant is needed. Confirm before building.

---

## ⚠️ Dev data state (matters for testing Phase B)

The dev deployment (`hushed-bass-123`) had **1300 orphaned `computedGrades`** (all deleted enrollments) — the A.4 migration **emptied the table**. `studentAssessmentAnswers` are also largely stale (deleted assessments / year-mismatched enrollments). **Consequence:** Phase B analytics will return empty / "not enough data" against current dev data. To actually exercise B.2–B.5 you need **coherent seed data — a Class of ≥5 students with computed grades** for one subject+term. Budget for seeding a fixture (student+enrollment+assessment+questions+marks per student, then run `computeGradesForStudent`), or extend `convex/seed.ts`. The Phase A recompute write path itself is verified (fixture check: 17/20 → 85% "A"; a real colliding CA gave 85%+99% → 92% "A+").

---

## Suggested skills

- **`commit`** — for STEP 1 (Sentry-style conventional commit).
- **`convex`** + **`convex-performance-audit`** — B.2/B.3 aggregate reads (read amplification is the named risk).
- **`devils-advocate`**, **`backend-agent`**, **`backend-review-agent`** (agents) — the mandatory gates per query.
- **`graphify`** — `graphify query` to navigate; `graphify update .` after code changes.
- **`tdd`** / **`superpowers:test-driven-development`** — extract any pure ranking/averaging/tie-breaking math into `lib/` helpers and drive red-green (worked well for A.1; positions + ties have clear edge cases: <5 peers, all-tied, provisional-excluded).
- **`playwright-cli`** — deferred to the eventual UI phase; Phase B is backend-only.

## First steps

1. **Commit Phase A** (STEP 1). Verify `git status` afterward.
2. Read ADR-0005 + the CONTEXT glossary (Class Average, Class Position, Provisional).
3. Planning/Devil's-Advocate pass on B.2–B.5 (permissions scope + ≥5 floor + final-gating).
4. Seed a ≥5-student Class fixture so the queries are testable.
5. Build B.2 → B.3 → B.4 → B.5, Backend Review + perf audit gating each. Stop; write the next handoff before Phase C (frontend).
