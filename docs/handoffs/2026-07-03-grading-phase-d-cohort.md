# Handoff — Grading Overhaul: Phase C done, implement Phase D (cohort view)

**Date:** 2026-07-03
**Branch:** `review/grading-cards`
**Your job:** Implement **Phase D** — the cohort "one class view" (task **D.1**): a level + year + subject + term
selector that renders a **grade spread** (A+…F distribution) and a **who-needs-help** list (< 50%). This is a
**new standalone admin page**, wired to two Phase B queries that already exist and are Backend-Review-approved.

---

## TL;DR

Phases **A (grade math)**, **B (analytics queries)**, and **C (individual Academic History tab)** are all **done**.
Phase C landed this session — TDD'd, Frontend-Review APPROVED, `next build` green, and **live-verified in the browser**
against a seeded demo class. Phase D is a fresh page: no new backend needed (both queries are built), so it's pure
frontend + one selector bar + one bar chart + one list. **Do not re-litigate the design** — ADR-0005's cohort section
and the CONTEXT glossary are locked. Two hard prep items before you can see it work: (1) the seed fixture's lowest grade
is ~60%, so the who-needs-help list will render **empty** until you add a below-50 grade; (2) pick the page route + add
the sidebar entry.

---

## What's already done (reference — do NOT rebuild)

| Thing | Where |
|-------|-------|
| Full plan, per-phase status, **Phase C Implementation Notes**, DA findings, carry-forwards | `TASK_LOG.md` → "Grading & Academic Analytics Overhaul" |
| Analytics spec — **cohort view = grade spread + below-50 list** (Shapes A/B are Phase C) | `docs/adr/0005-difficulty-adjusted-academic-analytics.md` (cohort at ~lines 31–33, 60–62) |
| Grade math (Phase A) | `docs/adr/0004-grade-computation-model.md` |
| Glossary (Class, Class Average, Class Position, Provisional) | `CONTEXT.md` → "Grading & Academic Records" |
| The two Phase D queries (built + reviewed) | `convex/computedGrades.ts` → `// ─── Phase B` banner |
| Pure analytics math (`gradeSpread`, `mean`, `rankStandardCompetition`) | `lib/gradeAnalytics.ts` (+ `.test.ts`) |
| **Phase C** individual-tab work + reusable patterns (see below) | `TASK_LOG.md` Phase C notes + the files below |
| Prior handoff (has the same query contracts + the fixture blocker rationale) | `docs/handoffs/2026-07-03-grading-phase-c-frontend.md` |

**Git state:** All Phase C work is **uncommitted** on `review/grading-cards` (new `_components/*`, `lib/academicHistoryView.ts`,
`vitest.config.ts`, `vitest.setup.ts`, `convex/_seedGradingFixture.ts`, RTL deps in `package.json`). Decide with the user
whether to commit Phase C before starting D, or bundle both.

### Phase C recap (what shipped this session, for pattern reuse)

Container/presentational split, TDD, all Frontend-Review APPROVED. **Reuse these patterns for Phase D:**
- `lib/academicHistoryView.ts` — a **pure view-model** (27 tests) holding all copy/formatting/data-shaping logic so
  components stay dumb and testable without Convex. Phase D should have its own equivalent (e.g. `lib/cohortView.ts`).
- `app/(dashboard)/students/[studentId]/_components/AcademicHistoryTab.tsx` — the **container**: owns `useQuery` + state,
  passes plain props down. Your cohort page is the analogous container.
- `_components/PerCaClassChart.tsx` — the **only Recharts example built to be test-safe under jsdom** (assert on text/roles,
  never SVG geometry). Copy its approach for the grade-spread bar chart.
- `OverallPositionHeadline.tsx`, `ClassComparisonCard.tsx` — presentational-with-states examples (loading/empty/suppressed).
- **RTL harness is set up**: `vitest.config.ts` (jsdom, `@` alias), `vitest.setup.ts` (**global `afterEach(cleanup)`** — do
  NOT re-add per file), `@testing-library/*` + `jsdom` installed. Pure tests in `lib/*.test.ts`, component tests co-located
  as `*.test.tsx`. `npm test` runs all (currently **220 passing**).

---

## Phase D — the query API contracts (already built)

Both in `convex/computedGrades.ts`, both `requireRole(["admin","teacher"])`, both take `academicYear` as an
**`Id<"academicYears">`** (NOT a name string — same gotcha as Phase C). No ≥5 floor on either. **`getGradeSpread`
intentionally includes provisional grades** — label the UI **"current standing," not "final results."**

### `getGradeSpread` — B.5a
```
args: { standardLevelId, academicYear, semester?: 1|2, subjectId? }   // semester + subject OPTIONAL
→ { spread: { "A+","A","B","C","D","F": number },   // six zero-filled buckets (see lib/gradeAnalytics.ts gradeSpread())
    total: number }
```

### `getStudentsNeedingHelp` — B.5b
```
args: { standardLevelId, academicYear, semester: 1|2, subjectId? }    // semester REQUIRED, subject OPTIONAL
→ Array<{ studentId, studentName, subjectId, subjectName, weightedAverage, letterGrade }>  // < 50%, lowest-first
```

Selector data sources (existing queries): `api.standardLevels.list`, `api.academicYears.list`, `api.subjects.list`.
See `app/(dashboard)/admin/promotions/page.tsx` and `app/(dashboard)/admin/assessments/page.tsx` for existing
level/year/subject selector patterns to copy.

---

## Suggested D.1 build plan

1. **Page + route.** New admin-only page following the `/admin/{assessments,promotions,audit-log}` pattern. Suggested
   route: `app/(dashboard)/admin/class-analytics/page.tsx` (or `/admin/cohort` — your call; confirm the name). Wrap in the
   existing `RoleGate` admin guard.
2. **Selector bar** (container state): standard level (required), academic year (required), term/semester (default 1),
   subject (optional — "All subjects"). The two queries `"skip"` until level + year (+ semester for needs-help) resolve.
3. **Grade spread** → a Recharts `BarChart` of the six A+…F buckets + `total`. Title/caption = "current standing"
   (includes provisional). Copy `PerCaClassChart`'s jsdom-safe structure.
4. **Who-needs-help list** → a simple table/list of the returned rows (student, subject, weighted %, letter grade),
   lowest-first. Empty state: "No students below 50% for this selection."
5. **Sidebar entry** — add to the Administration group in `components/layout/Sidebar.tsx` (admin-only), mirroring how
   `AL-6` added the Audit Log link (lucide icon + `{ href, label, icon }`).
6. **Pure view-model** (`lib/cohortView.ts` + test) for any shaping logic (e.g. spread → chart series, ordered bucket
   list, count labels) — TDD it, keep the page presentational.

---

## Blockers / prep before you can see it work

- **Who-needs-help renders EMPTY against the current fixture.** The seeded demo class (KG-2 / 2025-26 / Sem 1, in
  `convex/_seedGradingFixture.ts`) has term averages ~60–86% and no subject grade below 50%, so `getStudentsNeedingHelp`
  returns `[]`. To exercise that list, **extend the fixture** with one student who has a subject grade < 50% (mark them low
  on all CAs of one subject), then re-run. The **grade spread** WILL populate (buckets across ~C/B/A) without changes.
- **Fixture IDs change on reset.** Re-run / reset:
  `npx convex run _seedGradingFixture:seedGradingFixture '{"reset": true}'` — then read the returned payload for the
  current `standardLevelId` / `academicYearId` / subject IDs. The fixture is **dev-only and disposable** (delete when done).
- **Confirm the page route name + sidebar label** with the user (or via the Devil's Advocate pass).

---

## Mandatory gates (CLAUDE.md) + suggested workflow

- **Devil's Advocate BEFORE building** — this is a new page (a mandatory DA trigger). Probe: selector-not-yet-chosen state,
  the empty who-needs-help vs. empty grade-spread states, semester required for one query but optional for the other,
  "all subjects" (no subjectId) behavior, mobile layout of the bar chart + list.
- **Frontend Review** gates D.1 before it's marked `[x]`.
- **Testing:** Phase C used **Full TDD incl. component tests** (Vitest + RTL). Continue that precedent unless the user
  says otherwise — pure view-model TDD'd first, presentational components component-tested, container verified live.
- **Verify** at the end: `tsc --noEmit` + `biome check` + `vitest` + **stop dev, then `next build`, then restart dev**
  (see gotcha below) + live Playwright pass + `graphify update .`. Update `TASK_LOG.md` (mark D.1, add impl notes).

---

## Gotchas carried forward (bit us in Phase C)

- ⚠️ **Never run `next build` while `next dev` is live** — it corrupts `.next/dev` and every route 500s (not a code bug).
  Stop dev first, build, restart dev. To validate a change while dev runs, use `tsc`/`biome`/`vitest` (they don't touch
  `.next`) and let dev HMR. (Saved to project memory.)
- `academicYear` on enrollments/grades is an **`Id<"academicYears">`**, never a name string — pass it verbatim.
- **Recharts + jsdom**: `ResponsiveContainer` measures 0×0; component tests must assert on text/roles, not SVG paths.
- RTL is `globals: false` → cleanup is registered **once** globally in `vitest.setup.ts`; don't re-add `afterEach(cleanup)`
  per file.
- Both Phase D queries are **staff-only** (`requireRole(["admin","teacher"])`) — the page is admin-only anyway.

## Carry-forwards NOT part of Phase D (flag, don't fix here)
- **Student-role access to the individual Academic History tab** — pre-existing (the tab already called a staff-only
  query before Phase C). Design decision needed separately: should students see class rank?
- Non-blocking Phase C polish (delta a11y name, aria-label over data-testid in tests) — see TASK_LOG Phase C review notes.

---

## Suggested skills to invoke

- **`writing-plans`** / the **planning-agent** — break D.1 into atomic sub-tasks, update `TASK_LOG.md`.
- **`devils-advocate`** (agent) — mandatory before the new page; stress-test the selector/empty states.
- **`frontend-design`** — read before building the new page UI (per CLAUDE.md).
- **`shadcn`** — Card / Select / Table primitives for the selector bar + list.
- **`superpowers:test-driven-development`** (or `tdd`) — continue the Full-TDD precedent from Phase C.
- **`vercel-react-best-practices`** + **`next-best-practices`** — page/component structure.
- **`playwright-cli`** (or `verify`) — live visual verification against the (extended) fixture.
- **`convex-performance-audit`** — only if you end up touching the queries (you shouldn't; they're built + reviewed).

## First steps
1. Read ADR-0005 cohort section + the Phase D query signatures above.
2. Extend `convex/_seedGradingFixture.ts` with a below-50 student, re-seed, grab fresh IDs.
3. Planning + Devil's-Advocate the cohort page (route name, states, layout).
4. TDD the `lib/cohortView.ts` helpers → build the page (selector → grade-spread bar chart → who-needs-help list) →
   sidebar entry → Frontend Review → verify.
