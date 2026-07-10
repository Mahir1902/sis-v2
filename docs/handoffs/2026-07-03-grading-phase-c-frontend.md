# Handoff — Grading Overhaul: Phase B done, implement Phase C (frontend)

**Date:** 2026-07-03
**Branch:** `review/grading-cards`
**Your job:** Implement **Phase C** — the individual Academic History tab, wired to the Phase B
analytics queries. (Phase D — the cohort view — can follow, or be split into its own handoff.)

---

## TL;DR

Phase A (grade math) and **Phase B (backend analytics)** are **done, committed, and Backend-Review
APPROVED.** Five read-only Convex queries now expose difficulty-adjusted analytics. Phase C is
pure frontend: render Shape A + Shape B + the overall-position headline, add provisional tags,
and delete the old "Improving/Declining" verdict. **The one hard blocker is test data** — see
"⚠️ You cannot see any of this work until you seed a class" below.

**Do not re-litigate the design.** ADR-0005, ADR-0004, and the CONTEXT glossary are locked. The
analytics semantics (≥5 floor, final-gating, ties, provisional) are all decided and already
enforced server-side — the frontend just renders the signals the queries return.

---

## What Phase B gives you — the query API contracts

All in `convex/computedGrades.ts`, all `requireRole(["admin","teacher"])`. Import via the generated
`api.computedGrades.*`. `standardLevelId` + `academicYear` come from the student's enrollment.

### `getClassAverages` — B.2 (Shape A: you-vs-class delta)
```
args:  { standardLevelId, academicYear, subjectId, semester: 1|2, studentId? }
→ { classAverage: number | null,        // null when suppressed (below the ≥5 floor)
    gradedCount: number,
    sufficient: boolean,                 // gradedCount >= 5
    student: { weightedAverage: number, delta: number | null } | null }  // delta null if suppressed
```

### `getPerCaClassBaseline` — B.4 (Shape B: you-vs-class line across CAs)
```
args:  { standardLevelId, academicYear, subjectId, semester: 1|2 }
→ { ca1: { mean: number, n: number } | null,   // per-CA, null when THAT CA has < 5 present students
    ca2: { mean, n } | null,
    ca3: { mean, n } | null }
```
Pair each CA baseline with the student's own `caNPercentage` (from their `computedGrades` row via
`getGradesByEnrollmentSemester`) to draw the two-line you-vs-class chart.

### `getClassPositions` — B.3 (per-subject + overall rank, for ONE student)
```
args:  { standardLevelId, academicYear, semester: 1|2, studentId }
→ { bySubject: Array<{ subjectId, subjectName, weightedAverage,
                       provisional: boolean,                     // ← use this for the C.1 tag
                       position: { rank: number, outOf: number } | null }>,  // null if provisional or <5 final peers
    overall: { rank: number, outOf: number } | null,            // ← the C.4 headline
    overallSuppressedReason: "not_graded" | "provisional" | "insufficient_peers" | null }
```
`bySubject[].provisional` is your ready-made provisional signal (present CAs < live assessment
count) — you do NOT need a separate query for C.1. When `overall` is null, show a short reason
from `overallSuppressedReason` instead of a rank ("provisional" → "ranks post when all subjects
are final"; "insufficient_peers" → "needs 5+ fully-graded classmates").

### `getGradeSpread` + `getStudentsNeedingHelp` — B.5 (Phase D cohort view)
```
getGradeSpread:        { standardLevelId, academicYear, semester?, subjectId? }
                       → { spread: { "A+","A","B","C","D","F": number }, total }
getStudentsNeedingHelp: { standardLevelId, academicYear, semester: 1|2, subjectId? }
                       → Array<{ studentId, studentName, subjectId, subjectName,
                                 weightedAverage, letterGrade }>   // sorted lowest-first
```

---

## ⚠️ You cannot see any of this work until you seed a Class (hard blocker)

Dev `computedGrades` is **empty** — the A.4 migration deleted 1300 orphaned rows and there was no
valid data behind them. Every Phase B query will return empty / `sufficient:false` / `overall:null`
against current dev data, so **the UI will render only empty states until you seed a coherent Class**:
≥5 students, same standard level + academic year, enrolled, with assessments (CA-1/2/3) + questions +
per-student marks, then run `computeGradesForStudent` for each. Budget a `convex/seed.ts` extension
or a one-off fixture mutation for this **first**, or you'll be building against blank screens. To see
the ≥5 floor and positions actually fire you need ≥5 graded students in one subject+semester; to see
a non-provisional grade, every CA the subject runs must be marked.

---

## Phase C tasks (from TASK_LOG.md — ADR-0005 is the spec)

| # | Task | Query to wire |
|---|------|---------------|
| C.1 | "Early/provisional" tags on grade cells | `getClassPositions` → `bySubject[].provisional` |
| C.2 | **Shape A** snapshot card: per-subject you-vs-class-average, ▲/▼ delta, per-subject position | `getClassAverages` (delta) + `getClassPositions` (position) |
| C.3 | **Shape B**: rework the subject chart → you-vs-class line across CA-1/2/3 | `getPerCaClassBaseline` + student's own `caNPercentage` |
| C.4 | Overall Class Position headline at top of tab | `getClassPositions` → `overall` / `overallSuppressedReason` |
| C.5 | Remove the "Improving/Declining" verdict; keep the cross-year line only as labeled raw history ("different years, different difficulty"), no judgment | — (deletion + relabel) |
| D.1 | Cohort view: level+year+subject+term selector → grade spread + who-needs-help list | `getGradeSpread` + `getStudentsNeedingHelp` |

**Mandatory gates (CLAUDE.md):** Devil's Advocate before building any new page/major component →
Frontend Review before marking each done. Update `TASK_LOG.md` before/after. Frontend rules:
loading/empty/error states on every data-fetch, shadcn primitives, no hardcoded colors, mobile-first,
Sonner toasts, no `any`, aria labels.

---

## Backend carry-forwards for Phase C (non-blocking, from Backend Review 2026-07-03)

1. **Label the cohort spread "current standing," not "final results."** `getGradeSpread` intentionally
   includes provisional grades (a live snapshot), so its counts are not final-gated like positions.
2. **The `≥5` floor and final-gating are already server-side** — do not re-implement them in the
   component. Just render `sufficient` / `position === null` / `overallSuppressedReason`.
3. **Deferred (not your problem unless the design changes):** narrowing `standardLevelId`/`academicYear`
   to required in schema (widen-migrate-narrow), and whether the overall headline should require a
   grade in *every* class subject (today "term-complete" = every subject the student has a grade in
   is final). Both are backend decisions — flag them, don't act on them in Phase C.

---

## Where the design + state live (read; don't duplicate)

| What | Path |
|------|------|
| Full plan + Phase A/B approvals + implementation notes | `TASK_LOG.md` → "Grading & Academic Analytics Overhaul" |
| Analytics spec (Shapes A/B/C, guardrails) | `docs/adr/0005-difficulty-adjusted-academic-analytics.md` |
| Grade math (Phase A) | `docs/adr/0004-grade-computation-model.md` |
| Glossary (Class, Class Average, Class Position, Provisional) | `CONTEXT.md` → "Grading & Academic Records" |
| Pure analytics math (rank/mean/spread) | `lib/gradeAnalytics.ts` (+ `.test.ts`) |
| The five queries | `convex/computedGrades.ts` → `// ─── Phase B` banner |

## First steps

1. Seed a ≥5-student Class fixture (the blocker above) so the tab renders real data.
2. Read ADR-0005 (Shape A / Shape B) + the CONTEXT glossary.
3. Devil's-Advocate + plan the Academic History tab rework (C.1–C.5).
4. Build C.2 → C.3 → C.4 → C.1 → C.5, Frontend Review gating each. Then D.1 (cohort view).
