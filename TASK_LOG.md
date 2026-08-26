# SIS v2 Task Log

---

## Current Feature: Import transform — derivations, validation, warnings (issue #96) (2026-08-07)
**Status**: ✅ COMPLETE — `tsc --noEmit` clean · `biome check` clean · `npm run build` clean · 400/400 unit tests green (80 in `studentImportMapping.test.ts`)
**Active Agent**: BACKEND AGENT — issue #96 of map #80 (spec §2, §3, §11, §12)

Second half of the pure transform module started in #94. Everything lands in
`lib/studentImportMapping.ts` — one seam, no new file — because derivation and validation
read the same raw rows the mapping table already walks.

### Sub-tasks
- [x] 1. **Derivations (R1–R6)** — `parseStudentNumber` (`S{MM}{YY}-{seq}`, MM 01–12),
      `derivedAcademicYearName` (June cutoff), `toUtcMidnightMs` / `formatUtcDate`.
      Dates convert once, to **UTC midnight** — tests pass under `TZ=Asia/Dhaka` and
      `TZ=America/New_York`. `classStartDate` is sheet-only; `admissionDate` mirrors it and
      is never `Date.now()`.
- [x] 2. **Precedence (R6)** — a filled cell beats a derived value, silently. Derivation
      runs only where the raw cell text was `null`, so `S0221-0969` imports as its stated
      2021-2022 with **no warning**.
- [x] 3. **Rejections (§3.2)** — declarative `required` / `unrecognised` reasons on the
      column-mapping table, so every mapped column's failure mode is stated where the
      column is defined. All failures in a row are collected, never just the first.
- [x] 4. **Whole-file aborts (§3.2)** — `ImportPreview.fileError` for an in-file duplicate
      student number and for a file where no tab survives header validation. One bad tab
      stays a tab-level rejection.
- [x] 5. **Warnings (§3.5)** — closed list of three, `code: 1 | 2 | 3`. Never block.
- [x] 6. Tests: 41 → 83 in `lib/studentImportMapping.test.ts`, one per §12 fixture row.
- [x] 7. `/code-review` (Standards + Spec axes, parallel). Three findings applied:
      **(spec)** warning 2 was counting a key field blank when its *column was missing
      from the tab* — §3.5 rules that out by name ("every row would carry an identical
      warning; that is not information"). Now only present-but-blank cells count.
      **(spec)** a student number that is malformed on two rows was aborting the whole
      file; both rows are already rejected on their own, so it no longer does.
      **(standards)** `fileAbort` → `fileErrorOf` (matches the `xOf` idiom and the field
      it fills), duplicate level transform extracted to `levelNameOf`, three exports with
      no consumers made module-private, a `findIndex` that could silently return `-1`
      routed through `fieldOf`, one stale doc comment corrected.

### Decisions made here (not pre-decided by the spec)
- **Warning 2's key-field set and threshold.** `KEY_FIELDS` = name, gender, DOB, birth-reg
  number, present address, both parent phones; threshold **3**. `EMAIL`, `PASSPORT NUMBER`
  and `CLASS STARTING DATE` are deliberately excluded — they are blank on nearly every
  sample row, so counting them would fire the warning on all 30, which is exactly the noise
  the closed list exists to avoid. Fires on 0/30 sample rows today.
- **Accepted date shapes.** `YYYY-MM-DD` (what `cellText` makes of a parsed `Date`) and a
  bare Excel day serial. `10/07/2024` rejects rather than guessing DD/MM vs MM/DD, and
  `2024-02-31` rejects instead of rolling into March.
- **A malformed `STUDENT ID` keeps its raw text** on `PreviewRow.studentNumber` so the
  rejection is findable in the sheet; §3.4's "blank when that *is* the failure" applies to
  the genuinely empty cell.
- **Warnings are computed on rejected rows too** — one code path, and a rejected row is
  never written either way.

### One deliberate deviation from the spec, flagged
§3.2 calls its table "the complete rejection list" and `CLASS STARTING DATE` is not on it,
but an unreadable value there rejects the row here. The ticket's own governing rule is
emphatic — "the governing rule **everywhere**: … present but unrecognisable → reject the
row" — and the alternative is silently dropping a date the school typed, which is the one
thing §3.1 says never happens ("never silently dropped"). It also feeds `admissionDate`.
Reverting is a one-line change: drop `unrecognised` from the `classStartDate` mapping.

### Out of scope (later tickets)
- Epoch-ms conversion at the commit boundary reuses the exported `toUtcMidnightMs`;
  `PreviewField.value` stays a display string (#97).
- Issues CSV, filter chips and the `severity` column are the surface's (#98).

---

## Current Feature: Widen `students` schema for Excel import + fix type blast radius (issue #93) (2026-08-07)
**Status**: ✅ COMPLETE — 30/30 blast-radius errors cleared · root + convex `tsc --noEmit` clean · `npm run lint` clean · 307/307 unit tests green
**Active Agent**: BACKEND AGENT — resolved issue #93 of map #80 (spec §6.1, §6.3)

Applies `docs/wayfinder/excel-import/tickets/assets/0086-schema.diff` verbatim: 29 `students`
fields required → optional (all but `studentNumber`, `standardLevel`, `academicYear`,
`createdAt`), three new optional admission-fact fields, `by_student_number` index, and
`enrollments.campus` widened. Backward-compatible widen — no `@convex-dev/migrations` cycle.

### Sub-tasks
- [x] 1. Applied `0086-schema.diff` verbatim via `git apply` — 29 fields widened,
      3 admission-fact fields added, `by_student_number` index, `enrollments.campus` widened.
      Baseline measured first: exactly 30 errors, matching §6.3's table file-for-file.
- [x] 2. Fixed all 30 sites across 9 files + 3 collateral files whose narrow prop/interface
      types were the actual root cause (`StudentHeader.tsx`, `lib/resolveBillingContact.ts`,
      `lib/launcherDisabled.ts`). No placeholder values introduced anywhere.
- [x] 3. Verified — root `tsc --noEmit` clean, `tsc -p convex` clean, `biome check` clean,
      `vitest --project unit` 307/307. (`npm run build` deferred to the coordinator.)

### How each absent field degrades
| Site | Behaviour when the field is unset |
|---|---|
| `students.campus` → `campusDoc` | resolves to `null`; UI omits the campus chip / shows "—" |
| sibling `standardLevelName` / `campusName` | returned undefined; sidebar joins only what exists |
| `transactionLog` student name | map value nullable; existing "Unknown Student" label fires |
| `searchStudents` / student-fees search | an unnamed student never matches a *name* query (still findable by number) |
| `collectFees` | **refuses to issue the receipt** — a frozen payer/student name is never invented |
| sidebar dates (DOB/admitted/class-start/created) | `formatDate()` → em-dash, never "Invalid Date" |
| sidebar + header parent names | em-dash avatar + muted "Not recorded" |
| sidebar + header phones | no `tel:` link rendered at all (no `tel:undefined`) |
| sidebar `healthIssue` | "Not recorded" — never asserts the medical claim "No issues" |
| `EditStudentDialog` dates | pre-fills ""; `studentInfoSchema.min(1)` blocks save until filled |
| `EditStudentDialog` health checkbox | form value stays genuinely undefined; `z.boolean()` blocks save |
| `StudentHeader` status | "Unspecified" pill (temporary — folds into `StatusBadge` under #95) |

### Out of scope (owned by sibling tickets) — deliberately left alone
- `convex/seed.ts` + academic-year backfill mutation → #92
- `lib/` import-transform modules → #94
- §6.4 silent sites → #95. Specifically **still live**: the
  `data={students as unknown as StudentRow[]}` double cast in `students/page.tsx`, and
  `columns.tsx:49 getInitials(row.original.studentFullName)` behind it, which throws on an
  unnamed student. Nothing can reach that state until the importer lands, but #95 must ship
  before the first import runs.

---

## Current State (2026-04-05 — POST-AUDIT RESET)

All code from Phases 1–3 and partial Phase 4 was written WITHOUT:
- Agent declarations
- Backend Review Agent approval
- Frontend Review Agent approval
- TASK_LOG.md updates per sub-task
- Playwright E2E verification

This reset establishes proper tracking. All existing code goes through review before any
new feature work begins.

---

## Feature: Academic-year seed range + idempotent backfill (issue #92, excel-import §6.2/§14) (2026-08-07)
**Status**: ✅ DONE — pending Backend Review Agent approval
**Active Agent**: BACKEND AGENT

- `convex/seed.ts` — extracted the year list to a module-level `ACADEMIC_YEAR_DEFS`
  (shared by both paths so they cannot drift) and extended it from 2019-2020 → 2025-2026
  to **2015-2016 → 2026-2027**. `seedReferenceData` now loops over it.
- New admin-gated `seed:backfillAcademicYears` mutation — reads existing `academicYears`
  names into a `Set` and inserts only the missing ones with the same
  `${start}-06-01` / `${end}-07-31` convention. Idempotent; returns
  `{ inserted: string[]; skipped: number }`. `requireRole(ctx, ["admin"])` is the first line.
  Needed because `seedReferenceData` early-returns on **any** existing `academicYears` row,
  so editing the seed list alone is a no-op on staging and production.
- `docs/wayfinder/staging-uat/DEPLOYMENT-PREREQUISITES.md` — new; records the order
  schema deploy → backfill → first import for map #62, incl. how to invoke an admin-gated
  mutation (dashboard function runner acting as an admin; `npx convex run` is unauthenticated).
- Verified: `npx tsc --noEmit -p convex/tsconfig.json` clean for `seed.ts` (remaining errors
  are the schema-widening blast radius owned by #93); `npm run lint` clean. Build deferred to
  the coordinator. `convex/schema.ts` untouched.

---

## Current Feature: Longitudinal grade-history fixture (wayfinder grade-charts, ticket 0007) (2026-07-10)
**Status**: ✅ COMPLETE (2026-07-10) — dev DB seeded + verified · convex tsc clean · one ticket per wayfinder session
**Active Agent**: WAYFINDER (work-through-the-map) — resolved ticket 0007 of `docs/wayfinder/grade-charts/MAP.md`

New disposable dev fixture `convex/_seedLongitudinalHistory.ts` (reset key `LONG-`,
independent of the `FIX-` analytics fixture) giving the two planned trajectory charts
real data. Grades written only via `recomputeGrade` (ADR-0004); each `(level, year)`
probed-or-thrown before writing.
Run: `npx convex run _seedLongitudinalHistory:seedLongitudinalHistory '{"reset": true}'`

- **Cohort (ticket 0005):** Grade 12 across 2022-23/23-24/24-25, 20 students/year, both
  semesters, 3 subjects → 360 grades; verified 20 graded students per (year, semester).
- **Individual (ticket 0002):** Grade 9→10→11 promotion chain across 2019-20/20-21/21-22,
  6 students, both semesters → 108 grades; exemplar `LONG-chain-001` = 18 grades / 6 career
  points spanning 3 levels.
- **Platform note:** `recomputeGrade` scans the whole `(subject,semester)` assessment slice
  (~190 rows; DB has 2222 assessments), so ~470 calls in one mutation exceed the 32k-doc
  read limit. Split into one mutation per class-term, orchestrated by an `internalAction`.
- Closed ticket 0007 → unblocks trajectory-design tickets 0002 + 0005 (now on the frontier).

---

## Current Feature: Grading-analytics fixture — spec module + seed + convex-test (2026-07-07)
**Status**: ✅ COMPLETE (2026-07-07) — 10/10 convex-test cases green · 252 total tests · tsc (root+convex) clean · biome clean · dev DB seeded
**Active Agent**: CODING AGENT (built directly per `docs/handoffs/HANDOFF_grading_fixture.md` — scope pre-grilled, no Planning/DA flow)

Replaces the toy 8-student `_seedGradingFixture.ts` with a dual-purpose fixture that
(a) exercises every ADR-0005 analytics edge case and (b) is a believable demo. ONE shared
case-spec module feeds BOTH a dev seed mutation and a `convex-test` assertion file.

### Sub-tasks
- [x] 1. `convex/_gradingFixtureSpec.ts` — shared plain-data specs for 6 classes + `buildClass(ctx, spec)` (reused verbatim by seed + test; writes grades via exported `recomputeGrade`). Demo marks are deterministic (latent ability + subject offset + hashed noise, no `Math.random`); edge marks hand-set.
- [x] 2. `convex/_seedGradingAnalytics.ts` — supersedes `_seedGradingFixture.ts` (deleted). Owns the `FIXTURE — edge cases` year, **probes-or-throws** the 2 demo levels in `2025-2026`, `{reset:true}` wipes `FIX-` students + fixture year. Seeded OK: strong=63 grades (66−3 ungraded), weak=66, edges 4/5/5/6. Weak level probed → `NUR`.
- [x] 3. `convex/computedGrades.analytics.test.ts` — all 10 states asserted against the real handlers. Added `convex-test` + `@edge-runtime/vm` dev deps; `vitest.config.ts` split into `unit` (jsdom) + `convex` (edge-runtime) projects.
- [x] 4. Verify — `npm test` 252 green · convex project 10/10 · `tsc --noEmit` root+convex clean · biome clean · dev seed succeeded. (Authenticated browser eyeball of the two demo spreads = one manual step for user; `next build` skipped — `next dev` was live, .next-corruption gotcha.)

### The 10 states → where
Demo-strong (KG2/2025-2026): #2 ≥5 graded, #3 top tie (idx 0/1 rank 1,1; idx 2 rank 3), #5 provisional (idx 20 skips Math CA-3), #8 A+→F spread, #10 fully-ungraded (idx 21). Demo-weak (NUR/2025-2026): #9 needs-help lowest-first. Edge year: #1 exactly-4 peers, #4 5-with-1-withdrawn (exitDate → activeRows 5→4), #6 stale `expectedCaCount` (live count wins → provisional), #7 per-CA independent ≥5 floor.

### Notes
- Isolation gotcha handled: edge classes each own a distinct level in a fresh year (pristine by construction); demo levels probed-or-throw before seeding.
- Old `_seedGradingFixture` removed from repo + deployment; `npx convex codegen` + `convex dev --once` refreshed `_generated` and the dev deployment.

---

## Current Feature: Phase D — Cohort "one class view" (D.1) (2026-07-03)
**Status**: ✅ COMPLETE (2026-07-03) — Frontend-Review APPROVED · build/tsc/biome/242 tests green · one manual authenticated visual pass pending for user
**Active Agent**: CODING AGENT (orchestrating)

Phase C committed as `a16ec99`. Phase D is a **new admin-only page** (mandatory DA trigger).
No new backend — both queries (`getGradeSpread` B.5a, `getStudentsNeedingHelp` B.5b) are
built + Backend-Review-approved. Route (default, DA may challenge):
`app/(dashboard)/admin/class-analytics/page.tsx`; sidebar label "Class Analytics".

### D.1 sub-task breakdown
- [x] D.1a — Extend `convex/_seedGradingFixture.ts` with one student scoring <50% in a subject so `getStudentsNeedingHelp` returns rows; re-seed, capture IDs — BACKEND AGENT (DONE 2026-07-03). Added student 8 "Hasan Mahmud": Math 35.00% (F, class low), English 65.00% (C). Verified: getStudentsNeedingHelp returns Hasan Math 35 first, then Gulnaz Math 48; getGradeSpread total=17 (A+2 A3 B3 C4 D3 F2). IDs change per reset — see fixture return payload.
- [x] D.1b — Devil's Advocate DONE — route/label locked `/admin/class-analytics` "Class Analytics"; 9 findings, 6 locked mitigations folded into D.1c/D.1d specs below — DEVIL'S ADVOCATE ✓
- [x] D.1c — `lib/cohortView.ts` pure view-model (TDD, 16 tests): `buildGradeSpreadSeries`, `gradeCountLabel`, `cohortState` (5-way tag), `groupNeedsHelpByStudent`, `CURRENT_STANDING_TITLE/SUBTITLE` + copy constants — FRONTEND AGENT ✓
- [x] D.1d — Built page `app/(dashboard)/admin/class-analytics/page.tsx` + `_components/{GradeSpreadChart,NeedsHelpList}` (RoleGate admin · 4 selectors · BarChart "Current Standing" · grouped/flat needs-help list) — FRONTEND AGENT ✓
- [x] D.1e — Sidebar "Class Analytics" (BarChart3 icon, Administration group, admin-only) — FRONTEND AGENT ✓
- [x] D.1f — Frontend Review — APPROVED by FRONTEND REVIEW AGENT (2026-07-03): all 7 DA mitigations confirmed, 242/242 tests green, tsc clean, biome 0 errors
- [x] D.1g — Verify DONE (2026-07-03): `next build` ✓ (18 routes incl. `/admin/class-analytics`; stopped dev → built → restarted per gotcha) · `tsc --noEmit` clean · `biome` 0 errors · `vitest` 242/242 · `graphify update .` ✓ · live: unauth GET `/admin/class-analytics` → **307 → /login** (route compiles + protected). Authenticated visual pass = one manual step for user (agent has no admin password) — CODING AGENT ✓

### DA mitigations (locked — MUST implement in D.1c/D.1d)
1. Route `/admin/class-analytics`, sidebar "Class Analytics", RoleGate admin.
2. **Semester ALWAYS passed (default 1) to BOTH queries** — never `undefined` to `getGradeSpread` (silent full-year vs Sem-1 divergence). Comment the constraint.
3. Four empty states in `cohortView.ts`: (a) no grades at all, (b) grades exist but none <50% → good-news copy, (c) no grades for selected subject, (d) all passing for subject. (b)/(d) must NOT say "no data yet".
4. "All subjects" (no subjectId) needs-help list **groups by studentId** — each student once, failing subjects listed under them. Flat list only when a specific subject is selected.
5. Chart title **"Current Standing"**; visible subtitle "Includes grades in progress — not final results." — export the subtitle as a constant from `cohortView.ts`. "Results" banned as a label.
6. **Exactly two `useQuery` calls** on the page — no per-subject query in a `.map` (the Phase C fan-out/Rules-of-Hooks trap). Comment the constraint.
7. Mobile (375px): fixed chart height, list collapses to name+grade% with subject as subtitle.

### D.1 fresh fixture IDs (KG-2 / 2025-2026 / Sem 1 — dev; change on every reset)
- standardLevelId `jd7drfwb9xkk26acergv7qvsp5755hhg` · academicYearId `kn70z6jped8s0b5gzhfqjk1n95826ayt` · campusId `ks70wesz8dx5myvane36cy306d82719g`
- Mathematics `m97cna5vjpn8037nvk9jdmppzx827k0x` · English `m97bh81b00pyw11z2v8dspxwmh826gff` · Science `m9744qeehqbp9j44erqybt9b4982790z` · needs-help student (Hasan Mahmud) `j573qtk3gvb6b8egm67pyh53q189vh67`

---

## Current Feature: Phase C — Integrate C.1–C.5 into AcademicHistoryTab container (2026-07-03)
**Status**: ✅ APPROVED by FRONTEND REVIEW AGENT (2026-07-03) — committed `a16ec99`
**Active Agent**: FRONTEND REVIEW AGENT

### Sub-tasks (this session) — all DONE, awaiting FRONTEND REVIEW
- [x] C-INT-0 TDD `buildSubjectRowSeeds` in `lib/academicHistoryView.ts` (+ 4 tests) — join getClassPositions.bySubject with semester grade rows — DONE — awaiting FRONTEND REVIEW (red→green confirmed; 27/27 in that file)
- [x] C.1 `ClassComparisonCard` wired into container (rows from `buildSubjectRowSeeds`, `queryArgs` from analyzeEnrollment) — DONE — awaiting FRONTEND REVIEW
- [x] C.2 `buildSubjectRowSeeds` join used to seed comparison rows — DONE — awaiting FRONTEND REVIEW
- [x] C.3 `PerCaClassChart` wired (`buildPerCaChartData` from `getPerCaClassBaseline` + selected semester grade row; all-null fallback) — DONE — awaiting FRONTEND REVIEW
- [x] C.4 `OverallPositionHeadline` wired (`positions.overall` / `positions.overallSuppressedReason`, loading via `=== undefined`) — DONE — awaiting FRONTEND REVIEW
- [x] C.5 Deletions: `getTrend`, `TrendIcon`, "Overall Trend" cell (+ old `SubjectStats`), `EnrollmentPerformanceCard` trend chip — DONE — awaiting FRONTEND REVIEW
- [x] Semester toggle (Sem 1 / Sem 2, `aria-pressed`, brand colors), `analyzeEnrollment` resolution, longitudinal card demoted to "Raw score history" with not-comparable caption — DONE — awaiting FRONTEND REVIEW

### Review Notes (C.1–C.5 integration — pending FRONTEND REVIEW)
**Files touched:**
- `lib/academicHistoryView.ts` — added `buildSubjectRowSeeds` (+ `PositionBySubject`/`SubjectGradeRow` types)
- `lib/academicHistoryView.test.ts` — added 4 `buildSubjectRowSeeds` tests (all-present / partial / no-matching-row / order)
- `app/(dashboard)/students/[studentId]/_components/AcademicHistoryTab.tsx` — full rework (container wiring)

**C.5 deletions (verified: grep for getTrend/TrendIcon/"Overall Trend"/Improving/Declining/Stable/Trending*/SubjectStats/trend → CLEAN):**
- Deleted file-local `getTrend()` and `TrendIcon` (no external importers — grep-confirmed).
- Deleted the old `SubjectStats` component entirely (it only existed to render the longitudinal stats incl. the "Overall Trend" cell; its role is superseded by `PerCaClassChart`). No "Average/Highest/Lowest" summary was retained — the Shape B per-CA chart replaces it.
- Removed the trend chip + `trend` prop from `EnrollmentPerformanceCard`; it now shows only Sem 1 / Sem 2 averages, grade distribution, and top/bottom subjects.

**Composition order (top → bottom):**
1. Header row + semester toggle (`<fieldset>` + sr-only `<legend>`; two `Button`s with `aria-pressed`, active = `bg-school-green text-white`).
2. `OverallPositionHeadline` (C.4) — `loading={positions === undefined}`.
3. `ClassComparisonCard` (C.1 + C.2) — only rendered when `analyzeEnrollment` exists; `rows = buildSubjectRowSeeds(positions.bySubject, semesterGrades)` (empty until both resolve); `loading = positions===undefined || semesterGrades===undefined`.
4. Subject selector (`Select`, `aria-label`) — defaults to first subject graded this semester; drives both charts.
5. `PerCaClassChart` (C.3) — `chartData = buildPerCaChartData(baseline, selectedGradeRow)` or all-null fallback; `loading = semesterGrades===undefined || baseline===undefined`.
6. Demoted `Raw score history` card (cross-year `getLongitudinalSubjectPerformance` LineChart) — caption "Different years, different difficulty — not directly comparable"; no trend verdict.
7. Enrollment accordion (raw history) — trend chip stripped.

**analyzeEnrollment + query-skip logic (C-4 mitigation):**
- `analyzeEnrollment = currentEnrollment ?? enrollmentHistory?.[0] ?? null` (history newest-first).
- Empty state ("No Academic History") only when `!analyzeEnrollment && no history`.
- `academicYear` passed verbatim as `Id<"academicYears">` (never a name string).
- `getClassPositions`/`getGradesByEnrollmentSemester` use `"skip"` until `analyzeEnrollment` + its ids resolve; `getPerCaClassBaseline` additionally skips until a subject is selected.

**Verification:** `npm test` 220/220 (216 baseline + 4 new). `npm run build` PASS (17 app routes + Proxy Middleware). `npm run lint` (Biome) 0 errors / 210 files. `npx tsc --noEmit` clean.

**Deviations:** (1) Semester toggle uses `<fieldset>`+`<legend class="sr-only">` instead of a `role="group"` div — Biome `a11y/useSemanticElements` rejects a redundant role on a generic div; fieldset/legend is the true semantic grouping and keeps the accessible label. (2) Extracted the post-guard render into an inner `AcademicHistoryContent` component so the `useMemo` join hooks live above a non-null `analyzeEnrollment` narrowing without Rules-of-Hooks issues.

### 🔍 FRONTEND REVIEW — Phase C (C.1–C.5) — ✅ APPROVED (2026-07-03)

**Reviewer:** FRONTEND REVIEW AGENT
**Verdict:** APPROVED — no blocking (🔴) issues. 3 non-blocking (🟡) suggestions recorded for future work.

**Files reviewed:**
- `lib/academicHistoryView.ts` + `lib/academicHistoryView.test.ts`
- `app/(dashboard)/students/[studentId]/_components/OverallPositionHeadline.tsx` + `.test.tsx` (C.4)
- `app/(dashboard)/students/[studentId]/_components/ClassComparisonCard.tsx` + `.test.tsx` (C.1 + C.2)
- `app/(dashboard)/students/[studentId]/_components/PerCaClassChart.tsx` + `.test.tsx` (C.3)
- `app/(dashboard)/students/[studentId]/_components/AcademicHistoryTab.tsx` (container)
- `vitest.config.ts` + `vitest.setup.ts` (RTL harness)

**Verification (independently re-run, not trusted from prior report):**
- `npm test` → **25 files, 220/220 passed** (0 fail). ✓
- `npm run lint` (`biome check`) → **0 errors, 210 files checked**. ✓
- `npm run build` → **PASS** (all app routes + Proxy Middleware compiled, exit 0). ✓
- C.5 grep (`getTrend`/`TrendIcon`/`Improving`/`Declining`/`Stable`) across all C components + view lib → **CLEAN (none found)**. ✓ Cross-year line survives only as relabeled `Raw score history` with "Different years, different difficulty — not directly comparable." caption (AcademicHistoryTab.tsx:350-355) — no verdict text.

**Checklist result:**

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Loading skeletons (container + each component, `=== undefined`) | ✅ PASS | Tab initialLoading skeletons (AcademicHistoryTab.tsx:111-126); OverallPositionHeadline `loading` (`.tsx:29-45`); ClassComparisonCard `loading` (`.tsx:210-219`) + per-row skeleton (`.tsx:163-174`); PerCaClassChart `loading` (`.tsx:32-43`); Raw-history `Skeleton` (tab:362-363) |
| 2 | Empty state with sensible copy | ✅ PASS | "No Academic History" (tab:128-140); "No graded subjects this term yet." (ClassComparisonCard.tsx:220-223); "No CA data for this subject yet." (PerCaClassChart.tsx:87-90); "No grade data for this subject yet" (tab:364-366) |
| 3 | Suppressed/insufficient states (classAvg null → "not enough class data yet"; overall null → reason copy; per-CA null → gap not fake 0) | ✅ PASS | `NO_CLASS_DATA_COPY` (ClassComparisonCard.tsx:34,120-124); `overallPositionCopy` reason branches (academicHistoryView.ts:82-108); `connectNulls={false}` + null preserved in `buildPerCaChartData` (PerCaClassChart.tsx:74,83; academicHistoryView.ts:202-223) |
| 4 | Error state — no bare `if(!data) return null` hiding errors; tab wrapped by page ErrorBoundary | ✅ PASS | Tab rendered inside `<ErrorBoundary key={activeTab}>` (page.tsx:149-158). Only `return null` is in `DeltaIndicator` when there is no delta (ClassComparisonCard.tsx:46) — correct empty-cell render, not a data-hiding guard |
| 5 | No TypeScript `any`; types from `@/convex/_generated/dataModel` | ✅ PASS | grep for `\bany\b` → none. `Id<...>` imported from dataModel; query result types via `NonNullable<ReturnType<typeof useQuery<...>>>` (tab:162-191) |
| 6 | No hardcoded hex/rgba; brand tokens / `var(--color-*)` only | ✅ PASS | grep for hex/rgba → none. Recharts uses `var(--color-school-green)`, `var(--color-muted-foreground)`, `var(--color-border)` (acceptable brand tokens) |
| 7 | Interactive elements have aria labels / aria-pressed | ✅ PASS | Semester `Button`s: `aria-pressed`, `aria-label="Semester {s}"` in `<fieldset>`+sr-only `<legend>` (tab:282-302); subject `Select` `aria-label="Select subject for charts"` (tab:326); Δ column has sr-only "Difference from class" (ClassComparisonCard.tsx:234-236) |
| 8 | Mobile (375px): tables/cards overflow-x-auto or stack; no fixed-width overflow | ✅ PASS | Comparison grid `overflow-x-auto` + `min-w-[32rem]` (ClassComparisonCard.tsx:225-226); charts `ResponsiveContainer width="100%"` (no fixed px width); header row `flex-wrap` (tab:278); top/bottom grid `grid-cols-1 sm:grid-cols-2` (tab:564) |
| 9 | No business logic in component bodies — join + chart assembly in tested lib | ✅ PASS (with 🟡 note) | `buildSubjectRowSeeds` + `buildPerCaChartData` live in `lib/academicHistoryView.ts` and are unit-tested. Remaining inline `useMemo`/derivations are thin presentational view-glue consistent with sibling tabs. See 🟡-1 |
| 10 | Tests assert observable behavior (text/roles), survive refactor | ✅ PASS (with 🟡 note) | Component tests assert visible text + `role="status"` + label text. Minor reliance on `data-testid` for icons — acceptable (see 🟡-2) |
| 11 | Chart empty/loading a11y (`role="status"` / `<output>`) | ✅ PASS | All loading skeletons wrapped in `<output>` (implicit `role="status"`) with `aria-label`/`aria-busy` — OverallPositionHeadline.tsx:34, ClassComparisonCard.tsx:166/212, PerCaClassChart.tsx:37 |
| — | Sonner toast on mutation success/error | N/A | Read-only analytics — no mutations |
| — | RHF + Zod form validation | N/A | No forms in this feature |
| — | Student-role access to staff-only Phase B queries | CARRY-FORWARD | Pre-existing gap (tab already called staff-only `getLongitudinalSubjectPerformance`); NOT introduced here. Tracked as Devil's Advocate C-3 / Backend carry-forward. Not blocking |

**SSR-fan-out pattern (verified correct):** `SubjectComparisonRow` calls `useQuery(getClassAverages)` once per row at component top level (ClassComparisonCard.tsx:148-184). Row count derives from `rows` (built from `positions.bySubject`), which is stable per render, so no Rules-of-Hooks violation. This is the correct resolution of Devil's Advocate C-2 (single-subject query cannot fan out over N subjects inside a `.map`). `academicYear` passed verbatim as `Id<"academicYears">` throughout (tab:76,254 — never a name string). ✓

**Non-blocking suggestions (🟡 — future improvement, do NOT block this merge):**
- 🟡-1 (Component Structure): The cross-year `longitudinalChartData` sort+map transform (AcademicHistoryTab.tsx:262-273) is the one inline display transform substantial enough to warrant extraction — moving it (and the `activeSubjects`/`effectiveSubjectId`/`chartData` derivations) into a `hooks/use-academic-history-view.ts` would improve testability and consistency with the extracted lib helpers. Judged non-blocking because the genuine domain logic (the join + chart assembly) is already extracted and unit-tested, and the residual glue matches the established pattern in sibling tabs (`FeesTab`, `CollectFeesDialog`). Not the AL-5 pattern (where the feature's core filter logic was inlined).
- 🟡-2 (Testing): Icon presence assertions use `data-testid` (`award-icon`, `delta-up-icon`, etc.). These survive refactors of copy but couple to the icon element. Prefer asserting the `aria-label` text ("X above class" / "same as class") where an accessible name already exists, so the test tracks the a11y contract rather than a testid. Existing tests already do this for the down-delta case (`getByLabelText("5.0 below class")`) — extend the pattern.
- 🟡-3 (a11y, minor): The `DeltaIndicator` up/down/flat spans use `role="img"` with an `aria-label`; that reads correctly, but the numeric delta is `aria-hidden`. Consider folding the value into a single accessible name (e.g. "+12.0, above class") so screen-reader users hear the magnitude and direction together. Non-blocking — current output is already comprehensible.

**Approval notes:** Clean, well-typed, well-tested submission. Container/presentational split is correct; the per-row fan-out is the right call and is documented in-code. Null-vs-zero discipline in the per-CA chart is exactly right (line gaps, never coerced 0). C.5 trend-verdict removal is complete and grep-verified. All three build/lint/test gates green.

### Prior sub-task (superseded by integration; component now consumed by container)
- [x] C.3 `PerCaClassChart` — pure presentational Recharts line chart — DONE (3/3 tests green, Biome 0 errors); wired into container this session.

---

## 😈 Devil's Advocate Findings (Phase 1 — already resolved)
- Concern: v1 Convex deployment schema conflicts → Mitigation: patched schema to add v1 legacy fields as optional
- Concern: Next.js 16 uses proxy.ts not middleware.ts → Mitigation: renamed, fixed export
- Concern: convexAuth.isAuthenticated() is async → Mitigation: awaited in proxy handler
- Concern: shadcn CLI changed (no --style flag) → Mitigation: components.json created manually
- Concern: Zod v4 removed `required_error` from z.enum → Mitigation: removed the option
- Concern: `.and()` on ZodEffects breaks zodResolver → Mitigation: refactored to `.merge()` on base schemas

---

## AUDIT QUEUE (COMPLETED 2026-04-05)

### Backend Audit — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] A.1 convex/schema.ts — all 23 tables + v1 compatibility patches
- [x] A.2 convex/lib/permissions.ts — requireRole helper
- [x] A.3 convex/seed.ts — idempotent reference data
- [x] A.4 convex/students.ts — generatePhotoUrl, createStudent, getAllStudents, getStudentById, updateStatus, getSiblings
- [x] A.5 convex/enrollments.ts — create, getHistory, getCurrent, updateExit
- [x] A.6 convex/academicYears.ts + campus.ts + standardLevels.ts + subjects.ts
- [x] A.7 convex/feeStructure.ts + studentFees.ts
- [x] A.8 convex/assessments.ts + assessmentQuestions.ts + studentAssessmentAnswers.ts + assessmentWeightingRules.ts + computedGrades.ts
- [x] A.9 convex/reportCards.ts
- [x] A.10 convex/feeTransactions.ts + discounts.ts + studentDiscounts.ts — FIXED: by_fee index, any types, studentDiscounts required fields

### Frontend Audit — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] A.11 proxy.ts + app/layout.tsx + (auth)/layout.tsx + (dashboard)/layout.tsx
- [x] A.12 components/layout/Sidebar.tsx + SidebarItem.tsx + DashboardWrapper.tsx — FIXED: overflow-hidden, max-w-[300px]
- [x] A.13 app/(auth)/login/page.tsx
- [x] A.14 app/(dashboard)/students/page.tsx + columns.tsx + DataTable.tsx
- [x] A.15 app/(dashboard)/students/_components/ — FIXED: business logic extracted to useStudentAdmission hook
- [x] A.16 app/(dashboard)/students/[studentId]/page.tsx + _components/ — FIXED: hardcoded #018737 → var(--color-school-green), inline grade ternaries → calculateLetterGrade(), aria-labels added
- [x] A.17 app/(dashboard)/admin/assessments/page.tsx — FIXED: aria-label + aria-pressed on mode toggles
- [x] A.18 app/(dashboard)/fees/page.tsx + student-fees/page.tsx — FIXED: frequency enum in Zod schema
- [x] A.19 FeesTab — Switch component installed and wired

### E2E Test Audit — PASSING (2026-04-05)
- [x] A.20 Install Playwright + write smoke tests — 6/6 PASSING
- [x] A.21 Login flow — redirect to /login tested
- [x] A.22 Login page renders — form elements verified
- [ ] A.23 Student list page loads — requires authenticated E2E (Phase 5)
- [ ] A.24 Add student form (3 steps) — requires authenticated E2E (Phase 5)

---

## Phase 2 Sub-tasks — MARK WHEN BACKEND REVIEW APPROVED
- [x] 2.1 convex/students.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.2 convex/enrollments.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.3 convex/academicYears.ts, campus.ts, standardLevels.ts, subjects.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.4 lib/validations/ Zod schemas — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.5 Students list page + DataTable + StatusBadge — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.6 AddStudentButton + AddStudentForm + steps — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.7 Student detail page + 5-tab nav — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.8 OverviewTab + InfoCard — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.9 GradesTab (full CA-1/2/3) — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.10 lib/gradeUtils.ts — WRITTEN (pending FRONTEND REVIEW)

## Phase 3 Sub-tasks — MARK WHEN APPROVED
- [x] 3.2 convex/ assessment system functions — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 3.3 Assessment admin page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.4 GradesTab full (CA-1/2/3) — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.5 AcademicHistoryTab + charts — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.6 ReportCardsTab + uploadcard/delete — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.1 Subjects management page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)

## Phase 4 Sub-tasks — COMPLETE
- [x] 4.1 convex/feeTransactions.ts + discounts.ts + studentDiscounts.ts — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 4.2 Fee Structures page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 4.3 FeesTab + CollectFeeDialog — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 4.4 Student fees list page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)

## Auth Fix Sub-tasks
- [x] 5.8 Auth config fix (JWT_PRIVATE_KEY login error) — convex/auth.config.ts domain fix, convex/auth.ts createOrUpdateUser pre-provisioned user support, scripts/generate-auth-keys.mjs — APPROVED by BACKEND REVIEW AGENT (2026-04-05)

## Phase 5 Sub-tasks
- [x] 5.1 Loading skeletons — all pages have Skeleton during undefined query state — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.2 Empty states — all tables/lists have empty state with CTA — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.3 Error boundaries — ErrorBoundary class component wraps all student detail tabs — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.4 Mobile responsiveness — table overflow-x-auto on FeesTab+student-fees; grid-cols-1 sm:grid-cols-3 on FeesTab summary — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.5 Role-based access: Teacher — Sidebar filters nav by role, backend requireRole enforces server-side — APPROVED by BACKEND REVIEW + FRONTEND REVIEW AGENTS (2026-04-05)
- [x] 5.6 Role-based access: Student — getStudentById enforces caller.studentId === requested studentId for student role; getAllStudents blocks student role entirely — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 5.7 Admin settings page — convex/users.ts (listUsers, updateUserRole, deactivateUser, reactivateUser, getMe) + /admin/settings page — APPROVED by BACKEND REVIEW + FRONTEND REVIEW AGENTS (2026-04-05)

---

## Bug Fix: /students Unauthorized Crash
**Status**: Complete (2026-04-13)
**Active Agent**: Coding Agent → Backend Agent + Frontend Agent

### Root Causes Found
- RC-1: User authenticated but `users` record missing → `requireRole` throws at line 22 (data repair: sign out + sign back in)
- RC-2: `auth.ts` `.filter()` — could not change to `.withIndex()` (convexAuth callback ctx type doesn't expose app schema indexes); `.filter()` is intentional
- RC-3: `identity.email!` non-null assertion compile-time only → fixed with email guard + local variable narrowing
- RC-4: No `app/(dashboard)/error.tsx` → created, catches auth errors and signs out + redirects

### Sub-tasks
- [~] BF-1 convex/auth.ts — `.filter()` retained (`.withIndex()` not possible in convexAuth callback ctx type)
- [x] BF-2 convex/lib/permissions.ts — email guard + local `const email` narrowing — APPROVED by BACKEND REVIEW AGENT (2026-04-13)
- [x] BF-3 app/(dashboard)/error.tsx — error boundary for auth errors — APPROVED by FRONTEND REVIEW AGENT (2026-04-13)

---

## Sign-Out Button Sub-task (2026-04-13)
- [x] Sign-out footer in Sidebar.tsx + email prop in DashboardWrapper.tsx — APPROVED by FRONTEND REVIEW AGENT (2026-04-13)

---

## Review Notes

**Frontend Review (BF-3):** APPROVED 2026-04-13. error.tsx passes all checklist items — correct Next.js error boundary signature, auth sign-out in useEffect with cancellation guard, branded UI, accessible role="status" and aria-label, mobile-safe layout, shadcn Button, no any types, no hardcoded hex. Non-blocking suggestion: filter raw error.message in the non-auth card to avoid leaking Convex internals in production.

**Frontend Review (Sign-out button):** APPROVED 2026-04-13. Correct useAuthActions import, async handleSignOut extracted above render, router.replace("/login") post-sign-out, collapsed state hides email but keeps icon visible, aria-label="Sign out" present, no any types, no hardcoded hex. Non-blocking: sign-out button (p-1.5 ≈ 28px) and toggle button (p-1) are below the 44px touch target minimum — consider upgrading both to shadcn Button variant="ghost" size="icon" (h-9 w-9) in a future pass.

---

## Completed Features (2026-04-05)
- [x] Phase 1 — Foundation (Next.js, Convex, Auth, Sidebar, Login)
- [x] Phase 2 — Core Student Management (add student, list, detail page, 5 tabs)
- [x] Phase 3 — Academic Management (subjects, assessments, grades, academic history, report cards)
- [x] Phase 4 — Fee Management (fee structures, student fees, collection, discounts)
- [x] Phase 5 — Polish & Roles (skeletons, empty states, error boundaries, mobile, RBAC, admin settings)

## Fee Detail Dialog Feature (2026-04-18)
**Status**: In Progress
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] FD-1 Create FeeDetailDialog.tsx + ApplyDiscountSubDialog — COMPLETE, awaiting FRONTEND REVIEW
- [x] FD-2 Modify FeesTab.tsx — clickable rows + dialog integration — COMPLETE, awaiting FRONTEND REVIEW

---

## Mark Entry Page Feature (2026-04-17)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] ME-1 Create assessment detail page (app/(dashboard)/admin/assessments/[assessmentId]/page.tsx) — COMPLETE
- [x] ME-2 Create MarkEntryGrid component (_components/MarkEntryGrid.tsx) — COMPLETE
- [x] ME-3 Create QuestionManager dialog (_components/QuestionManager.tsx) — COMPLETE
- [x] ME-4 Make assessment list items clickable (Link) on assessments/page.tsx — COMPLETE
- [x] ME-5 Fix pre-existing DiscountRule type error in FeeDetailDialog.tsx — COMPLETE (added _creationTime and missing optional fields)

### Build Verification
- `npm run build`: PASSING (11 routes including new /admin/assessments/[assessmentId])
- TypeScript: PASSING (0 type errors)

---

## Student Delete & Update Mutations (2026-04-24)
**Status**: DONE
**Active Agent**: BACKEND AGENT

### Sub-tasks
- [x] SU-1 Add `deleteStudent` mutation — cascade deletes all 9 related tables, unlinks siblings, deletes stored photos + report card files — awaiting BACKEND REVIEW
- [x] SU-2 Add `updateStudent` mutation — partial field update with bidirectional sibling re-linking — awaiting BACKEND REVIEW

---

## Student Header Enhancements (2026-04-24)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] SH-1 Add Delete button with AlertDialog to StudentHeader — COMPLETE
- [x] SH-2 Replace Edit button navigation with EditStudentDialog — COMPLETE
- [x] SH-3 Create EditStudentDialog component — COMPLETE

### Build Verification
- `npm run build`: PASSING (12 routes, 0 TypeScript errors)
- `npx biome check` on changed files: PASSING (0 errors)

---

## Bulk Student Promotion Feature (2026-04-25)
**Status**: In Progress
**Active Agent**: CODING AGENT (orchestrating)

### Sub-tasks
- [x] BP-1 convex/promotions.ts — getPromotionCandidates query + bulkPromote mutation — DONE
- [x] BP-2 Backend Review — APPROVED by BACKEND REVIEW AGENT (2026-04-25)
- [x] BP-3 Sidebar nav update + app/(dashboard)/admin/promotions/page.tsx — COMPLETE, awaiting FRONTEND REVIEW
- [x] BP-4 Frontend Review — APPROVED by FRONTEND REVIEW AGENT (2026-04-25)

### Review Notes
**Backend Review (BP-2) — REJECTED 2026-04-25, then APPROVED on re-review 2026-04-25:**
All 3 blocking issues resolved: (1) exitDate convention at idempotency guard, (2) duplicate enrollment guard via by_student_academic_year index in promote+hold_back, (3) duplicate fee guard via by_student_year index + Set dedup in promote+hold_back. Full checklist passed.

**Frontend Review (BP-3 / BP-4) — APPROVED 2026-04-25:**
promotions/page.tsx and Sidebar.tsx both pass all checklist items. Loading skeleton, empty state, and filter-not-selected state handled correctly. No `any` types — `Id` imports from dataModel, `as const` casts only on PromotionAction literals. RoleGate wraps admin content. All interactive elements have aria-label. Table has overflow-x-auto for mobile. Brand colors use Tailwind tokens only. Sonner toasts on success and error. AlertDialog cancel correctly disabled during submission. Non-blocking suggestions recorded in approval notes.

---

## Academic Year Creation Feature (2026-04-25)
**Status**: Planning
**Active Agent**: PLANNING AGENT

### Summary
Admins need to create new academic years from the Promotions page without navigating away. Two entry points: a "+ New Academic Year" option inside the Target Year dropdown, and a helper message when no valid target year exists. After creation the new year is auto-selected. Backend validates name uniqueness and date order. No schema changes required.

### Files in scope
- `convex/academicYears.ts` — add validation to existing `create` mutation (name uniqueness + startDate < endDate)
- `app/(dashboard)/admin/promotions/page.tsx` — add `CreateAcademicYearDialog` component + wire two entry points

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| AY-1 | Add name-uniqueness check and startDate < endDate guard to the `create` mutation in `convex/academicYears.ts`. Return the inserted Id (already present). No new functions. | BACKEND AGENT | [x] DONE | |
| AY-2 | Backend review of AY-1: verify requireRole present, no unbounded collect, uniqueness query uses `.take(100)` (already the list pattern), error messages safe, no N+1. | BACKEND REVIEW AGENT | [x] APPROVED | APPROVED by BACKEND REVIEW AGENT (2026-04-25) |
| AY-3 | Add `CreateAcademicYearDialog` to `app/(dashboard)/admin/promotions/page.tsx`. New state: `createYearOpen`. New mutation: `useMutation(api.academicYears.create)`. Dialog fields: Name (pre-filled via `suggestNextYear`), Start Date, End Date. Zod schema (inline, consistent with assessments/page.tsx pattern). Submit handler: call mutation → toast success + auto-select new Id → close; toast error on duplicate. Entry point 1: separator + clickable div (not SelectItem) inside Target Year SelectContent with a Plus icon. Entry point 2: helper message below filter bar when no target year exists. | FRONTEND AGENT | [x] COMPLETE | Awaiting FRONTEND REVIEW (AY-4) |
| AY-4 | Frontend review of AY-3: loading state, empty state, error toast, no `any`, no hardcoded hex, aria-labels on new interactive elements, mobile layout, RHF+Zod form, inline validation messages, Sonner toasts. | FRONTEND REVIEW AGENT | [x] APPROVED | APPROVED by FRONTEND REVIEW AGENT (2026-04-25) — see review notes |
| AY-5 | Run `npm run build` and `npm run lint` (Biome) on the two modified files. Confirm 0 errors. Update TASK_LOG.md with result. | CODING AGENT | [ ] Pending | Blocked by AY-4 |

### Dependencies and Blockers
- AY-1 has no external blockers (no schema change, mutation already exists and has `requireRole`).
- AY-2 is gated on AY-1; frontend cannot begin until AY-2 is approved.
- AY-3 depends on AY-2 approval. The `createYear` mutation call signature is already known from the spec: `{ name: string, startDate: float64, endDate: float64 }`.
- AY-5 is the integration check; only marks the feature complete when build + lint both pass.

### Agent Notes — AY-1 (BACKEND AGENT)
- The existing `list` query uses `.take(100)` — the uniqueness check inside `create` must also use `.take(100)` (not `.collect()`) then filter client-side, OR use a `by_name` index if one exists. Check schema before deciding; if no index exists, `.take(100)` + JS `.find()` is acceptable for academic years (low cardinality table, max ~20 rows).
- Error strings must not mention table names: "An academic year with this name already exists" and "Start date must be before end date" are the exact messages per the spec — use these verbatim.
- `requireRole(ctx, ["admin"])` is already present in the bare mutation; the validation code must be added AFTER this line.

### Agent Notes — AY-3 (FRONTEND AGENT)
- The `suggestNextYear(sourceYearName)` pure function must be extracted above the component — not inside the render body or a `useMemo` (no DOM access needed, pure string parsing).
- The "+ New Academic Year" trigger inside SelectContent must be a `div` with `onClick` — NOT a `SelectItem`. Clicking it must call `e.preventDefault()` to prevent the Select from closing and changing its value.
- The `createYearOpen` state, `createYear` mutation, and `CreateAcademicYearDialog` should all live inside `PromotionsPageContent` (not in the outer `PromotionsPage` shell which is only the RoleGate wrapper).
- Date fields use `input type="date"` — convert to Unix ms with `new Date(value).getTime()` before calling the mutation.
- Auto-suggest logic depends on `selectedSourceYearId`: find the year object from `years` array, pass its `name` to `suggestNextYear`. If no source year is selected yet, pass an empty string (suggestNextYear returns empty fields gracefully).
- After `createYear` resolves successfully, call `setSelectedTargetYearId(newId)` where `newId` is the returned `Id<"academicYears">`.
- No new Zod validation file — define the inline `createAcademicYearSchema` at the top of the page file, consistent with the pattern in `assessments/page.tsx`.

### Review Notes
**Frontend Review (AY-4) — APPROVED 2026-04-25:**
All checklist items pass. No `any` types. No hardcoded hex. `suggestNextYear` correctly extracted as pure function above component. `onMouseDown` + `e.preventDefault()` used for the SelectContent button (correct pattern). Warning banner condition (`years.filter(y => y._id !== selectedSourceYearId).length === 0 && selectedSourceYearId`) is correct. Zod schema has `.refine()` for date order with error on `endDate` path. `FormMessage` on all three fields. Submit button disabled on `formState.isSubmitting`. Auto-select works via `setSelectedTargetYearId(newId)`. `onOpenChange` resets form with suggestions on open. Dialog responsive: `max-w-sm sm:max-w-md`, date grid `grid-cols-1 sm:grid-cols-2`. `AlertDialogCancel` disabled during `isSubmitting`. Sonner toasts on all success and error paths. Non-blocking: the `div[role="button"]` inside SelectContent lacks `tabIndex="0"` and an `onKeyDown` handler for Enter/Space — keyboard users may be unable to activate it. Acceptable for now given shadcn Select manages focus internally.

### Decisions Made
- 2026-04-25: No schema change for this feature — the `academicYears` table already has the required fields.
- 2026-04-25: `CreateAcademicYearDialog` lives inline in `promotions/page.tsx` (not a separate file) because it is small (3 fields) and only used in one place. If reuse is needed in future, extract then.
- 2026-04-25: No `by_name` index added to `academicYears` — cardinality is too low to justify an index; `.take(100)` + `.find()` is the chosen uniqueness check approach.

---

## DataTable Enhancement + Faceted Filter (2026-04-25)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] TF-1 Update DataTable.tsx — added `toolbar` prop, `pageSizeOptions` prop, page size Select dropdown, useEffect for page index reset on data length change — COMPLETE
- [x] TF-2 Create DataTableFacetedFilter.tsx — new component with Popover+Command multi-select, checkbox UI, badge count, clear filters — COMPLETE

### Build Verification
- TypeScript: 0 errors in modified/new files (5 pre-existing errors in student-fees/page.tsx and students/page.tsx are unrelated)

---

## Security Hardening (2026-04-25)
**Status**: Complete
**Active Agent**: CODING AGENT

### Sub-tasks
- [x] SH-1 Fix proxy.ts redirect — changed authenticated user redirect from `/students` to `/dashboard` — COMPLETE
- [x] SH-2 Add security headers to next.config.ts — X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, X-XSS-Protection — COMPLETE
- [x] SH-3 Fix hardcoded Convex URL in next.config.ts — replaced `hushed-bass-123.convex.cloud` with dynamic `new URL(process.env.NEXT_PUBLIC_CONVEX_URL)` — COMPLETE

### Verification
- `npm run build`: PASSING (12 routes + Proxy Middleware)
- `npm run lint`: PASSING (122 files, 0 errors)
- Playwright smoke tests: 6/6 PASSING
- Manual curl verification:
  - `/dashboard` → 307 redirect to `/login` (unauthenticated) ✓
  - `/admin/settings` → 307 redirect to `/login` (unauthenticated) ✓
  - `/students` → 307 redirect to `/login` (unauthenticated) ✓
  - `/fees` → 307 redirect to `/login` (unauthenticated) ✓
  - All 5 security headers present on every response ✓

---

## Audit Log Feature (2026-04-26)
**Status**: Complete
**Active Agent**: CODING AGENT

### Summary
Add a tamper-evident, admin-only audit trail to every write operation in the system.
Every mutation already receives the acting user from `requireRole()`, so instrumenting
is a matter of calling a shared `logAudit()` helper at the end of each handler.
The frontend is a single admin-only page with filtering by action type and entity type.

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Double-submission: if a user submits a form twice, two audit rows are created | Acceptable — the mutation itself should already guard idempotency; the audit log faithfully records both attempts |
| 2 | `bulkPromote` loops over students — one `logAudit` call per student could be 30+ inserts | Per-entity logging is intentional per the spec; Convex mutations are transactional so all inserts succeed or none do. Flag in AL-3b that the loop insert count should be noted in the JSDoc |
| 3 | `metadata` is `v.any()` — no schema enforcement | Spec deliberately keeps it flexible; the agent must use `Record<string, unknown>` in the TypeScript signature so the helper stays typed even if Convex stores it as `any` |
| 4 | `getRecentLogs` with `.take(100)` — no cursor pagination | Acceptable for v1 per spec; flag as a future improvement if log volume grows |
| 5 | Non-admin roles must never access audit logs | Both queries must call `requireRole(ctx, ["admin"])` as the first line |
| 6 | Denormalized `userName`/`userEmail` may drift if user updates their name | Spec decision — records the name at time of action, which is the correct audit semantics |
| 7 | `entityId` is `v.string()` not `v.id(...)` — accepts any string | Intentional: entityId is passed as a string from the mutation args which are already typed `Id<"table">` — the string representation is sufficient for display and filtering |
| 8 | Instrumenting ~25+ mutations is a high-surface-area change | Split into two backend sub-tasks: (AL-2) create the file + helper + queries, (AL-3a/3b/3c) instrument mutations by domain group, each independently reviewable |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| AL-1 | Add `auditLogs` table to `convex/schema.ts`. Fields: `userId`, `userEmail`, `userName`, `action` (union of 9 literals), `entityType`, `entityId`, `description`, `metadata` (optional any), `timestamp` (float64). Indexes: `by_timestamp ["timestamp"]`, `by_entity ["entityType", "entityId"]`, `by_user ["userId"]`. This is the only schema change for this feature. | BACKEND AGENT | [x] DONE | |
| AL-2 | Create `convex/auditLogs.ts`. (a) Internal helper `logAudit(ctx, params)` — inserts one row with `timestamp: Date.now()`. TypeScript signature must use `Record<string, unknown>` for `metadata`, not `any`. (b) Query `getRecentLogs({ limit?: number })` — `requireRole(ctx, ["admin"])` first, then `by_timestamp` index descending `.take(limit ?? 100)`. (c) Query `getLogsByEntity({ entityType, entityId })` — `requireRole(ctx, ["admin"])` first, then `by_entity` index. Both queries admin-only. | BACKEND AGENT | [x] DONE | |
| AL-3a | Instrument student + enrollment mutations with `logAudit` calls. Files: `convex/students.ts` (`createStudent`, `updateStudent`, `deleteStudent`, `updateStudentStatus`), `convex/enrollments.ts` (`createEnrollment`, `updateEnrollmentExit`). Import `logAudit` from `./auditLogs`. Call after the main operation, passing the `user` object already returned by `requireRole`. | BACKEND AGENT | [x] DONE | |
| AL-3b | Instrument fee + discount mutations with `logAudit` calls. Files: `convex/feeStructure.ts` (`createFee`), `convex/studentFees.ts` (`createStudentFee`, `updateStudentFee`), `convex/feeTransactions.ts` (`createTransaction`), `convex/discounts.ts` (`create`, `toggleActive`), `convex/studentDiscounts.ts` (`applyDiscount`). Note: `feeStructure.createFee` does not currently call `requireRole` — verify it does before instrumenting. | BACKEND AGENT | [x] DONE | `requireRole` confirmed present in all 7 mutations before instrumentation |
| AL-3c | Instrument assessment + grade + report card + user + promotion + academic year mutations with `logAudit` calls. Files: `convex/assessments.ts` (`createAssessment`, `bulkCreateAssessments`, `updateAssessment`, `deleteAssessment`), `convex/assessmentQuestions.ts` (`createQuestion`, `bulkCreateQuestions`, `updateQuestion`, `deleteQuestion`), `convex/studentAssessmentAnswers.ts` (`bulkMarkEntry`), `convex/computedGrades.ts` (`computeGradesForStudent`), `convex/reportCards.ts` (`uploadReportCard`, `deleteReportCard`), `convex/users.ts` (`updateUserRole`, `deactivateUser`, `reactivateUser`), `convex/promotions.ts` (`bulkPromote` — one `logAudit` call per student inside the loop), `convex/academicYears.ts` (`create`). | BACKEND AGENT | [x] DONE | 17 mutations instrumented across 8 files. `bulkPromote` JSDoc updated. Biome lint: 0 errors. |
| AL-4 | Backend review of AL-1 through AL-3c. Verify: (1) `auditLogs` schema has all 3 indexes declared correctly, (2) both queries call `requireRole(ctx, ["admin"])` as first statement, (3) `logAudit` helper is not exported as a Convex mutation — it is a plain async function, (4) every instrumented mutation still calls `requireRole` before `logAudit`, (5) no N+1 (logAudit is a single insert, not a query), (6) `metadata` TypeScript type is `Record<string, unknown>` not `any`, (7) error messages in queries don't leak schema. Full BACKEND REVIEW AGENT checklist. | BACKEND REVIEW AGENT | [x] APPROVED | APPROVED by BACKEND REVIEW AGENT (2026-04-26). All 10 checklist sections pass. Non-blocking: (1) feeStructure.createFee uses entityType "feeStructures" vs actual table name "feeStructure" — cosmetic only. (2) deleteReportCard does not delete storage file — pre-existing issue. (3) deactivateAssessment not instrumented — out of scope per task spec. |
| AL-5 | Create `app/(dashboard)/admin/audit-log/page.tsx`. Admin-only (`RoleGate`). Use `useQuery(api.auditLogs.getRecentLogs, { limit: 200 })`. Table with columns: Timestamp, User, Action (Badge), Entity Type, Description. Two filter dropdowns (Action type, Entity type). Loading skeleton, empty state, filtered-empty state. Mobile overflow-x-auto. Filter logic in `useMemo`. | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (AL-7) |
| AL-6 | Add "Audit Log" entry to the Administration group in `components/layout/Sidebar.tsx`. Entry: `{ href: "/admin/audit-log", label: "Audit Log", icon: ClipboardList }`. Import `ClipboardList` from `lucide-react`. Admin-only (the entire Administration group is already `roles: ["admin"]`). | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (AL-7) |
| AL-7 | Frontend review of AL-5 and AL-6. | FRONTEND REVIEW AGENT | [x] REJECTED then FIXED | Initially REJECTED: filter logic was in component body. Fixed: extracted to `hooks/use-audit-log-filters.ts`, removed redundant `as AuditAction` casts. |
| AL-7b | Frontend re-review after fixes. | FRONTEND REVIEW AGENT | [x] APPROVED | Filter logic extracted to custom hook, `as AuditAction` casts removed, import order fixed. Build: 14 routes PASSING. Lint: 125 files, 0 errors. |
| AL-8 | Run `npm run build` and `npm run lint`. Confirm 0 errors. | CODING AGENT | [x] DONE | Build: PASSING (14 routes). Lint: PASSING (125 files, 0 errors). Playwright: 6/6 PASSING. |

### Dependencies and Blockers
- AL-1 (schema) must land before AL-2 (helper + queries) — Convex type generation depends on the table being declared.
- AL-2 must be complete before AL-3a/AL-3b/AL-3c — the mutations import `logAudit` from `auditLogs.ts`.
- AL-3a, AL-3b, AL-3c can be written in parallel within a single Backend Agent session since they touch different files, but all three must be complete before AL-4.
- AL-4 (backend review) gates all frontend work — no frontend task starts until AL-4 is approved.
- AL-5 and AL-6 can be done in a single Frontend Agent session.
- AL-8 (build/lint check) is the final integration gate before the feature is marked complete.

### Agent Notes — AL-1 (BACKEND AGENT)
- Do not add any indexes beyond the three specified. The `by_entity` index is composite — order matters: `["entityType", "entityId"]`.
- `metadata` field: use `v.optional(v.any())` in schema (matching the spec), but the TypeScript helper function signature should constrain to `Record<string, unknown> | undefined`.
- `action` field must use `v.union(v.literal(...), ...)` with all 9 literal values: `create`, `update`, `delete`, `status_change`, `collect_payment`, `apply_discount`, `upload`, `promote`, `role_change`.

### Agent Notes — AL-2 (BACKEND AGENT)
- `logAudit` is a plain `export async function`, NOT `export const logAudit = mutation({...})`. It is called inside existing mutations, not from the client.
- Descending order on `by_timestamp`: use `.order("desc")` before `.take()`.
- `getLogsByEntity` does not need ordering — the index will return results in index order (entityType, entityId); if ordering by timestamp within an entity is desired, add `.order("desc")` — but the spec does not require it for v1.

### Agent Notes — AL-3a/3b/3c (BACKEND AGENT)
- The `user` object returned by `requireRole()` has `_id`, `name`, and `email` fields — pass these directly as `user` to `logAudit`.
- For `deleteStudent`: capture `student.firstName` and `student.lastName` before deleting, since the record will be gone when the log is written.
- For `bulkPromote`: inside the per-student loop, call `await logAudit(ctx, { user, action: "promote", entityType: "students", entityId: studentId, description: \`...\` })`.
- For `feeStructure.createFee`: confirm `requireRole` is present (grep before touching the file). If missing, add it as the first line in the handler before the logAudit call.
- Action type mapping to use: `createStudent`→`create`, `updateStudent`→`update`, `deleteStudent`→`delete`, `updateStudentStatus`→`status_change`, `createTransaction`→`collect_payment`, `applyDiscount`→`apply_discount`, `uploadReportCard`→`upload`, `bulkPromote`→`promote`, `updateUserRole`→`role_change`, all others→`create`/`update`/`delete` as appropriate.

### Agent Notes — AL-5 (FRONTEND AGENT)
- Read the `frontend-design` SKILL.md before starting.
- Import `date-fns` `format` function — it is already a dependency in this project (used in existing components).
- Action badge colors: suggest mapping `delete`→`destructive`, `status_change`→`secondary`, `collect_payment`→`default` (green), `role_change`→`outline`, others→`secondary`. Use shadcn `Badge` variants — no hardcoded hex.
- Extract filter logic (filtering `logs` array by selected action/entityType) into `hooks/use-audit-log-filters.ts` returning `{ filteredLogs, actionFilter, setActionFilter, entityTypeFilter, setEntityTypeFilter }`.
- The entity type filter options are derived from the live data — use `useMemo` to compute distinct `entityType` values from the returned logs array.
- The page lives at `app/(dashboard)/admin/audit-log/page.tsx`, consistent with the existing `/admin/assessments` and `/admin/promotions` pattern.
- Use `columns.tsx` pattern (separate file for TanStack Table column definitions) only if the column set is complex; for this table (5 columns, read-only), inline column definitions in the page file are acceptable.

### Decisions Made
- 2026-04-26: `logAudit` is a plain async function, not a Convex mutation, to avoid the overhead of a separate network call. It runs inside the existing mutation transaction.
- 2026-04-26: No cursor-based pagination for v1 — `.take(100)` is sufficient; can be upgraded if log volume warrants it.
- 2026-04-26: `entityId` is stored as `v.string()` (not `v.id()`) to support heterogeneous entity types without a union validator.
- 2026-04-26: `metadata` stored as `v.any()` in schema but constrained to `Record<string, unknown>` in the TypeScript helper to preserve type safety at the call sites.
- 2026-04-26: AL-3a/3b/3c split by domain group to keep each sub-task reviewable and bounded in scope.

---

## Fee Structure Editability Feature (2026-04-26)
**Status**: In Progress
**Active Agent**: CODING AGENT (orchestrating)

### Summary
Add the ability to view, edit, and soft-delete individual fees within a fee structure. Adds a detail page at `/fees/[levelId]` with a fee table, edit dialog, deactivate/reactivate confirmation, and student count per fee. Cards on the `/fees` listing page become clickable links to the detail page.

### Devil's Advocate Review
- Concern: Editing baseAmount on a fee structure doesn't retroactively update existing studentFees → Mitigation: Acceptable — existing studentFees record the original amount at time of assignment; new assignments will use the updated amount
- Concern: Soft delete means deactivated fees still appear in queries → Mitigation: getByLevel returns all fees (active + inactive) for admin visibility; getFormFees/getFormFeeStructure should filter by isActive for admission form
- Concern: Student count query per fee could be slow without index → Mitigation: Adding by_feeStructure index to studentFees table
- Concern: Changing feeType could break studentFees references → Mitigation: feeType change is allowed (no referential integrity issue — studentFees references feeStructureId, not feeType)
- Concern: "semester" frequency option in CreateFeeDialog doesn't match schema → Mitigation: Fixing as part of B1 extraction

### Sub-tasks

| # | Task | Agent | Status |
|---|------|-------|--------|
| FS-1 | Add `by_feeStructure` index to studentFees in schema.ts | BACKEND AGENT | [x] DONE |
| FS-2 | Add `updateFee` mutation to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-3 | Add `toggleActive` mutation to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-4 | Add `getByLevel` query to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-5 | Backend review of FS-1 through FS-4 | BACKEND REVIEW AGENT | [x] APPROVED 2026-04-26 — All 4 previously rejected issues resolved. Full checklist passed. |
| FS-6 | Extract CreateFeeDialog to shared component + fix semester bug | FRONTEND AGENT | [x] DONE — Extracted to `_components/CreateFeeDialog.tsx`, removed `"semester"` from frequencies, added aria-labels |
| FS-7 | Create EditFeeDialog component | FRONTEND AGENT | [x] DONE — `_components/EditFeeDialog.tsx`, follows EditAssessmentDialog pattern, pre-populated defaults |
| FS-8 | Create detail page at fees/[levelId]/page.tsx | FRONTEND AGENT | [x] DONE — Full page with summary cards, fee table, edit/deactivate/reactivate dialogs, loading/empty/not-found states |
| FS-9 | Make grade cards clickable with navigation | FRONTEND AGENT | [x] DONE — Cards wrapped in `Link`, chevron-right indicator, `e.preventDefault()` on Add button |
| FS-10 | Frontend review of FS-6 through FS-9 | FRONTEND REVIEW AGENT | [x] APPROVED 2026-04-26 (re-review) — All 4 blocking issues confirmed resolved: (1) conditional render guard replaces unsafe `as` cast, (2) empty state for zero levels added, (3) summaryStats/level derivation extracted to `hooks/use-fee-level-summary.ts`, (4) schemas moved to `lib/validations/feesSchema.ts`. isSubmitting fix confirmed. Full checklist passed. |
| FS-11 | Run npm run build and npm run lint | CODING AGENT | [x] DONE — Build: 15 routes PASSING. Lint: 129 files, 0 errors. |

---

## Transaction Log: Standard Level Filter + Date Range Presets (2026-05-18)
**Status**: In Progress
**Active Agent**: BACKEND AGENT

### Sub-tasks
- [x] TL-5 Create `convex/migrations.ts` — backfill `standardLevelId` on existing feeCollectionSessions — DONE (2026-05-18)
- [x] TL-7 Update `hooks/use-transaction-filters.ts` — add standardLevelId, date range preset state, computed dates — DONE (2026-05-18). Also exported `PeriodForPreset` from `lib/dateRangeUtils.ts` to fix TS2345. Hook file: 0 TS errors. Expected downstream errors in page.tsx (setDateFrom/setDateTo removed) will be fixed in Tasks 8-9.
- [x] TL-8 Update TransactionFilters UI — DONE (2026-05-18) — FRONTEND AGENT replaced entire component: removed dateFrom/dateTo/onDateFromChange/onDateToChange props; added standardLevelId, dateRangePreset, selectedPeriod, customDateFrom/To props; added Standard Level dropdown (api.standardLevels.list), Date Range Preset selector (monthly/quarterly/half-yearly/yearly/custom), conditional sub-pickers (month+year, quarter+year, half+year, custom date pickers); moved Reset button next to Show Voided toggle. TypeScript: 0 errors. Awaiting FRONTEND REVIEW.
- [x] TL-9 Wire new filter props in page.tsx + update ExportButton — DONE (2026-05-18) — FRONTEND AGENT. ExportButton: added `levelName` and `dateRangeLabel` optional props, passed to `generateTransactionFilename`. page.tsx: removed old `dateFrom`/`onDateFromChange`/`dateTo`/`onDateToChange` props from TransactionFilters; added new props (`standardLevelId`, `dateRangePreset`, `selectedPeriod`, `customDateFrom`, `customDateTo` + their setters). ExportButton receives `levelName` from `data?.standardLevelName` and `dateRangeLabel` from `filters.dateRangeLabel`. Awaiting FRONTEND REVIEW.

---

## Issue #33: Invoice Schema Migration — Billing Contact, Delivery Fields, "sent" → "issued" (2026-06-03)
**Status**: Complete — APPROVED by BACKEND REVIEW AGENT
**Active Agent**: CODING AGENT → BACKEND AGENT → BACKEND REVIEW AGENT
**GitHub**: https://github.com/Mahir1902/sis-v2/issues/33

### Summary
Widen → migrate → narrow Convex migration adding Billing Contact infrastructure to `students` (4 fields), delivery tracking to `invoices` (2 fields), and renaming the `invoices.status` value `"sent"` → `"issued"` per ADR-0001. Both backfills ran against the dev dataset (27 students, 0 invoices). Migration body for the status rename is preserved in a commented re-run recipe inside `convex/migrations.ts` for future prod deploys still carrying `"sent"` rows.

### Sub-tasks
| # | Task | Agent | Status |
|---|------|-------|--------|
| I33-1 | Widen schema: add `fatherEmail`/`motherEmail`/`guardianEmail`/`primaryBillingContact` (optional) to students; add `deliveryChannel`/`deliveryStatus` to invoices; add `"issued"` alongside `"sent"` in `invoices.status` union | BACKEND AGENT | [x] DONE |
| I33-2 | Write `backfillPrimaryBillingContact` migration (`@convex-dev/migrations`) defaulting missing rows to `"father"` | BACKEND AGENT | [x] DONE |
| I33-3 | Write `renameInvoiceStatusSentToIssued` migration scanning `by_status` for `"sent"` rows | BACKEND AGENT | [x] DONE (ran 0 rows; code preserved in comments) |
| I33-4 | Run both migrations against the dev dataset | BACKEND AGENT | [x] DONE (27 students backfilled, 0 invoices migrated) |
| I33-5 | Narrow schema: require `primaryBillingContact`; drop `"sent"` from `invoices.status` union | BACKEND AGENT | [x] DONE |
| I33-6 | Update every Convex `"sent"` reference to `"issued"` (`convex/invoices.ts`, crons, audit logs) | BACKEND AGENT | [x] DONE |
| I33-7 | Update CONTEXT.md to remove the `sent`/`issued` flagged ambiguity | BACKEND AGENT | [x] DONE |
| I33-8 | TDD: extract `migrateOne` body to pure `lib/applyBillingContactBackfill.ts` + unit test (RED → GREEN → REFACTOR) | BACKEND AGENT | [x] DONE — 4 tests passing |
| I33-9 | Backend review of I33-1 through I33-8 against the CLAUDE.md checklist | BACKEND REVIEW AGENT | [x] APPROVED 2026-06-03 |
| I33-10 | Fix stale doc-comment at `convex/invoices.ts:727` referencing `sent` (non-blocking review note) | BACKEND AGENT | [x] DONE |
| I33-11 | Run `npm test`, `npm run build`, `npm run lint` — confirm 0 errors | CODING AGENT | [x] DONE — 249/249 tests, 17 routes, 0 lint errors |

### Decisions Made
- 2026-06-03: `/prototype/` mock files left referencing `"sent"` since they are throwaway design variants, not production code (per Frontend Review acceptance pattern). Confirmed no `"sent"` references in `app/` non-prototype paths, `components/`, `hooks/`, or `lib/`.
- 2026-06-03: Extracted `applyBillingContactBackfill` as a pure function in `lib/` so the migration decision rule is unit-testable independently of the Convex `migrations.define` wrapper.
- 2026-06-03: Status-rename migration code removed after running (would be untypeable against the narrowed schema). Full re-run recipe preserved in a code block inside the comment so prod operators do not need to dig through git history.

### Review Notes
**Backend Review (I33-9) — APPROVED 2026-06-03:**
All checklist items pass. Schema correctly narrowed; `primaryBillingContact` required, `"sent"` removed from `invoices.status` union, `by_status` index intact, all 6 indexes used by `invoices.ts` declared. Every mutation/query in `convex/invoices.ts` calls `requireRole(ctx, ["admin"])` first. Every status comparison uses `"issued"`. `transitionOverdueInvoices` cron correctly walks `by_status` with `"issued"` and patches past-due rows. All `.take(N)` caps documented as constants (10000/2000/1000) — no unbounded `.collect()`. No N+1 — per-row enrichment via `Promise.all` over deduped id sets. Error messages do not leak schema. `applyBillingContactBackfill` pure function + 4 tests cover all branches.

Non-blocking observations:
1. `/prototype/` exemption acceptable.
2. `generateInvoice` by-invoice-number collision retry is fine — Convex serialises mutations.
3. `getInvoices` post-pagination search is intentional and commented.
4. ✅ Fixed: stale doc-comment at `convex/invoices.ts:727` updated `sent` → `issued`.

---

## Current Build Status
- `npm run build`: PASSING (17 routes + Proxy Middleware)
- `npm run lint`: PASSING (207 files, 0 errors)
- `npm test`: PASSING (18 files, 249 tests)
- Playwright smoke tests: 6/6 PASSING
- `npx tsc --noEmit`: PASSING (0 errors) — verified 2026-05-18

---

---

## Fee Management Bug Fixes (2026-05-09)
**Status**: Planning
**Active Agent**: PLANNING AGENT

### Summary
Three reported issues with the fee management system:

1. **Feature A — CollectFeesDialog overflow + compact UX**: When 12+ fees are selected the
   dialog overflows the viewport. Each fee is shown as a full card with Original/To Collect
   lines. Redesign to group same-structure fees into a single compact summary row
   (e.g., "Sports × 12 months (Jul 2026 – Feb 2027) — ৳18,000") with an optional expand
   toggle to see individual fees. Dialog must stay within the viewport at all times.

2. **Feature B — Delete accidentally assigned fee**: No way to remove an unpaid fee that
   was assigned by mistake. Needs a backend `deleteStudentFee` mutation (admin-only, unpaid
   only) and a frontend "Delete Fee" option in the "..." dropdown on each fee row in FeesTab,
   protected by a confirmation dialog.

### Files in scope
- `convex/studentFees.ts` — add `deleteStudentFee` mutation
- `convex/auditLogs.ts` — `logAudit` must be called from the new mutation (already imported in studentFees.ts)
- `app/(dashboard)/students/[studentId]/_components/CollectFeesDialog.tsx` — compact grouped display
- `app/(dashboard)/students/[studentId]/_components/FeesTab.tsx` — delete option in "..." dropdown

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Deleting a fee that has a partial payment — balance > 0, paidAmount > 0 | Mutation must block deletion if `paidAmount > 0` (not just `status !== "paid"`). Even "unpaid" status can have partial-but-unrecorded context. Rule: only allow delete when `paidAmount === 0`. |
| 2 | feeTransactions rows reference the studentFee via `feeId` — deleting the fee leaves orphaned transactions | Block deletion if any `feeTransactions` row references this fee (use `by_student` index to find transactions for the student and filter by `feeId`). This is stricter and safer than checking `paidAmount`. |
| 3 | Double-delete: user clicks delete twice before mutation returns | Confirmation dialog's confirm button must be disabled during submission with `isDeleting` state. |
| 4 | Grouping logic in CollectFeesDialog — a structure with both monthly and one-off fees (same feeStructureId but one fee has no billingPeriod) | Non-monthly fees (no billingPeriod) should never be grouped; they always render as individual cards. Only fees with `billingPeriod` and matching `feeStructureId` are eligible for grouping. |
| 5 | Grouped row "Sports × 12 months (Jul 2026 – Feb 2027)" — what if the months are non-contiguous? | Display as "Sports × N fees" without a date range if the months are non-contiguous; date range label only when contiguous. `formatBillingPeriod` already exists — parse first/last period. |
| 6 | Removing one month from a grouped set — does the grouped row collapse or update count? | The existing `removeFee` already enforces sequential removal (`getSequentialRemovalIds`). After removal the group simply re-renders with updated count. No extra logic needed. |
| 7 | CollectFeesDialog is currently 422 lines — adding grouping logic will grow it further | Extract the new grouped-fee section into a `GroupedFeeRow` sub-component in the same file (same pattern as the existing `PerStructureFutureMonths` sub-component). No new file unless it grows past ~600 lines. |
| 8 | Delete option only appears on `status !== "paid"` rows — need to verify the "paid" guard is enforced server-side | Mutation already calls `requireRole(ctx, ["admin"])`. Add the `paidAmount > 0 || hasFeeTransactions` check as the next guard. Frontend "Delete" item in the dropdown is already only rendered for `status !== "paid"` rows. |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| FM-1 | Add `deleteStudentFee` mutation to `convex/studentFees.ts`. Args: `{ feeId: v.id("studentFees") }`. Handler: (1) `requireRole(ctx, ["admin"])` first, (2) fetch the fee record — throw "Fee not found" if missing, (3) check `fee.paidAmount > 0` — throw "Cannot delete a fee with recorded payments", (4) query `feeTransactions` for any row with `feeId` matching using `by_student` index filtered by this studentId + feeId — throw "Cannot delete a fee with existing transactions", (5) `ctx.db.delete(feeId)`, (6) `logAudit(ctx, { user, action: "delete", entityType: "studentFees", entityId: feeId, description: "Deleted student fee" })`. Return void. | BACKEND AGENT | [ ] Pending | No schema change required — `by_student` index already exists on feeTransactions and `by_student_year` index exists on studentFees |
| FM-2 | Backend review of FM-1. Verify: requireRole present and first, paidAmount guard correct, feeTransactions orphan check present, logAudit called, no N+1 (single `ctx.db.get` + one index query), error messages don't leak internals, return type void. | BACKEND REVIEW AGENT | [ ] Pending | Blocked by FM-1 |
| FM-3 | Redesign fee display in `CollectFeesDialog.tsx`. Replace the flat `selectedFees.map(...)` card list with a grouped display. Logic: split `selectedFees` into two buckets — (a) fees with `billingPeriod` grouped by `feeStructureId`, (b) fees without `billingPeriod` rendered as individual cards (unchanged). For each group in bucket (a): render a `GroupedFeeRow` sub-component showing fee type name, count, date range (contiguous → "Jul 2026 – Feb 2027"; non-contiguous → "N fees"), total balance, and a chevron toggle to expand individual fee cards within the group. The remove (X) button on each individual fee within an expanded group still calls the existing `removeFee`. Non-monthly individual cards render exactly as they do today. The `ScrollArea`, `grandTotal`, payment mode, remarks, and action buttons are unchanged. Extract the new sub-component as `GroupedFeeRow` inside the same file below the existing `PerStructureFutureMonths` definition. | FRONTEND AGENT | [ ] Pending | Blocked by FM-2. No new Convex queries needed — all data already in `selectedFees`. Use `ChevronDown`/`ChevronRight` from lucide-react. |
| FM-4 | Add "Delete Fee" option to the fee row dropdown in `FeesTab.tsx`. Steps: (1) import `useMutation` and `api.studentFees.deleteStudentFee`, (2) add state `deletingFeeId: Id<"studentFees"> | null` and `isDeleting: boolean`, (3) add a `DropdownMenuSeparator` and a `DropdownMenuItem` with red text ("Delete Fee") inside the existing DropdownMenuContent — only for `status !== "paid"` rows (already gated by the outer condition), (4) clicking "Delete Fee" sets `deletingFeeId` and opens a confirmation `AlertDialog` (inline — small, single-page-use), (5) confirmation calls `deleteStudentFee({ feeId })` with `isDeleting` guard on the confirm button, (6) on success: `toast.success("Fee deleted")` + clear state; on error: `toast.error(message)` + clear `isDeleting`. The AlertDialog and its state live inside `FeesTab` (not extracted — ≤3 interactions, single-page use per inline dialog pattern). | FRONTEND AGENT | [ ] Pending | Blocked by FM-2. FM-3 and FM-4 can be done in the same Frontend Agent session as they touch different components with no shared state. |
| FM-5 | Frontend review of FM-3 and FM-4. Check: (1) grouped display handles 0-fee edge (never shown), 1-fee group (still shows grouped row, not just a flat card), and 12-fee group correctly; (2) expand/collapse toggle has aria-label and aria-expanded; (3) individual fee cards within expanded group still show remove (X) button; (4) non-monthly fees render as individual cards unchanged; (5) delete confirmation AlertDialog has disabled confirm button during `isDeleting`; (6) Sonner toast on delete success and error; (7) no `any` types; (8) no hardcoded hex; (9) dialog still fits viewport with 12 fees grouped. | FRONTEND REVIEW AGENT | [ ] Pending | Blocked by FM-3 and FM-4 |
| FM-6 | Run `npm run build` and `npm run lint`. Confirm 0 errors. Update build status line. | CODING AGENT | [ ] Pending | Blocked by FM-5 |

### Dependencies and Blockers
- FM-1 (backend mutation) has no external blockers — no schema change, no new index, imports already in place.
- FM-2 (backend review) gates all frontend work.
- FM-3 and FM-4 are independent of each other and can run in one Frontend Agent session after FM-2 is approved.
- FM-5 (frontend review) requires both FM-3 and FM-4 to be complete.
- FM-6 is the final integration check.

### Agent Notes — FM-1 (BACKEND AGENT)
- The `feeTransactions` table has a `by_student` index on `["studentId"]`, not on `feeId`. To check for orphaned transactions: query `feeTransactions` with `by_student` index for the fee's `studentId`, then `.filter(q => q.eq(q.field("feeId"), feeId))` or use `.take(100)` and filter in JS. A `.take(1)` with filter is sufficient — we only need to know if any exist, not count them.
- Do not add a new index for this check. The `feeTransactions` table is low-cardinality per student; filtering in JS after a `by_student` index read is acceptable.
- Import `logAudit` is already at line 3 of `convex/studentFees.ts` — no new import needed.
- Error message for paid fee: "Cannot delete a fee that has already been paid or partially paid". Error message for existing transactions: "Cannot delete a fee that has recorded transactions". Neither reveals table names or internal field names.

### Agent Notes — FM-3 (FRONTEND AGENT)
- The existing `groupMonthlyStructures` utility from `lib/perStructureFutureMonths` groups by structure for the "Add Future Months" section but is not appropriate here — it is designed for future month selection, not for display grouping. Write a small pure function `groupFeesByStructure` at the top of `CollectFeesDialog.tsx` (not in a lib file — it is only used here). It takes `FeeForCollection[]` and returns `{ monthly: Map<string, FeeForCollection[]>, individual: FeeForCollection[] }` where monthly groups contain only fees with `billingPeriod`.
- Contiguous date range detection: sort the `billingPeriod` strings for a group (they are `"YYYY-MM"` format, so lexicographic sort is chronologically correct). Check that each consecutive pair differs by exactly one month. If contiguous, format as `"MMM YYYY – MMM YYYY"` using `formatBillingPeriod` on the first and last. If not contiguous, use `"N fees"` label.
- The `ChevronDown` and `ChevronRight` icons are already available from `lucide-react` (used elsewhere in this project).
- Ensure the `GroupedFeeRow` sub-component accepts `fees: FeeForCollection[]`, `onRemove: (id: string) => void`, `isExpanded: boolean`, `onToggle: () => void` props. The expanded/collapsed state is managed by the parent `CollectFeesDialog` using a `Set<string>` keyed by `feeStructureId` — this is the same pattern already used for `expandedStructures`.

### Agent Notes — FM-4 (FRONTEND AGENT)
- The `AlertDialog` for delete confirmation is inline in `FeesTab.tsx`. It follows the same inline pattern used in `app/(dashboard)/admin/promotions/page.tsx` (confirm action AlertDialog). Do not create a separate file.
- The delete dropdown item should use `className="text-red-600 focus:text-red-600"` to visually signal destructive action — consistent with the pattern in other destructive DropdownMenuItems in this codebase.
- Add a `DropdownMenuSeparator` between "Collect Fee" and "Delete Fee" in the dropdown.
- After a successful delete the `fees` query will auto-update via Convex reactivity — no manual refetch needed. Clear `deletingFeeId` and `isDeleting` in the `finally` block.

### Decisions Made
- 2026-05-09: No schema change for this feature. The existing `by_student_year` and `by_feeStructure` indexes on `studentFees` are sufficient; the existing `by_student` index on `feeTransactions` is sufficient for the orphan check.
- 2026-05-09: Delete is blocked when `paidAmount > 0` OR when any `feeTransactions` row references the fee — belt-and-suspenders guard against data loss.
- 2026-05-09: Grouping logic for CollectFeesDialog lives in a pure function inside the component file (not in `lib/`) — it is only used in one place.
- 2026-05-09: The `GroupedFeeRow` sub-component lives in the same file as `CollectFeesDialog` following the existing `PerStructureFutureMonths` sub-component pattern.

---

## Transaction Log Filter UI Redesign (2026-05-18)
**Status**: In Progress (TF-R3, TF-R4)
**Active Agent**: FRONTEND AGENT

### Summary
The current TransactionFilters component uses a flat grid that injects extra sub-picker rows
when the user selects a date preset (monthly, quarterly, half-yearly, custom), causing visible
layout shifts. The redesign introduces a stable two-tier filter layout (primary row always
visible; secondary row expandable via "More Filters"), replaces all sub-picker injection with
a unified DateRangePicker popover (preset sidebar + two-month range calendar), and adds a
mobile bottom sheet that collapses all filters behind a single "Filters" button.

No backend changes are required. The hook still produces `dateFrom`/`dateTo` as Unix timestamps
for `queryArgs`; only the internal state shape and the UI change.

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | DateRange state in the hook is currently `dateRangePreset` + `selectedPeriod` + `customDateFrom/To` — consumers of the hook (page.tsx, ExportButton) read `filters.dateRangeLabel`. Refactoring the hook internal state must not break the `dateRangeLabel` string or `queryArgs` shape. | TF-R2 (hook refactor) must output an identical `queryArgs` object and a `dateRangeLabel` string. Unit-test the label output before wiring to the page. |
| 2 | The DateRangePicker popover holds both a preset list and a two-month calendar — if popover width is constrained on small desktop (< 900px) the calendar overflows. | Constrain popover width with `min-w-[560px]` desktop and drop to single-month on screens narrower than `md` via a `useWindowSize` check or a CSS approach. |
| 3 | "More Filters" badge count could show a stale count if campus/paymentMode is reset without going through resetAll. | Badge count derived live from `campusFilter`, `paymentMode`, `includeVoided` values — not stored separately. Any state change automatically updates the count. |
| 4 | Mobile bottom sheet overlaps system navigation on iOS if the sheet extends to full viewport height. | Use `max-h-[90dvh] overflow-y-auto` on the sheet content — the `dvh` unit accounts for browser chrome. |
| 5 | The calendar component uses `react-day-picker` which already supports `mode="range"` — but the existing `CalendarDayButton` override may not correctly style range-start/middle/end for the new two-month usage. | TF-R1 verifies range styling is correct using `numberOfMonths={2}` in a Popover before wiring to the hook. Read the existing classNames for `range_start`, `range_middle`, `range_end` — they are already present. No changes to calendar.tsx needed. |
| 6 | Removing `computeDateRange`, `formatDateRangeLabel`, and `PeriodForPreset` from `dateRangeUtils.ts` may break other files that import them (e.g., any future feature that used them). | Grep for all import sites before deleting. Only delete if there are zero remaining import sites. |
| 7 | Playwright tests require an authenticated session to reach the /admin/transactions page. Current smoke tests are unauthenticated. | Write Playwright tests that assert on the filter bar's static structure (desktop primary row elements, "More Filters" button, Reset link) without requiring a real authenticated session, using `page.route` to mock the Convex API, OR test only what the anonymous user sees (redirect to /login). Flag authenticated-session tests as Phase 5 TODOs. |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| TF-R1 | Build `components/ui/date-range-picker.tsx` + `hooks/use-media-query.ts`. DateRangePicker: Popover with preset sidebar (9 presets), Calendar mode="range" (2 months desktop, 1 mobile), responsive layout (flex-row desktop, flex-col mobile). Exported `getPresetRange` pure function. SSR-safe `useMediaQuery` hook. | FRONTEND AGENT | [x] DONE | 0 TS errors in both files. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R2 | Refactor `hooks/use-transaction-filters.ts`. Replaced `dateRangePreset`/`selectedPeriod`/`customDateFrom`/`customDateTo` with `dateRange`/`datePresetLabel`. Updated `TransactionFilterState` interface, `resetAll`, `hasActiveFilters`, and return value. Removed `dateRangeUtils` imports. | FRONTEND AGENT | [x] DONE | 0 TS errors in hook file. Expected 8 downstream errors in page.tsx (old props) — fixed in TF-R3/TF-R4. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R3 | Rewrite `TransactionFilters.tsx` with two-tier layout: primary row (Academic Year, Standard Level, DateRangePicker, Student Search, More Filters + Badge, Reset), secondary row (Campus, Payment Mode, Show Voided) with CSS grid animation. Removed all sub-picker injection blocks, old DatePicker, MONTH_LABELS. Uses `<section>` for a11y. Auto-expands secondary row when secondary filters are active. | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (TF-R8). 0 TS errors, 0 lint errors. |
| TF-R4 | Updated `page.tsx` to match new TransactionFilters props. Replaced 12 old date-related props with `dateRange`, `onDateRangeChange`, `datePresetLabel`, `onPresetSelect`, `onDateClear`. Added `PaymentMode` cast wrapper for type compatibility. ExportButton unchanged (still receives `dateRangeLabel`). | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (TF-R8). 0 TS errors, build PASSING (15 routes), lint PASSING (161 files, 0 errors). |
| TF-R5 | Add mobile bottom sheet to `TransactionFilters.tsx`. Mobile layout (`block sm:hidden`) shows a "Filters" Button with Badge for active count that opens a shadcn Sheet (`side="bottom"`) with all filters stacked vertically. Desktop layout wrapped in `hidden sm:block`. Sheet content uses `max-h-[85vh] overflow-y-auto`. | FRONTEND AGENT | [x] DONE | Completed 2026-05-18. Desktop layout wrapped in `hidden sm:block`, mobile Sheet with all 7 filters stacked vertically, Apply/Reset footer buttons, totalActiveCount badge. 0 TS errors, build PASSING (15 routes), lint PASSING (161 files, 0 errors). Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R6 | Clean up dead code. In `lib/dateRangeUtils.ts`: grep for all import sites of `computeDateRange`, `formatDateRangeLabel`, `PeriodForPreset`, `DateRangePreset` (old union type). Delete any functions and types that have zero remaining import sites after TF-R2 and TF-R3. In `hooks/use-transaction-filters.ts`: remove any remaining unused imports. In `TransactionFilters.tsx`: remove any unused imports (e.g., `MONTH_LABELS`, the old `DatePicker` sub-component). Run `npm run lint` to catch any remaining dead imports. If `DateRangePreset` is still imported elsewhere for the old preset values, keep the type but remove the computation functions. | FRONTEND AGENT | [ ] Pending | Blocked by TF-R5. Grep before deleting. |
| TF-R7 | Playwright tests for the redesigned filter bar. Write or update tests in the `e2e/` directory. Test 1: navigate to `/admin/transactions` unauthenticated — assert redirect to `/login` (existing smoke test pattern). Test 2: assert the desktop filter bar container renders with the correct landmark structure when the page loads (check for `aria-label="Transaction filters"` or the equivalent container). Test 3: assert "More Filters" button is present in the desktop layout. Test 4: assert the mobile "Filters" button is present at `viewport: { width: 375, height: 812 }`. Note: full authenticated flow tests are deferred to Phase 5 as before. Invoke `playwright-cli` skill. | FRONTEND AGENT | [x] DONE | Completed 2026-05-18. 13 tests in `e2e/transaction-filters.spec.ts`: 1 auth-gate redirect test, 9 desktop filter structure tests (landmark, selects, picker, search, more-filters toggle, reset, secondary row expand/collapse, DateRangePicker popover with presets + calendar), 3 mobile tests (filters button visibility, bottom sheet controls, reset/apply buttons). All tests use `test.skip()` pattern for auth-gated pages. 0 TS errors, 0 lint errors. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R8 | Frontend review of TF-R1 through TF-R7. Checklist: (1) DateRangePicker — preset sidebar fires `onChange` correctly, trigger label updates, range mode calendar highlights range-start/middle/end; (2) primary row is stable — no layout shift when date range changes; (3) secondary row expand/collapse is animated, has correct aria-expanded; (4) "More Filters" badge count is accurate for 0, 1, 2, 3 active secondary filters; (5) Reset ghost link disables when `!hasActiveFilters`; (6) mobile sheet is `side="bottom"`, has `max-h-[90dvh]`, single-month calendar; (7) no `any` types; (8) no hardcoded hex; (9) all interactive elements have aria-labels; (10) `dateRangeLabel` still flows to ExportButton correctly; (11) Playwright tests pass. | FRONTEND REVIEW AGENT | [ ] Pending | Blocked by TF-R7 |
| TF-R9 | Run `npm run build` and `npm run lint`. Confirm 0 errors. Update Current Build Status. | CODING AGENT | [ ] Pending | Blocked by TF-R8 |

### Dependencies and Blockers
- TF-R1 (DateRangePicker component) has no external blockers — it is a self-contained UI component.
- TF-R2 (hook refactor) is blocked on TF-R1 being finalized so the `dateRange` type shape is settled. TF-R1 and TF-R2 can be done in the same Frontend Agent session.
- TF-R3 (TransactionFilters component rewrite) requires TF-R2 to be complete — it imports DateRangePicker and uses the new hook props.
- TF-R4 (page.tsx wiring) requires TF-R3 — it passes the new props.
- TF-R5 (mobile bottom sheet) requires TF-R4 — it lives in the same page file.
- TF-R6 (dead code cleanup) requires TF-R5 — all consumers must be updated before functions can be safely deleted.
- TF-R7 (Playwright tests) requires TF-R5 — all UI must be in place before assertions can be written.
- TF-R8 (frontend review) requires TF-R1 through TF-R7 all complete.
- TF-R9 (build/lint check) is the final integration gate.

### Agent Notes — TF-R1 (FRONTEND AGENT)
- The `Calendar` component in `components/ui/calendar.tsx` already has `range_start`, `range_middle`, `range_end` classNames wired. Pass `mode="range"` and `numberOfMonths={2}` directly — no changes to `calendar.tsx` needed.
- Preset-to-date-range computation: implement a pure function `presetToDateRange(preset: string): { from: Date; to: Date }` inside the component file. Use `date-fns` helpers (`startOfDay`, `endOfDay`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `startOfQuarter`, `endOfQuarter`, `subMonths`, `subQuarters`). For "All Time": return `{ from: undefined, to: undefined }`.
- Use `date-fns` `format(date, "MMM d, yyyy")` for the trigger label when showing a custom range. Show just the preset name (e.g., "This Month") when a preset is active.
- The popover content layout: `flex` with `w-[180px]` left sidebar and `flex-1` right calendar area. On `sm` breakpoint and below, collapse to `flex-col` with just the preset list and single-month calendar stacked.
- The shadcn `Popover` component already handles open/close animation via Radix UI — no extra animation code needed.

### Agent Notes — TF-R2 (FRONTEND AGENT)
- The new state shape: `const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })` and `const [presetLabel, setPresetLabel] = useState<string | null>(null)`.
- `dateFrom` in `queryArgs`: `dateRange.from ? startOfDay(dateRange.from).getTime() : undefined` (use `date-fns` `startOfDay`).
- `dateTo` in `queryArgs`: `dateRange.to ? endOfDay(dateRange.to).getTime() : undefined` (use `date-fns` `endOfDay` to include the full last day).
- `dateRangeLabel`: `presetLabel ?? (dateRange.from && dateRange.to ? format(dateRange.from, "MMM d") + " – " + format(dateRange.to, "MMM d, yyyy") : "")`.
- `hasActiveFilters`: include `dateRange.from !== undefined` in the check.
- `resetAll`: set `setDateRange({ from: undefined, to: undefined })` and `setPresetLabel(null)`.
- The hook exports `{ dateRange, setDateRange, presetLabel, setPresetLabel, dateRangeLabel, ... }` — these replace `dateRangePreset`, `setDateRangePreset`, `selectedPeriod`, `setSelectedPeriod`, `customDateFrom`, `setCustomDateFrom`, `customDateTo`, `setCustomDateTo`.

### Agent Notes — TF-R3 (FRONTEND AGENT)
- The secondary row animation: use the Tailwind `grid` rows trick. Wrap the secondary row in `<div className="grid transition-all duration-300 ease-in-out" style={{ gridTemplateRows: showSecondary ? '1fr' : '0fr' }}>` with an inner `<div className="overflow-hidden">` containing the controls. This avoids any JS animation library and works with Tailwind v4.
- The "More Filters" button: `<Button variant="outline" size="sm" onClick={() => setShowSecondary(s => !s)} aria-expanded={showSecondary} aria-label="Show more filters">`. The Badge showing count is inside the button: `{secondaryActiveCount > 0 && <Badge className="ml-1.5 h-4 w-4 ...">{secondaryActiveCount}</Badge>}`.
- `secondaryActiveCount`: computed as `[campusFilter, paymentMode, includeVoided ? "voided" : undefined].filter(Boolean).length`.
- The Reset link: `<Button variant="ghost" size="sm" onClick={onReset} disabled={!hasActiveFilters} className="text-muted-foreground">Reset</Button>` — right-aligned using `ml-auto` in the flex row.
- StudentSearch sub-component can be kept as-is from the existing TransactionFilters file — move it to the bottom of the new file.

### Agent Notes — TF-R5 (FRONTEND AGENT)
- The mobile total active count for the "Filters (N)" badge: `[filters.standardLevelId, filters.campusFilter, filters.paymentMode, filters.includeVoided ? "v" : undefined, filters.dateRange.from ? "d" : undefined, filters.studentIds?.length ? "s" : undefined].filter(Boolean).length`.
- Academic Year is always visible and not counted in the mobile filter badge — it is the primary context selector.
- The Sheet footer: `<div className="flex gap-2 border-t pt-4"><Button variant="ghost" onClick={filters.resetAll}>Reset</Button><Button onClick={() => setMobileOpen(false)}>Apply</Button></div>`.

### Agent Notes — TF-R6 (FRONTEND AGENT)
- Before deleting from `lib/dateRangeUtils.ts`: run `grep -r "computeDateRange\|formatDateRangeLabel\|PeriodForPreset" --include="*.ts" --include="*.tsx" .` and confirm zero results outside the file itself.
- The `DateRangePreset` type name will no longer be needed in the hook or TransactionFilters — but check if it is re-exported or used in any other file before removing from `dateRangeUtils.ts`.
- The `MONTH_LABELS`, `DatePicker`, and `MONTH_NAMES` constants in the old `TransactionFilters.tsx` become dead code after the rewrite — they will not exist in the new file.

### Decisions Made
- 2026-05-18: No backend changes for this redesign — the `queryArgs` shape is unchanged (still `dateFrom`/`dateTo` as Unix timestamps).
- 2026-05-18: Tailwind `grid` rows trick chosen for secondary row animation over framer-motion — no new dependency needed.
- 2026-05-18: Mobile bottom sheet uses `hidden sm:block` / `block sm:hidden` visibility toggle — no `useMediaQuery` hook needed.
- 2026-05-18: `DateRangePicker` built as a new file (`components/ui/date-range-picker.tsx`) — reusable across the app, not inline.
- 2026-05-18: Authenticated Playwright E2E tests deferred — current smoke test suite (6 unauthenticated tests) is extended with structure-level assertions only.

---

## Decisions Made
- 2026-04-05: Reuse Convex deployment hushed-bass-123 (no migration cost)
- 2026-04-05: Build from scratch per CLAUDE.md spec (no v1 code copy-paste)
- 2026-04-05: Use full CA-1/2/3 assessment system from v1 (not simple per-subject grades)
- 2026-04-05: Phase 2 GradesTab placeholder replaced with full CA-1/2/3 system immediately
- 2026-04-05: Pagination added to getAllStudents from day 1
- 2026-04-05: z.boolean().default(false) removed from Zod schema — using defaultValues in useForm instead
- 2026-04-05: studentInfoSchema exports both base (ZodObject) and refined (ZodEffects) to support .merge()
- 2026-04-05: Legacy v1 fields added as optional to schema (createdAt, isActive on assessmentQuestions, etc.)
- 2026-04-05: feeTransactions.paymentMode expanded to include UPI and Online (v1 data had these)
- 2026-04-05: reportCards.fileUrl stores v.id("_storage") not URL string; URL resolved in query

---

## Invoicing Feature — Issue #24 (2026-05-28)
**Status**: IN PROGRESS
**Active Agent**: BACKEND AGENT
**Branch**: feature/invoicing

### Scope
Foundation for the invoicing feature:
1. `invoices` table on `convex/schema.ts` with full field set and 6 indexes
2. Pure utility module `lib/invoiceUtils.ts` (TDD-first)
3. `convex/invoices.ts` with `generateInvoice` and `voidInvoice` mutations
4. Audit logging via existing `logAudit` helper
5. Add `"void"` AuditAction (closest match for voiding an invoice — `"delete"` is wrong since the record persists)

### Sub-tasks
- [x] INV-1 lib/invoiceUtils.ts — 4 pure functions + 31 vitest cases — DONE (TDD: RED → GREEN)
- [x] INV-2 convex/schema.ts — added `invoices` table with all 6 indexes — DONE
- [x] INV-3 convex/auditLogs.ts + schema — added `"void"` AuditAction — DONE
- [x] INV-4 convex/invoices.ts — `generateInvoice` mutation with line-item snapshot, sequential numbering with collision retry, audit log — DONE
- [x] INV-5 convex/invoices.ts — `voidInvoice` mutation with paid/voided guards, audit log — DONE
- [x] INV-6 Verification — npm run test (144/144), biome lint (changed files clean), npm run build (passes), `npx convex dev --once` (schema validates + functions deploy) — DONE
- [x] INV-7 BACKEND REVIEW AGENT approval — APPROVED (2026-05-28)

### Review Notes
**Backend Review (INV-1 through INV-6):** APPROVED 2026-05-28. All CLAUDE.md backend checklist items satisfied: requireRole first in both mutations; v.id() + runtime validation on all args; no unbounded collects (.take(10000) cap with documented rationale and collision retry as safety net); all `withIndex` calls use declared indexes; Promise.all for batched fee + structure lookups (no N+1); error messages generic (no table names); line items snapshot semantics correct (invoice is immutable post-creation); audit log on every mutation via `logAudit`; storage IDs N/A. Non-blocking observation: 10k scan cap is generous for current scale; upgrade path if ever needed is a per-year counter doc. Build green, 144/144 tests pass, `npx convex dev --once` succeeds.

### Notes
- `feeCollectionSessions.invoiceNumber` is a separate existing concept (timestamp-based, generated by `lib/feeCollectionUtils.ts#generateInvoiceNumber`). The new `invoices` table is intentionally distinct.
- The audit log helper exposed by `convex/auditLogs.ts` is `logAudit` (not `insertAuditLog`).
- `requireRole` resolves user via JWT subject `userId|sessionId`, no email needed.
- The full `npm run lint` fails because of a pre-existing nested `biome.json` in `.sandcastle/worktrees/...` (untracked dev infra). The `worktrees/` directory is listed in `.sandcastle/.gitignore` and is outside this issue's scope. All of the files I changed lint cleanly when checked directly.
- Breaking change to frontend: `app/(dashboard)/admin/audit-log/page.tsx` had to add `"void"` to `ACTION_OPTIONS` and `ACTION_BADGE_STYLES` to keep the build green (`Record<AuditAction, string>` exhaustiveness check). FRONTEND AGENT should be aware that the audit log filter now includes a "Void" option.

---

## Invoicing Feature — Issue #25 (2026-05-28)
**Status**: IN PROGRESS
**Active Agent**: BACKEND AGENT
**Branch**: feature/invoicing

### Scope
Invoice list query, aggregates, and overdue cron:
1. Pure utility module `lib/invoiceAggregates.ts` (TDD-first) — computeInvoiceAggregates, matchesInvoiceSearch, isInvoiceOverdue
2. `convex/invoices.ts` extended with: `getInvoices` (paginated + enriched), `getInvoiceAggregates` (summary cards + status tab counts), `getInvoiceById` (detail), `transitionOverdueInvoices` (internalMutation cron target)
3. `convex/crons.ts` — daily cron at 01:00 UTC to flip sent → overdue when due date has passed

### Sub-tasks
- [x] INV25-1 lib/invoiceAggregates.ts — 3 pure utilities + 28 vitest cases (TDD: RED → GREEN) — DONE
- [x] INV25-2 convex/invoices.ts — `getInvoices` query (index-aware, paginated, enriched) — DONE
- [x] INV25-3 convex/invoices.ts — `getInvoiceAggregates` query (with statusCounts that ignore status filter) — DONE
- [x] INV25-4 convex/invoices.ts — `getInvoiceById` query (line-item fee structure resolution, user enrichment) — DONE
- [x] INV25-5 convex/invoices.ts — `transitionOverdueInvoices` internalMutation (`.take(1000)` on by_status) — DONE
- [x] INV25-6 convex/crons.ts — daily cron @ 01:00 UTC → internal.invoices.transitionOverdueInvoices — DONE
- [x] INV25-7 Verification — `npm test` 172/172, biome lint changed files clean, `npm run build` success, `npx convex dev --once` deploys in 5.33s — DONE
- [x] INV25-8 BACKEND REVIEW AGENT approval — APPROVED (2026-05-28)

### Review Notes
**Backend Review (INV25-1 through INV25-7):** APPROVED 2026-05-28. All CLAUDE.md backend checklist items satisfied. requireRole first in every query; no unbounded collects (take 2000/1000/1, paginate elsewhere); all withIndex calls use declared indexes (by_year_level, by_year, by_status); enrichment uses Promise.all everywhere (no N+1); JSDoc on every exported function; search-post-pagination behaviour explicitly documented to prevent future "fixes"; status counts ignore status filter so the tab UI stays stable; dynamic overdue rule (sent + past due) consistently applied in aggregates AND statusCounts. The `q.eq(q.field("status"), q.field("status"))` tautology in `.filter()` is the standard workaround for Convex's lack of a no-op filter operator — flagged for awareness, not a defect. Build green; 172/172 vitest; `npx convex dev --once` succeeds in 5.33s; `npm run build` passes including TypeScript phase.

### Notes
- No schema changes were needed — all required indexes (by_year, by_year_level, by_status, by_student_year, by_invoice_number, by_due_date) already exist from Issue #24.
- Search is applied post-pagination by design — documented in `getInvoices` JSDoc; a single page may return fewer than `paginationOpts.numItems` results. This avoids the alternative of `.collect()`-then-filter-then-paginate, which would defeat the read cap.
- `getInvoiceAggregates` accepts `search` for arg-shape parity with `getInvoices` but intentionally does NOT apply it (the status counts must be search-independent so the tab labels remain stable as the user types).
- The cron `convex/crons.ts` did not exist; it is created in this issue. Convex auto-registers it because `_generated/api.ts` now imports `../crons.js`.
- `transitionOverdueInvoices` is an `internalMutation` (no client-facing surface area, no requireRole — that is the correct pattern per Convex docs).
- Return shapes for the FRONTEND AGENT are documented in the final assistant message of this conversation.

---

## Invoicing Feature — Issue #27 (2026-05-28) + follow-up refactor (2026-06-01)
**Status**: APPROVED
**Active Agent**: FRONTEND REVIEW AGENT
**Branch**: feature/invoicing

### Scope
Build the reusable production InvoiceDocument component that the side-sheet preview (Issue #29) will consume. Pure utilities first (TDD), then component.

### Sub-tasks
- [x] INV27-1 lib/dateFormat.ts — `fmtDayMonthYear(ms)` zero-padded DD/MM/YYYY + 7 vitest cases (typical, single-digit pad, end-of-year, start-of-year, 0/NaN/negative defensive) — DONE
- [x] INV27-2 lib/currency.ts — re-exports the project's existing BDT `formatCurrency` from `lib/transactionLogUtils.ts` with 5 smoke tests confirming contract (zero, whole, decimal, negative, identity) — DONE. Decision: do not fragment formatters; the project is BDT, not NGN as the prototype mock claimed.
- [x] INV27-3 components/shared/InvoiceDocument.tsx — happy path + loading skeleton + not-found error state. Toolbar with close on LEFT, Print/PDF/Send on RIGHT (each disabled when handler prop missing). All dates DD/MM/YYYY. Balance red/green. Overdue due-date red. Status pill via co-located `statusBadgeClass`. data-testids: invoice-document, invoice-document-loading, invoice-document-error, invoice-balance, invoice-due-date, invoice-close-button, invoice-print-button, invoice-pdf-button, invoice-send-button — DONE
- [x] INV27-4 Verification — `npm run test` 184/184, `npx biome check` on changed files clean, `npm run build` success, `npx convex dev --once` deploys — DONE
- [x] INV27-5 FRONTEND REVIEW AGENT approval — APPROVED (2026-05-28)
- [x] INV27-6 TDD refactor — `lib/invoiceDocumentDisplay.ts` + `hooks/use-invoice-document.ts` + updated `InvoiceDocument.tsx` to satisfy AC #10 strictly — DONE
- [x] INV27-7 FRONTEND REVIEW AGENT follow-up approval — APPROVED (2026-06-01)
- [x] INV27-8 Post-review cleanup — exposed `status: InvoiceStatus` on the hook's `ready` branch so the component no longer re-casts `invoice.status` (removes the duplicate `as InvoiceStatus` flagged as non-blocking in the review) — DONE
- [x] INV27-9 Verification (post-cleanup) — `npm test` 218/218, `npx tsc --noEmit` clean, `npx biome check` on 4 changed files clean, `npm run build` success, `npx convex dev --once` deploys, Playwright smoke check at `/invoices` loads with no console errors — DONE

### Review Notes
**Frontend Review (INV27-1 through INV27-4):** APPROVED 2026-05-28. All CLAUDE.md frontend checklist items satisfied: loading skeleton matches the document shape, error state with icon + message + close affordance, no TypeScript `any` (one justified `as InvoiceStatus` cast on Convex union return), no hardcoded hex (school-green via Tailwind, all status/balance colors via palette utilities), every icon-only button carries an `aria-label`, mobile responsive at 375px (flex-col → md:flex-row for header, grid-cols-1 → md:grid-cols-2 for bill-to, p-4 → md:p-8 padding), shadcn primitives used throughout (Button, Separator, Skeleton, next/Image), close button on the LEFT of toolbar per Issue #29 contract, all dates DD/MM/YYYY via `fmtDayMonthYear`, currency via `formatCurrency` re-exported from the project's single source of truth, no business logic in component bodies (status badge class + label are presentational helpers). data-testids present for E2E hookup. `aria-busy`/`aria-live="polite"` on loading and `role="alert"` on error are nice extras. Non-blocking observations: (1) school name, address, and finance email are hardcoded to match the prototype — fine for now, should be configurable in a follow-up; (2) toolbar action buttons render disabled when handler is undefined (intentional, keeps layout consistent in the side-sheet preview before later issues wire actions).

**Frontend Review (INV27-6 follow-up refactor):** APPROVED 2026-06-01. AC #10 fix is genuine: `useQuery` is absent from `InvoiceDocument.tsx` (confirmed by grep); the component only calls `useInvoiceDocument(invoiceId)` from `hooks/use-invoice-document.ts`. All 10 vitest cases pass. TypeScript strict mode and Biome both clean across all four files. `FunctionReturnType<typeof api.invoices.getInvoiceById>` + `NonNullable<...>` is idiomatic Convex — the `null` branch is handled explicitly in the hook so callers only ever see `InvoiceDocumentData` on the ready branch. Reviewer flagged one non-blocking observation (duplicate `as InvoiceStatus` cast in the component) — addressed in INV27-8 by exposing `status` on the hook's `ready` branch. Loading skeleton, error state, all data-testids, aria attributes, and responsive layout preserved verbatim. All 10 regression-guard tests pass.

**Verification (INV27-9 post-cleanup):** Run on 2026-06-01. `npm test` → 218/218 (13 files); `npx tsc --noEmit` → clean (no output); `npx biome check` on `components/shared/InvoiceDocument.tsx hooks/use-invoice-document.ts lib/invoiceDocumentDisplay.ts lib/invoiceDocumentDisplay.test.ts` → "Checked 4 files in 28ms. No fixes applied."; `npm run build` → ✓ Compiled successfully; `npx convex dev --once` → ✔ Convex functions ready! (6.67s); Playwright smoke check → logged in as `admin@school.edu`, navigated to `/invoices`, empty state renders ("No invoices yet" with "Generate Invoice" CTA), summary cards show `৳0`, 0 console errors. The production `InvoiceDocument` itself has no live consumer yet (#28 PDF / #29 preview-sheet not implemented), so its rendered output will be visually exercised when #29 lands.

### Notes
- Currency: the spec asked for NGN, but every other production component in the repo uses BDT (`৳`) via `lib/transactionLogUtils.ts#formatCurrency`. To avoid fragmenting the currency formatter across the app, `lib/currency.ts` re-exports the existing BDT formatter. If the school is genuinely changing currency to NGN, that is a one-line edit in `transactionLogUtils.ts` and should be coordinated across all financial UI in a single follow-up.
- The school-name and address strings inside the document header are still hardcoded to match the prototype ("Al-Noor Islamic School", P.O. Box, Lagos). If those need to be configurable (per-campus letterhead?), surface in a follow-up issue — not in scope for #27.
- Toolbar action buttons render as disabled when their handler is undefined so the side-sheet (#29) shows a consistent layout before wiring. Each button has `aria-label` + `data-testid`.
- The error state still includes the close button on the left (when `onClose` is provided) so the side-sheet has a consistent dismiss affordance even on the not-found path.
- Pre-existing full-repo `npm run lint` failure is due to a nested `biome.json` inside the untracked `.sandcastle/worktrees/...` directory — unrelated to this issue. All of the files I changed lint cleanly when checked directly.
- The prototype files in `app/(dashboard)/invoices/prototype/` are intentionally NOT deleted — that happens in Issue #32.

---

## Invoicing Feature — Issue #26 (2026-06-01)
**Status**: COMPLETE
**Active Agent**: CODING AGENT (verification + closure)
**Branch**: feature/invoicing

### Scope
Invoice list page — table, filter toolbar, and summary cards. The main `/invoices` page admins use to manage the full billing pipeline. Filter toolbar with status tabs (counts), class/campus/year selects, search, clear. Four summary cards (total invoiced, collected, outstanding, overdue). Dense data table with three-dot row actions (`MoreHorizontal`).

### Sub-tasks
- [x] INV26-1 `hooks/use-invoice-filters.ts` — URL-synced filter hook with debounced search (300ms), no `nuqs` dep — DONE
- [x] INV26-2 `lib/invoiceTableUtils.ts` + 24 vitest cases — status dot/badge/label, `shouldRenderDueDateRed`, `shouldDisableVoid` — DONE
- [x] INV26-3 `app/(dashboard)/invoices/_components/InvoiceFilterToolbar.tsx` — single bordered card, search + class + campus + year + clear + export — DONE
- [x] INV26-4 `app/(dashboard)/invoices/_components/InvoiceSummaryCards.tsx` — four cards w/ BDT formatting, red highlight on overdue, skeleton state — DONE
- [x] INV26-5 `app/(dashboard)/invoices/_components/InvoiceTable.tsx` — dense table w/ all required columns, footer totals, three-dot menu (`MoreHorizontal`), loading skeleton — DONE
- [x] INV26-6 `app/(dashboard)/invoices/_components/VoidInvoiceDialog.tsx` — destructive confirm dialog, Sonner toast on success/error, disabled buttons during submit — DONE
- [x] INV26-7 `app/(dashboard)/invoices/page.tsx` — `RoleGate(admin)` + `Suspense` + page content wiring queries to components, action handlers placeholder for sibling issues (#28/#29/#31) — DONE
- [x] INV26-8 Verification — `npm test` 208/208, `npm run lint` clean, `npm run build` success, `npx convex dev --once` deploys — DONE
- [x] INV26-9 Browser verification via Playwright — login → /invoices → status tab filter → search → clear flow tested, mobile 375px viewport verified, no console errors — DONE
- [x] INV26-10 BACKEND REVIEW AGENT re-approval (issue #25) — APPROVED (2026-06-01)
- [x] INV26-11 FRONTEND REVIEW AGENT approval — APPROVED (2026-06-01)

### Review Notes
**Backend Review (re-confirm of #25):** APPROVED 2026-06-01. All backend checklist items pass. `getInvoices`/`getInvoiceAggregates`/`getInvoiceById` all gated by `requireRole(["admin"])`. No unbounded `.collect()`; `INVOICE_SCAN_CAP=10000`, `AGGREGATE_SCAN_CAP=2000`, `OVERDUE_SCAN_CAP=1000`. Every `withIndex` matches a declared schema index. `enrichInvoices` batches student/level/campus/year reads with one top-level `Promise.all` (no N+1). Daily cron at 01:00 UTC flips `sent` → `overdue`; never touches `paid`/`voided`. Internal `transitionOverdueInvoices` correctly uses `internalMutation` (no `requireRole`). Error messages generic — no schema leakage. Non-blocking: `q.eq(q.field("status"), q.field("status"))` tautology pattern is the standard Convex filter no-op workaround.

**Frontend Review (Issue #26):** APPROVED 2026-06-01. All CLAUDE.md frontend checklist items satisfied. Route under `(dashboard)/invoices/` wrapped in `RoleGate allowedRoles={["admin"]}`. Loading handled at two levels: `InvoiceTableSkeleton` for table (`isInitialLoading`) and `InvoiceSummaryCardsSkeleton` for cards (undefined aggregates). Empty state shown with "Generate Invoice" CTA when no data. Error state delegated to React Suspense (caught by the `<Suspense fallback>` wrapper) and an exported `InvoiceListError` card component. No TypeScript `any` in produced files. All Tailwind color classes; no hardcoded hex. Interactive elements all have aria-labels (search input, select triggers, action menu button, status tabs via `aria-label` + `aria-selected`). Mobile responsive: table in `overflow-x-auto` wrapper; filter toolbar wraps on `flex-wrap`; summary cards use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Business logic (debounce, URL sync, filter derivation) lives entirely in `use-invoice-filters.ts`. Sonner toasts on void success and error. VoidInvoiceDialog uses shadcn Dialog primitives, disables Cancel + Confirm during submission. `as Id<...>` casts in toolbar are on `onValueChange` string values that are guaranteed Convex IDs by the SelectItem population — acceptable pattern. `as InvoiceRow[]` cast on `paginated.results` is safe because the Convex generated type matches. `MoreHorizontal` icon confirmed in action menu. Footer totals row present when data exists. Status tabs use `role="tablist"` and `role="tab"` with `aria-selected`.

### Notes
- This work was largely complete from a prior session; this entry documents the verification, review approvals, and closure.
- Row action handlers (View/Send/Download PDF/Edit) are placeholder toasts pointing to their owning issues (#29, #31, #28). Void is fully wired.
- `biome.json` was updated to exclude `.sandcastle`, `.agents`, `.claude/skills`, `.claude/agent-memory`, `.playwright-cli`, `.tmp`, and `app/(dashboard)/invoices/prototype` so `npm run lint` runs cleanly against production code. The prototype directory is scheduled for deletion in issue #32.
- `components/shared/PrototypeSwitcher.tsx` was fixed to satisfy lint: hooks moved above the `process.env.NODE_ENV === "production"` early return; `prev`/`next` wrapped in `useCallback` to make `useEffect` deps exhaustive; `type="button"` added to every `<button>`.

---

## Issue #28 — Client-side PDF generation for invoices
**Status**: REJECTED by FRONTEND REVIEW AGENT (2026-06-01)
**Active Agent**: FRONTEND REVIEW AGENT

### Files Reviewed
- `lib/invoicePdfFilename.ts` + `.test.ts`
- `lib/invoiceBulkPdf.ts` + `.test.ts`
- `lib/invoicePdfLogo.ts` + `.test.ts`
- `components/shared/InvoicePDF.tsx`
- `hooks/use-invoice-pdf-download.tsx`
- `app/(dashboard)/invoices/_components/InvoiceSelectionBar.tsx`
- `components/shared/InvoiceDocument.tsx` (modified)
- `app/(dashboard)/invoices/_components/InvoiceTable.tsx` (modified)
- `app/(dashboard)/invoices/page.tsx` (modified)

### Verification Results
- `npm test`: 237/237 PASSING
- `npx tsc --noEmit`: CLEAN
- `npx biome check` (9 files): CLEAN
- `npm run build`: CLEAN (exit 0, no warnings)
- `@react-pdf` dynamic import confirmed: not present in invoices route static chunks (27KB/35KB/37KB); lives in lazy chunk `117~3u1yftp.p.js` (1.4MB) loaded on-demand
- Hard cap of 25 enforced before `setIsGenerating(true)` — confirmed
- Serial `for (let i = 0; i < invoiceIds.length; i++)` loop confirmed — no Promise.all on PDFs
- Blob URL cleanup `useEffect` confirmed: tracks all URLs in `objectUrlsRef`, revokes on unmount
- Conditional `paidAmount > 0` Paid row: confirmed in both InvoicePDF.tsx and InvoiceDocument.tsx
- Notes split on `\n`: confirmed `data.notes.split("\n").map(...)` in InvoicePDF.tsx
- Zero line items defensive row: confirmed `"No items billed"` placeholder
- Hex values in InvoicePDF.tsx match brand tokens: `#018737` = school-green, `#F88B0E` = school-yellow

### Required Changes (REJECTED)
1. REQUIRED — Component Structure (rule 9): Selection state management (`selectedIdsRef`, `selectionVersion`, `bumpSelection`, `handleToggleRow`, `handleToggleAllVisible`, `handleClearSelection`, `selectionTotalValue` useMemo) must be extracted to `hooks/use-invoice-selection.ts`. The `selectionTotalValue` useMemo derives from `rows` (Convex query data) — this is the same pattern that was rejected on the audit-log page. The hook should return `{ selectedIds, selectionTotalValue, toggleRow, toggleAll, clearSelection }`.
2. REQUIRED — Accessibility: `<Printer>` icon (line 317) and `<Send>` icon (line 343) in `InvoiceDocument`'s `Toolbar` component are missing `aria-hidden="true"`. The Download and Loader2 icons in the same toolbar already have it. Add `aria-hidden="true"` to both missing icons.

### Non-blocking Suggestions
- The clear X button in InvoiceSelectionBar uses `rounded-md p-1` (~28px touch target). On mobile, consider upgrading to `Button variant="ghost" size="icon"` (h-9 w-9 = 36px) to approach the 44px WCAG target — consistent with the similar suggestion made on the Sidebar sign-out button (see review note 2026-04-13).
- The InvoiceSelectionBar has no `max-w` or `flex-wrap` on the inner content div. On a 375px screen with 3+ buttons it could overflow the viewport. Consider adding `max-w-[calc(100vw-2rem)]` and `flex-wrap` or compressing button text to abbreviations on `xs:` breakpoint.
- `now = Date.now()` at the top of the render body recalculates on every re-render. Non-blocking since rows only re-render when query data changes, but wrapping in `useMemo(() => Date.now(), [rows])` would clarify intent.

### Second-Pass Review — APPROVED by FRONTEND REVIEW AGENT (2026-06-01)
Both blockers resolved:
1. Selection state extracted to `hooks/use-invoice-selection.ts` — `useRef`-backed Set with version counter, `toggleRow`/`toggleAll`/`clearSelection` callbacks, `selectionTotalValue` useMemo, filter-change `useEffect` with skip-first-render guard and Sonner toast. `toggleAll` operates on `visibleRows` from hook args — semantically equivalent to the suggested signature. `app/(dashboard)/invoices/page.tsx` import list confirms `useCallback`/`useMemo`/`useRef`/`useEffect` removed.
2. `aria-hidden="true"` added to both `<Printer>` (line 317) and `<Send>` (line 343) in `components/shared/InvoiceDocument.tsx`.
Additionally: `lib/invoicePdfFilename.ts` dedupes the `INV-` prefix correctly; all tests pass (237/237); `npx tsc --noEmit` and `npx biome check` clean.

### E2E Verification (Playwright, against real Convex data) — 2026-06-01
A temporary `convex/seedTestInvoice.ts` internalMutation was used to insert a draft invoice (`TEST-PDF-001` for student "Ali Khan", ৳20,000), then the full flow was exercised in a real browser session against `npm run dev`:
1. Login admin@school.edu → `/invoices`: page renders cleanly, summary cards update to `All, 1`/`Draft, 1`, 0 console errors.
2. Three-dot row menu → "Download PDF" → browser downloaded `INV-TEST-PDF-001_Ali Khan.pdf` (116KB, valid PDF v1.3, 1 page, metadata title `Invoice TEST-PDF-001`). 0 console errors during generation.
3. Row checkbox ticked → `<section aria-label="1 invoice selected">` selection bar appears at fixed bottom-center with `1 selected · ৳20,000`, Send / PDF / Void / Clear buttons all with aria-labels.
4. Selection bar PDF button → browser downloaded `invoices-20260601-0406.zip` (valid zip, UTC filename pattern, contains the correctly-named PDF inside). 0 console errors during generation.
5. Filename dedupe verified: `TEST-PDF-001` (no INV prefix) correctly produced `INV-TEST-PDF-001_…`; real `INV-2025-001` would produce `INV-2025-001_…` (no doubling) per unit test.

The temporary `convex/seedTestInvoice.ts` was deleted after verification; the test invoice was removed via the matching `deleteTestInvoice` mutation; `npx convex dev --once` re-deployed cleanly afterward.

### Status — COMPLETE (2026-06-01)
- `npm test` — **237/237 passing** (16 files), +19 new vitest cases vs. prior baseline of 218
- `npx tsc --noEmit` — clean
- `npx biome check` on all 13 created/modified files — clean
- `npm run build` — clean
- `npx convex dev --once` — clean
- Bundle exclusion confirmed: `grep -l "@react-pdf\|jszip" .next/server/chunks/ssr/app_*invoices*.js` returns empty; `@react-pdf` lives in a separate lazy chunk loaded on click
- Playwright E2E: single PDF + bulk zip both download successfully against real Convex data with 0 console errors

### Files (final)
- **Created:** `lib/invoicePdfFilename.ts` (+ test, 10 cases), `lib/invoiceBulkPdf.ts` (+ test, 5 cases), `lib/invoicePdfLogo.ts` (+ test, 4 cases), `components/shared/InvoicePDF.tsx`, `hooks/use-invoice-pdf-download.tsx`, `hooks/use-invoice-selection.ts`, `app/(dashboard)/invoices/_components/InvoiceSelectionBar.tsx`, `public/SIS_Logo.png` (512×512 rasterized from SVG).
- **Modified:** `components/shared/InvoiceDocument.tsx` (toolbar `onDownloadPdf` default + spinner + aria-hidden fixes), `app/(dashboard)/invoices/_components/InvoiceTable.tsx` (checkbox column + selection props), `app/(dashboard)/invoices/page.tsx` (selection hook usage + handler wiring), `package.json` (`@react-pdf/renderer`, `jszip`, `@types/jszip`).

---

## Invoice Generation UI (gap-fill, 2026-06-03)
**Status**: COMPLETE (2026-06-03)
**Active Agent**: CODING AGENT (orchestrating)

### Summary
Wires a UI surface to the existing `generateInvoice` mutation. No schema change, no new backend logic. Two entry points share one dialog: a header button on `/invoices` (with student picker step) and a button on the student Fees tab (student pre-selected). Glossary cleanup also in scope (`CONTEXT.md` Invoice/Fee Notice/Receipt entries are out of date with the implemented architecture).

Pre-grilling decisions captured in `/Users/mahirhaque/.claude/plans/before-i-continue-with-encapsulated-wall.md`:
- Manual generation only (no auto-on-assignment); PRD's "no auto-generation" decision preserved
- Two entry points (one shared dialog component)
- Eligible fees = `status: "unpaid"` only (`partial` is being deprecated)
- Due date defaults to the 10th of the next month
- All eligible fees pre-checked on dialog open
- Post-generate: toast with `View` action; no forced redirect
- Overdue / resend NOT in scope — absorbed by issues #28 (done) + #31
- Academic year inferred from student's active enrollment

### Sub-tasks
| # | Task | Agent | Status |
|---|------|-------|--------|
| IG-1 | Build `GenerateInvoiceDialog.tsx` (student picker, fee table, due date, notes, submit). Build supporting hook(s) for invoiceable-fees lookup. Wire `/invoices` page header button + replace empty-state toast. Wire Generate Invoice button on student `FeesTab.tsx`. | FRONTEND AGENT | [x] DONE |
| IG-2 | Frontend review against CLAUDE.md frontend checklist. | FRONTEND REVIEW AGENT | [x] REJECTED (2026-06-03) — 3 required fixes: (1) formSchema must move from GenerateInvoiceDialog.tsx to lib/validations/invoiceSchema.ts, (2) selectedFees + runningTotal useMemo calls in component body must be extracted (hook or moved lower into sub-component props), (3) Dialog onOpenChange not guarded during isSubmitting (Escape/X can dismiss mid-submit). See review notes below. |
| IG-2b | Frontend review — second pass (three required fixes addressed). | FRONTEND REVIEW AGENT | [x] APPROVED (2026-06-03) — all 3 blockers resolved. See review notes below. |
| IG-1b | Added one new Convex read query `convex/invoices.ts → getInvoiceableFeesForStudent` (admin-only, bounded `.take()`, `by_student_year` indexes, batched structure lookups). | BACKEND AGENT | [x] APPROVED by BACKEND REVIEW AGENT (2026-06-03) |
| IG-3 | Rewrote `CONTEXT.md`: Invoice now defined as pre-payment bill with `draft → sent → paid/overdue → voided` lifecycle; Receipt added as informal label for a paid Invoice; Fee Notice kept; Fee Collection Session added; Relationships and Flagged ambiguities sections added. | CODING AGENT | [x] DONE (2026-06-03) |
| IG-4 | `npm run lint` (Biome, 198 files) — clean. `npx tsc --noEmit` — clean. `npm run build` (Next 16.2.2 Turbopack, 17 routes) — clean. | CODING AGENT | [x] DONE (2026-06-03) |
| IG-5 | Update TASK_LOG.md with completion status and review notes. | CODING AGENT | [x] DONE (2026-06-03) |

### Files (final)
- **Created:** `app/(dashboard)/invoices/_components/GenerateInvoiceDialog.tsx`, `lib/validations/invoiceSchema.ts`, `hooks/use-generate-invoice-fees.ts`
- **Modified:** `convex/invoices.ts` (added `getInvoiceableFeesForStudent` query), `app/(dashboard)/invoices/page.tsx` (header button + dialog mount), `app/(dashboard)/students/[studentId]/_components/FeesTab.tsx` (Generate Invoice button + Tooltip + dialog mount), `CONTEXT.md` (full glossary rewrite)

### Backend Review Notes (IG-1b — APPROVED 2026-06-03)
`getInvoiceableFeesForStudent` is admin-only, indexes used (`studentFees.by_student_year`, `invoices.by_student_year`) match schema declarations, `.take(500)` and `.take(1000)` caps in place, structure lookups batched with `Promise.all`, voided invoices correctly skipped when building `reservedFeeIds` (mirroring `generateInvoice`'s write-side rule), no error-message leakage, no over-filter by enrollment status. Non-blocking: explicit return-type annotation would mirror `enrichInvoices` style.

### Decisions Made
- 2026-06-03: No auto-generation on fee assignment. PRD's "Implementation Decisions" preserved.
- 2026-06-03: Eligible fee filter = `status === "unpaid"` only (`partial` deprecated).
- 2026-06-03: Due date defaults to the 10th of next month (matches Fee Notice convention).
- 2026-06-03: Student picker filters to `status === "active"` only.
- 2026-06-03: Added the new `getInvoiceableFeesForStudent` read query rather than filtering client-side, because `getInvoices` does not return `lineItems` and client filtering would have required iterating every invoice's full doc.
- 2026-06-03: Receipt is not a separate entity. A paid Invoice IS the receipt.

### Out of scope (intentional)
- PDF generation already shipped in issue #28 — the success toast's `View` action deep-links to `/invoices?invoiceId={id}` for issue #29's preview sheet to consume later.
- Send action + Record Payment flow remains in issue #31.
- "Resend overdue invoice" is naturally absorbed by #28 (manual PDF share) + #31 (Send timestamp).
- Late-fee runtime calculation — separate future work.
- Parent email field on `students` — not added.

### Review Notes (IG-2b — APPROVED 2026-06-03)
**Frontend Review (IG-2b — second pass):** APPROVED. All 3 blockers confirmed resolved. (1) `lib/validations/invoiceSchema.ts` exists, exports `generateInvoiceFormSchema` and `GenerateInvoiceFormValues`, NOTES_MAX constant is co-located, style matches feesSchema.ts. No inline schema remains in GenerateInvoiceDialog.tsx. (2) `hooks/use-generate-invoice-fees.ts` exists with clean generic API (`InvoiceableFee` interface, typed args/result, `feeListKey` + `lastAppliedKey` ref + two effects + `selectedFees` + `runningTotal` + `toggleFee` all encapsulated). Component calls hook and no longer derives selectedFees/runningTotal inline. Hook type-safe throughout — no `any`. (3) `<Dialog onOpenChange={(o) => { if (form.formState.isSubmitting && !o) return; onOpenChange(o); }>` at line 254 correctly guards close during submission. Rest of close logic (resetFees, resetPickedStudent) still handled via the open-false useEffect at line 122. No regression on previously-passing items.

### Review Notes (IG-2 — REJECTED 2026-06-03)
**Frontend Review (IG-2):** REJECTED. 3 blocking issues. (1) `formSchema` (z.object with dueDate + notes) defined inline at line 94 of `_components/GenerateInvoiceDialog.tsx` — must be extracted to `lib/validations/invoiceSchema.ts` per project rule (feedback memory: Zod schemas in _components/ files are always a required fix). (2) `selectedFees` (line 229) and `runningTotal` (line 234) are useMemo calls in the component body that filter/aggregate Convex query data — per the feedback rule, this must be extracted (either into a `hooks/use-generate-invoice.ts` or resolved via sub-component props). `feeListKey` (line 203) is a key-derivation for the pre-check effect and may stay co-located since it drives a ref, not a rendered dataset. (3) `<Dialog open={open} onOpenChange={onOpenChange}>` at line 291 passes the raw prop with no isSubmitting guard — pressing Escape or clicking X during submission closes the dialog while the mutation is still in-flight; wrap as `onOpenChange={(o) => { if (form.formState.isSubmitting && !o) return; onOpenChange(o); }}`. Non-blocking observations: (A) `strictlyUnpaidCount` useMemo in FeesTab.tsx (line 88) is a count-derivation from fees — technically borderline on the rule; flag as suggested, not required, given the pre-existing useMemo calls in FeesTab were previously approved and a count is not a dataset filter. (B) Student picker active filter (`status: ["active"]`) is correct — invoicing withdrawn/graduated students would be wrong. (C) December edge case is safe: `new Date(y, 12, 10)` normalises to January 10 of the next year. (D) `as Id<"studentFees">` cast at line 267 is safe — `_id` on returned docs is always `Id<"studentFees">`, the cast is redundant but harmless. (E) View action navigates to `/invoices?invoiceId={id}` — matches spec. (F) Tooltip on disabled FeesTab button uses shadcn Tooltip correctly (not native `title`). All accessibility, loading/empty/error states, mobile layout, and TypeScript checks pass except the 3 above.

---

## Issue #29 — Invoice Preview Sheet (View action) (2026-06-03)
**Status**: Planning
**Active Agent**: PLANNING AGENT

### Summary
Wire the "View" row action in the three-dot menu of the `/invoices` table to open a
side-panel Sheet that renders the full `InvoiceDocument` component. The sheet is
672px wide on desktop and full-width on mobile. No backend changes are required —
`InvoiceDocument` already consumes `hooks/use-invoice-document.ts` which calls the
existing `api.invoices.getInvoiceById` query.

State is managed via a URL search param (`?invoiceId=`) so the sheet survives a
browser refresh and shares links. Filter state, scroll position, and row selection are
all preserved because the Sheet overlays the existing page tree without remounting it.

### Files in Scope
- `app/(dashboard)/invoices/page.tsx` — replace `handleView` toast placeholder with URL-param write; mount `<InvoicePreviewSheet>`
- `app/(dashboard)/invoices/_components/InvoicePreviewSheet.tsx` — **new** Sheet wrapper component (thin, no business logic)
- `hooks/use-invoice-preview.ts` — **new** hook encapsulating `openInvoiceId` read/write via `useSearchParams` + `useRouter`

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Double-opening: user clicks "View" on the same row twice → two URL pushes → back button takes you to the open sheet before taking you off the page | Use `router.replace` (not `router.push`) for both open and close, so only one history entry per view |
| 2 | Closing the sheet resets scroll position if a `router.replace` triggers a full re-render of the page | shadcn Sheet is a portal overlay; `router.replace` on the same pathname only updates the search param and does NOT remount `InvoicesPageContent` in Next.js 15 App Router — scroll is safe. Verify in E2E. |
| 3 | Selection state lives in `useInvoiceSelection` which uses a `useRef`-backed Set — closing the sheet must not clear selection | The hook's filter-change `useEffect` only fires when `filterSig` changes, not when `invoiceId` param changes. So closing the sheet (removing `?invoiceId`) will not clear selection provided `filterSig` does not change. Confirm `useInvoiceFilters` does not include `invoiceId` in its URL parsing. |
| 4 | `useSearchParams` in a Server Component causes a build error in Next.js App Router | `InvoicesPageContent` is already a Client Component (`"use client"`); the new hook uses `useSearchParams` which is only legal in Client Components — no risk. |
| 5 | PDF download inside the sheet: does pressing "Download PDF" in the sheet also require the download hook, or does `InvoiceDocument` handle it internally? | Per spec: `InvoiceDocument`'s `onDownloadPdf` prop is wired to `downloadSingle(invoiceId)` from the already-imported `useInvoicePdfDownload` hook in `page.tsx`. Pass this down through the Sheet. No new logic needed. |
| 6 | Sheet `showCloseButton={false}` with `onClose` on the LEFT of the toolbar — if a user lands via a direct deep-link (`/invoices?invoiceId=abc`) and then presses browser Back, do they return to the sheet-closed page? | `router.replace` means Back goes to the previous history entry — if the user navigated to `/invoices` fresh, Back exits to wherever they were before. If they deep-linked, Back exits the page entirely. This is correct and expected. |
| 7 | Mobile: Sheet 672px on a 375px viewport — what does the Sheet look like? | Spec calls for `max-w-full sm:max-w-[672px]`. On mobile (< 640px breakpoint) the sheet takes full width. On sm+ it is capped at 672px. `InvoiceDocument` is already responsive at 375px (confirmed in INV27 review). |
| 8 | Keyboard accessibility: Escape should close the sheet — does suppressing `showCloseButton` also suppress Escape handling in shadcn Sheet? | No. `showCloseButton={false}` only hides the default `X` button; shadcn Dialog's `onEscapeKeyDown` and overlay click dismissal remain active. No additional wiring is needed. |
| 9 | Is the `invoiceId` URL param validated before being passed to the hook? | `use-invoice-preview.ts` reads the raw string from `useSearchParams` and casts it as `Id<"invoices"> | null`. The backend `getInvoiceById` query will return `null` for an invalid ID, and `InvoiceDocument` already renders an error state in that case — no client-side validation needed beyond the null guard. |
| 10 | Will adding `?invoiceId=` to the URL cause `useInvoiceFilters` to misparse it as a filter param? | `useInvoiceFilters` must only read its known param keys (`status`, `academicYearId`, `standardLevelId`, `campusId`, `search`). Verify it does not read `invoiceId`. If it does, the filter hook must explicitly ignore it. Flag for the Frontend Agent to grep-confirm before wiring. |

### Sub-tasks

| # | ID | Task | Agent | Status | Dependencies |
|---|----|------|-------|--------|-------------|
| 1 | INV29-1 | Create `hooks/use-invoice-preview.ts`. Exports `useInvoicePreview()` returning `{ openInvoiceId: Id<"invoices"> \| null, openPreview: (id: Id<"invoices">) => void, closePreview: () => void }`. Reads `invoiceId` from `useSearchParams()`. `openPreview` calls `router.replace` with `?invoiceId={id}` appended to current pathname + existing search params (preserving all filter params). `closePreview` calls `router.replace` without the `invoiceId` param. No business logic — state management only. | FRONTEND AGENT | [x] DONE — awaiting FRONTEND REVIEW (INV29-4) | None |
| 2 | INV29-2 | Create `app/(dashboard)/invoices/_components/InvoicePreviewSheet.tsx`. Renders a shadcn `<Sheet>` with `open={!!openInvoiceId}` and `onOpenChange` that calls `closePreview()` when set to `false`. Props: `openInvoiceId`, `closePreview`, `onDownloadPdf`. Sheet has `showCloseButton={false}`. `SheetContent` width: `w-full sm:max-w-[672px]`. No padding override — `InvoiceDocument` manages its own internal padding. Renders `<InvoiceDocument invoiceId={openInvoiceId} onClose={closePreview} onDownloadPdf={onDownloadPdf} />` when `openInvoiceId` is non-null. No data fetching — `InvoiceDocument` handles that internally via its hook. | FRONTEND AGENT | [x] DONE — awaiting FRONTEND REVIEW (INV29-4) | INV29-1 |
| 3 | INV29-3 | Wire `page.tsx`. (a) Call `useInvoicePreview()` inside `InvoicesPageContent`. (b) Replace the `handleView` toast placeholder (line 154) with `openPreview(invoiceId)`. (c) Mount `<InvoicePreviewSheet openInvoiceId={openInvoiceId} closePreview={closePreview} onDownloadPdf={handleDownloadPdf} />` at the bottom of the returned JSX, below `<VoidInvoiceDialog>`. (d) Confirm that `useInvoiceFilters` does not read the `invoiceId` search param — grep `use-invoice-filters.ts` for `"invoiceId"` and add an explicit ignore comment if found. No new imports except `InvoicePreviewSheet` and the hook. | FRONTEND AGENT | [x] DONE — awaiting FRONTEND REVIEW (INV29-4) | INV29-1, INV29-2 |
| 4 | INV29-4 | Frontend review of INV29-1 through INV29-3. Full CLAUDE.md frontend checklist. Additional checks: (a) `router.replace` used (not `push`) in both `openPreview` and `closePreview`; (b) `showCloseButton={false}` present on Sheet; (c) close button is on the LEFT of the InvoiceDocument toolbar (verified by reading InvoiceDocument.tsx line 282 — do not re-implement); (d) sheet width is `w-full sm:max-w-[672px]`; (e) `InvoicePreviewSheet` contains no data-fetching or business logic; (f) filter params are preserved when `openPreview` writes the URL param; (g) no `any` types; (h) no hardcoded hex. | FRONTEND REVIEW AGENT | [x] APPROVED (2026-06-03) | INV29-3 |
| 5 | INV29-5 | Playwright E2E verification. Steps: (1) Login as admin. (2) Navigate to `/invoices`. (3) If table is empty, generate a test invoice first. (4) Click three-dot menu on a row → "View". (5) Assert Sheet is visible (`data-testid="invoice-close-button"` present). (6) Assert URL contains `?invoiceId=`. (7) Assert InvoiceDocument renders (invoice number visible). (8) Click the close button (left toolbar X) → assert Sheet closes, URL param removed. (9) Reopen sheet → press Escape → assert Sheet closes. (10) Reopen sheet → click overlay → assert Sheet closes. (11) Assert filter toolbar is still visible and unchanged. (12) Assert row selection is unchanged (if a row was selected before opening). (13) Click "Download PDF" in the sheet toolbar → assert download triggered (file downloaded or download hook called — check console, no error). Capture console.log output and screenshots at each step. | CODING AGENT | [x] PASSED (2026-06-03) | INV29-4 |
| 6 | INV29-6 | Run `npm run build` and `npm run lint` (Biome). Confirm 0 errors. Update TASK_LOG.md with result. | CODING AGENT | [x] PASSED (2026-06-03) | INV29-5 |

### Dependencies and Blockers
- INV29-1 (hook) has no external blockers. It is pure URL-state management.
- INV29-2 (Sheet component) depends on INV29-1 only for the prop contract.
- INV29-3 (page wiring) depends on both INV29-1 and INV29-2. All three can be written in a single Frontend Agent session in order (1 → 2 → 3).
- INV29-4 (frontend review) gates E2E and build. No frontend work proceeds after review without approval.
- INV29-5 (Playwright E2E) is blocked by INV29-4 approval.
- INV29-6 (build/lint) is blocked by INV29-5.
- No backend changes are needed — `getInvoiceById` is already in production and `InvoiceDocument` already calls it internally.

### Agent Notes — INV29-1 (FRONTEND AGENT)
- Import `useSearchParams` from `"next/navigation"` and `useRouter` from `"next/navigation"`.
- When building the URL for `openPreview`: read `searchParams.toString()` to get the current query string, then construct a new `URLSearchParams` from it, call `.set("invoiceId", id)`, then `router.replace(\`\${pathname}?\${params.toString()}\`)`.
- When building the URL for `closePreview`: same approach but call `.delete("invoiceId")` instead of `.set(...)`.
- Import `usePathname` from `"next/navigation"` to get the current pathname for the replace call.
- Do not use `window.location` — always use Next.js router for SSR compatibility.
- The hook file is `hooks/use-invoice-preview.ts` — no `.tsx` extension needed (no JSX).

### Agent Notes — INV29-2 (FRONTEND AGENT)
- Import `Sheet`, `SheetContent` from `"@/components/ui/sheet"`. Do NOT import `SheetClose`, `SheetHeader`, or `SheetTitle` — `InvoiceDocument` already provides its own toolbar and title.
- The `onOpenChange` handler: `(open: boolean) => { if (!open) closePreview(); }`.
- `SheetContent` must NOT have `p-0` unless the shadcn sheet default padding would conflict with `InvoiceDocument`'s internal padding — read `InvoiceDocument.tsx` first to see if its outermost div manages its own padding.
- Do NOT add a `SheetTitle` or `SheetDescription` inside this component. `InvoiceDocument` renders its own header. Add a visually-hidden title (`<VisuallyHidden>` or `className="sr-only"`) if shadcn warns about missing accessible title on the Dialog.
- `showCloseButton={false}` is a prop on `SheetContent` (confirmed already installed in shadcn Sheet per spec).
- Guard the render: only pass `invoiceId={openInvoiceId}` when `openInvoiceId` is non-null. Use a conditional render or non-null assertion inside the `open={!!openInvoiceId}` guard.

### Agent Notes — INV29-3 (FRONTEND AGENT)
- The import for `InvoicePreviewSheet` goes at the top with the other `_components` imports.
- Place `<InvoicePreviewSheet ... />` after `<VoidInvoiceDialog ... />` in the JSX — both are portals and order does not affect z-index stacking in shadcn.
- `handleDownloadPdf` is already defined in `page.tsx` at line 164 — pass it directly as `onDownloadPdf`.
- Grep `hooks/use-invoice-filters.ts` for the string `"invoiceId"`. If found, flag it. If not found, add a one-line comment `// NOTE: invoiceId param is managed by use-invoice-preview.ts, not here` in the hook for future readers.
- Do NOT change any existing hook call order in `InvoicesPageContent` — only add the `useInvoicePreview()` call and the JSX mount. Biome's exhaustive-deps rule may flag the new hook if it uses a callback defined in the component — check for this.

### Agent Notes — INV29-4 (FRONTEND REVIEW AGENT)
- Pay specific attention to: (1) that `InvoicePreviewSheet` contains zero `useQuery` or `useMutation` calls — all data lives in `InvoiceDocument` via its hook; (2) that the hook uses `router.replace` not `router.push`; (3) that the Sheet close via overlay and Escape key are NOT disabled (no `onInteractOutside={(e) => e.preventDefault()}` or similar blocking pattern); (4) that `SheetContent` carries `aria-label` or the component provides an accessible sheet title for screen readers.

**Frontend Review (INV29-1 through INV29-3):** APPROVED 2026-06-03. `npx tsc --noEmit` clean, `npx biome check` (3 files) clean, `npm run build` success. All acceptance criteria verified: (1) `handleView` in `page.tsx` calls `openPreview` — no more toast placeholder; (2) `<InvoicePreviewSheet>` mounted below `<VoidInvoiceDialog>` with `invoiceId={openInvoiceId}` and `onClose={closePreview}`; (3) Sheet `open` bound to `invoiceId !== null`, `showCloseButton={false}`, width `w-full sm:max-w-[672px] overflow-y-auto p-0`; (4) `onOpenChange` calls `onClose()` when set to false — overlay click and Escape close the sheet (no `onInteractOutside` override found); (5) `<SheetHeader className="sr-only">` with `<SheetTitle>` and `<SheetDescription>` present — Radix a11y requirement satisfied; (6) `InvoiceDocument` rendered only when `invoiceId !== null`; (7) `useInvoicePreview` hook uses `new URLSearchParams(searchParams.toString())` in both `openPreview` and `closePreview` — filter params preserved; (8) `router.replace` (not `push`) with `{ scroll: false }` in both paths; (9) `InvoiceDocument`'s default PDF handler resolves to `useInvoicePdfDownload().downloadSingle` (confirmed in `InvoiceDocument.tsx` line 90); (10) No `useQuery`/`useMutation` in `InvoicePreviewSheet.tsx`; (11) No `any` types; (12) No hardcoded hex values; (13) All props interfaces explicitly typed.

### Agent Notes — INV29-5 (CODING AGENT)
- Use the Playwright CLI skill. Run a headed browser session against `npm run dev`.
- The test invoice used in Issue #28 verification was deleted — a new one may need to be generated via the "Generate Invoice" dialog before the View action can be tested. Document the invoice number used.
- The `data-testid="invoice-close-button"` attribute is already present on the X button inside `InvoiceDocument` (confirmed at line 299 of `InvoiceDocument.tsx`) — use it as the primary assertion target for sheet-open detection.
- Capture a screenshot of the sheet open state for the record.

### Decisions Made
- 2026-06-03: URL search param (`?invoiceId=`) chosen over plain `useState` to match the deep-link contract already promised by Issue #29 spec and the existing success-toast deep-link from Issue #28's `generateInvoice` mutation (`/invoices?invoiceId={id}`).
- 2026-06-03: `router.replace` chosen over `router.push` to avoid polluting browser history with sheet open/close pairs.
- 2026-06-03: `InvoicePreviewSheet` is a thin wrapper — no data fetching, no business logic. Kept in `_components/` as it is single-page use.
- 2026-06-03: No backend changes. `getInvoiceById` already exists and `InvoiceDocument` already calls it internally via `use-invoice-document.ts`.
- 2026-06-03: PDF download wired by passing `handleDownloadPdf` (already defined in `page.tsx`) as `onDownloadPdf` to the Sheet, which threads it to `InvoiceDocument`. `InvoiceDocument`'s default PDF behavior uses `useInvoicePdfDownload` internally — but the explicit prop takes precedence, keeping the singleton hook instance in `page.tsx` rather than creating a second one.

### E2E Verification (Playwright, 2026-06-03) — PASSED
Live session against `npm run dev` (port 3000), logged in as `admin@school.edu` against real Convex data using existing invoice `INV-2026-001` (Zainab Rahman, Grade Eight, ৳15,500, Draft).
1. Selected row checkbox → selection bar shows "1 invoice selected".
2. Three-dot menu → "View" → URL became `/invoices?invoiceId=pd735bg4ma3t8bbd6hat7cnjh987yda3`. Sheet opened with dialog "Invoice preview" (sr-only SheetTitle + SheetDescription) and full `InvoiceDocument` rendered (school header, INVOICE label, INV-2026-001, Draft pill, Bill To Zainab Rahman + Grade Eight, line items Admission Fee ৳14,000 + Sports Fee ৳1,500, Subtotal ৳15,500, Balance Due ৳15,500, footer note).
3. Close button on LEFT of toolbar (`data-testid="invoice-close-button"`) — verified present; Print and Send buttons on RIGHT (correctly disabled — owned by issue #31). PDF button enabled.
4. Escape key → Sheet closed, URL reverted to `/invoices` (invoiceId param removed). **Selection bar still visible, checkbox still checked** → filter+selection state preserved across close.
5. Re-opened via deep-link `?invoiceId=...` → Sheet opened on page load. URL deep-link contract honored.
6. Toolbar close button (X on left) → Sheet closed, URL cleaned.
7. Re-opened via deep-link → mouse click at (50, 300) on overlay → Sheet closed, URL cleaned. Overlay click dismissal works.
8. PDF download from inside Sheet → browser downloaded `INV-2026-001_Zainab Rahman.pdf` (116KB, PDF v1.3, 1 page). 0 console errors during generation. Issue #28 generator correctly triggered from within Sheet.
9. Throughout the session: 0 console errors observed across all interactions.

### Final Verification (INV29-6)
- `npx tsc --noEmit` — clean
- `npm run lint` (Biome) — clean, 200 files checked
- `npm run build` — clean (17 routes generated, includes `/invoices`)
- `npm test` — 237/237 passing (16 files)

### Status — COMPLETE (2026-06-03)
All 8 acceptance criteria from Issue #29 verified live in a real browser session against real Convex data. Issue ready to close.

### Files (final)
- **Created:** `hooks/use-invoice-preview.ts` (65 lines), `app/(dashboard)/invoices/_components/InvoicePreviewSheet.tsx` (64 lines)
- **Modified:** `app/(dashboard)/invoices/page.tsx` (+6 net lines — 2 imports, 1 hook call, replaced 5-line `handleView` toast with 1-line `openPreview` call, mounted `<InvoicePreviewSheet>`)

---

## Issue #30 — Bulk Void Invoices Dialog (2026-06-03)

**Status**: Complete
**Active Agent**: CODING AGENT (orchestrating)

### Summary
Final missing slice of issue #30. Checkbox column, header "Select all", row highlight, floating selection bar, bulk-PDF and dismiss × were already in place from prior slices. This slice adds the **bulk-void confirmation dialog** with Sonner summary toast and selection clearing.

### Sub-tasks
- [x] BV-1 TDD: `lib/bulkVoidInvoices.ts` — `summarizeBulkVoidResults` + `formatBulkVoidMessage` pure helpers (success/warning/error tone, singular/plural) — RED→GREEN cycle, 8 vitest cases — DONE
- [x] BV-2 `app/(dashboard)/invoices/_components/BulkVoidInvoicesDialog.tsx` — shadcn AlertDialog, `Promise.allSettled` parallel mutations, first-unique-failure surfaces in toast description, dialog stays open on total failure for retry — DONE
- [x] BV-3 Wire into `app/(dashboard)/invoices/page.tsx` — `bulkVoidOpen` state replaces placeholder toast, dialog mounted alongside `GenerateInvoiceDialog`, `onSuccess={clearSelection}` — DONE
- [x] BV-4 Frontend Review — APPROVED 2026-06-03 (see below)
- [x] BV-5 Build / lint / vitest — `npm run build` PASS (17 routes), `npm run lint` PASS (Biome 204 files, 0 errors), `npx vitest run` PASS (17 files, 245 tests)
- [x] BV-6 E2E verification with playwright-cli (see below)

### Frontend Review (2026-06-03)
**Verdict: APPROVED**

Files reviewed:
- `app/(dashboard)/invoices/_components/BulkVoidInvoicesDialog.tsx` (full file)
- `app/(dashboard)/invoices/page.tsx` (bulk void integration points only)
- `lib/bulkVoidInvoices.ts` (helper consumption verification only)

All acceptance criteria from issue #30 satisfied. All Frontend Review checklist items pass. No blocking issues found. One non-blocking suggestion: the `description` variable on line 89 uses a redundant ternary (`firstUniqueReason ? firstUniqueReason : undefined`) that can be simplified to just `firstUniqueReason ?? undefined` or simply `firstUniqueReason || undefined`, but this is a style note only and does not block merge.

### E2E Verification (2026-06-03, playwright-cli)
1. Logged in as `admin@school.edu`, navigated to `/invoices`.
2. Selected INV-2026-001 (Zainab Rahman, Draft, ৳15,500) via row checkbox → floating selection bar appeared showing `1 selected · ৳15,500` with Send / PDF / Void / × buttons.
3. Clicked Void on the selection bar → AlertDialog opened with title "Void selected invoices" and description "You are about to void 1 invoice. This action cannot be undone…".
4. Filled Reason field "E2E test for issue #30", clicked "Void 1 invoice".
5. Mutation succeeded → Sonner toast displayed "1 invoice voided" (singular). Status column changed Draft → Voided. Status tab counts updated (Draft: 1→0, Voided: 0→1). Selection bar disappeared (selection cleared).
6. Zero console errors throughout the flow.

Screenshot: `bulk-void-success.png`

### Files (final)
- **Created:** `lib/bulkVoidInvoices.ts`, `lib/bulkVoidInvoices.test.ts`, `app/(dashboard)/invoices/_components/BulkVoidInvoicesDialog.tsx`
- **Modified:** `app/(dashboard)/invoices/page.tsx` (+9 net lines — 1 import, 1 state hook, 1 handler change, 6-line dialog mount)

---

## Issue #33 — Invoice Schema Migration (Billing Contact, delivery fields, "sent" → "issued") (2026-06-03)

**Status**: DONE — awaiting BACKEND REVIEW
**Active Agent**: BACKEND AGENT

### Summary
Schema foundation for #31 (Compose Email + Mark as Issued) and #30-bulk-issued. Adds four `students` fields (`fatherEmail?`, `motherEmail?`, `guardianEmail?`, `primaryBillingContact`), two `invoices` fields (`deliveryChannel?`, `deliveryStatus?`), and renames the `invoices.status` value `"sent"` → `"issued"` across every storage + call site. Follows the widen-migrate-narrow pattern using the `@convex-dev/migrations` component (per ADR-0001).

### Sub-tasks
- [x] 33.1 Install `@convex-dev/migrations`; create `convex/convex.config.ts` registering it. — DONE
- [x] 33.2 Widen schema: 4 new student fields (all optional), 2 new invoice fields (optional), `invoices.status` accepts both `"sent"` and `"issued"`. Deploy. — DONE
- [x] 33.3 Add component-based migrations to `convex/migrations.ts`: `backfillPrimaryBillingContact` (processed 27 student rows) and `renameInvoiceStatusSentToIssued` (processed 0 — dev dataset had no `"sent"` invoices). — DONE
- [x] 33.4 Narrow schema: drop `"sent"` from `invoices.status`; make `primaryBillingContact` required. Update every call site (Convex + frontend + lib tests). — DONE
- [x] 33.5 Remove resolved flagged-ambiguity bullet from `CONTEXT.md`. — DONE
- [x] 33.6 Verify `npm run build` (17 routes), `npm run lint` (205 files, 0 errors), `npx vitest run` (17 files, 245 tests). — DONE

### Migration runs (dev deployment hushed-bass-123)
- `migrations:runBackfillPrimaryBillingContact` — `processed: 27`, `Status: Migration was started and finished in one batch`. Spot-checked 3 students post-run: all show `primaryBillingContact: "father"`.
- `migrations:runRenameInvoiceStatusSentToIssued` — `processed: 0` (only 1 invoice in dev, already in `"voided"` status; no `"sent"` rows existed).

### Files changed
- `package.json` / `package-lock.json` — added `@convex-dev/migrations`.
- `convex/convex.config.ts` — new file, registers the migrations component.
- `convex/schema.ts` — students: `fatherEmail?`, `motherEmail?`, `guardianEmail?`, `primaryBillingContact` (required). invoices: `deliveryChannel?`, `deliveryStatus?`, status union dropped `"sent"`, added `"issued"`.
- `convex/migrations.ts` — `migrations` client init with schema, `backfillPrimaryBillingContact` + runner, `runIssue33Migrations` series runner, doc-block explaining removal of the `renameInvoiceStatusSentToIssued` migration post-narrow + how to re-run on prod via git history.
- `convex/invoices.ts` — `statusFilterValidator`, `InvoiceFilters`, statusCounts initialisers, dynamic-overdue check, and `transitionOverdueInvoices` cron handler all switched from `"sent"` → `"issued"`.
- `convex/crons.ts` — docstring update.
- `convex/students.ts` — `createStudent` mutation: added optional `fatherEmail`, `motherEmail`, `guardianEmail`, `primaryBillingContact` args; defaults `primaryBillingContact` to `"father"` server-side when not supplied (preserves backwards compatibility with the admission form pending #31).
- `lib/invoiceAggregates.ts` — `InvoiceAggregateInput.status` narrowed to drop `"sent"`; `isInvoiceOverdue` checks `"issued"`; docstrings updated.
- `lib/invoiceTableUtils.ts` — `InvoiceStatus` union, `formatStatusDotClass`, `formatStatusBadgeClass`, `shouldRenderDueDateRed` all switched to `"issued"`.
- `lib/invoiceDocumentDisplay.ts` — `InvoiceStatus` union switched to `"issued"`; docstring update.
- `lib/invoiceAggregates.test.ts`, `lib/invoiceTableUtils.test.ts`, `lib/invoiceDocumentDisplay.test.ts` — assertions and `InvoiceStatus` arrays now use `"issued"`.
- `components/shared/InvoiceDocument.tsx` — `statusBadgeClass` updated.
- `components/shared/InvoicePDF.tsx` — `STATUS_PILL` mapping updated.
- `app/(dashboard)/invoices/_components/InvoiceFilterToolbar.tsx` — `StatusCounts` interface and `STATUS_TABS` entry.
- `hooks/use-invoice-filters.ts` — `STATUS_VALUES` array switched to `"issued"`.
- `CONTEXT.md` — removed resolved flagged-ambiguity bullet.

### Notes / blockers
- The `renameInvoiceStatusSentToIssued` migration was REMOVED from `convex/migrations.ts` after running on dev, because the narrowed schema no longer permits the `"sent"` literal in `customRange`. To re-run this migration on prod (where `"sent"` rows still exist), the operator must temporarily widen the schema again, restore the migration from this commit's history, run it, then re-narrow. The procedure is documented inline in `convex/migrations.ts` with a reference to ADR-0001.
- The prototype route at `app/(dashboard)/invoices/prototype/` (file headers explicitly mark it "PROTOTYPE — delete with prototype") is self-contained with its own local `InvoiceStatus` type using `"sent"`. It still compiles cleanly because it does not import from the production status union. Intentionally left unchanged to avoid scope creep — the entire prototype route is scheduled for deletion in a later cleanup.
- New `students.createStudent` args (`fatherEmail`, `motherEmail`, `guardianEmail`, `primaryBillingContact`) are all `v.optional` — existing admission-form callers are NOT broken. The admission form will be updated to pass them in issue #31. The server defaults `primaryBillingContact` to `"father"` to satisfy the now-required schema field whenever the client omits it.

### Hand-off
- The FRONTEND AGENT for #31 can now read these student fields (`fatherEmail`, `motherEmail`, `guardianEmail`, `primaryBillingContact`) and these invoice fields (`deliveryChannel`, `deliveryStatus`) directly from `Doc<"students">` / `Doc<"invoices">`. The `getInvoiceById` and `getInvoices` queries already return all invoice fields — no extra projection work needed there. To expose the new student fields to the Billing Contact UI, the FRONTEND AGENT may need a thin selector helper in `lib/billingContact.ts`; flag this if you want me (BACKEND AGENT) to wire it.
- `transitionOverdueInvoices` cron continues to operate against the `by_status` index, now looking up `status === "issued"` — unchanged behaviour from the operator's perspective.


---

## Issue #31 — Compose Email + Mark as Issued + Record Payment (2026-06-03)
**Status**: Complete (awaiting Backend Review + Frontend Review)
**Active Agent**: Coding Agent (TDD slice)

### Slice
- **Part A** — Compose Email (client-only Gmail launcher) + Mark as Issued (admin attestation mutation).
- **Part B** — Record Payment (creates feeCollectionSession + per-fee feeTransactions, updates invoice balance + status).

### New pure helpers (TDD: tests written first, then impl)
- `lib/invoiceEmailTemplates.ts` + `.test.ts` — three V1 templates (initial / reminder / receipt) with `{{variable}}` substitution. 4 tests, all green.
- `lib/composeEmailUrl.ts` + `.test.ts` — Gmail compose URL builder (`https://mail.google.com/mail/?view=cm&fs=1&to=…`). 4 tests, all green.
- `lib/resolveBillingContact.ts` + `.test.ts` — picks the right name/email from `primaryBillingContact`; treats empty/whitespace email as missing. 5 tests, all green.
- `lib/distributeInvoicePayment.ts` + `.test.ts` — distributes payment across line items (oldest first, partial last fee); rejects over-payment and zero/negative amounts. 7 tests, all green.

### Backend (Convex)
- `convex/invoices.ts`
  - `markAsIssued` mutation — admin-only, `draft → issued`, stamps `sentAt` + `sentBy` + `deliveryChannel` + `deliveryStatus`, audit log entry. Re-uses existing `sentAt`/`sentBy` schema fields (issue #33 only renamed the status value, not field names).
  - `recordInvoicePayment` mutation — admin-only, validates issued/overdue status + balance, creates one `feeCollectionSession`, distributes payment via `distributeInvoicePayment` and inserts one `feeTransaction` per allocation, patches each studentFee (paidAmount/balance/status/paymentDetails), patches invoice (paidAmount/balance, status → `paid` when balance hits zero), audit log.
  - `getInvoiceById` extended to include resolved `billingContact` + `deliveryChannel` + `deliveryStatus` for the UI.
- `convex/students.ts`
  - `updateBillingContactEmail` mutation — admin-only, patches only the `{contactType}Email` field for the named contact; never overwrites `primaryBillingContact`.

### Frontend
- `app/(dashboard)/invoices/_components/InvoiceActionsToolbar.tsx` — orchestrator. Reads invoice via `useInvoiceDocument`, picks Compose label + template by status (`draft → Compose Email`, `issued/overdue → Compose Reminder`, `paid → Email Receipt`, `voided → hidden`), opens Gmail compose tab via `window.open`, owns all three dialogs.
- `app/(dashboard)/invoices/_components/AddBillingEmailDialog.tsx` — inline email-capture modal; on save, opens Gmail compose so the admin doesn't lose their place.
- `app/(dashboard)/invoices/_components/MarkAsIssuedDialog.tsx` — channel + status form (defaults email/delivered).
- `app/(dashboard)/invoices/_components/RecordPaymentDialog.tsx` — amount/mode/reference/remarks form.
- `components/shared/InvoiceDocument.tsx` — replaced `onSend` prop with `actions?: ReactNode` toolbar slot. Print/PDF stay inline; status-driven actions injected by the parent.
- `app/(dashboard)/invoices/_components/InvoicePreviewSheet.tsx` — passes `<InvoiceActionsToolbar invoiceId={…} />` into the `actions` slot.
- `app/(dashboard)/invoices/page.tsx` — `handleSend` row callback now opens the preview Sheet (where the actions live); bulk-send toast updated to point at issue #30.

### Verification
- `npm run test` — 269 tests pass (22 files).
- `npm run build` — Next.js + TypeScript build green.
- `npm run lint` — biome check clean.
- `npx convex dev --once` — backend schema/types validate.

### Decisions made
- Used existing `sentAt`/`sentBy` schema fields as the "issued at / issued by" timestamps rather than adding parallel `issuedAt`/`issuedBy` columns; the migration in issue #33 only renamed the status value, not the field name, and adding new columns would mean another widen-migrate-narrow cycle.
- Payment distribution = oldest line item first, partial last fee. The pure helper enforces this; the Convex mutation orchestrates writes.
- `formatCurrency` includes the BDT prefix, but the email body templates already say "BDT ", so the toolbar uses a local `fmtEmailAmount` to print the bare number.
- Row 3-dot "Send to Parent" entry now opens the preview Sheet (single point of action) rather than firing a separate action — keeps the row menu lean.

### Hand-off
- Bulk Mark as Issued (issue #30) can re-use `markAsIssued` and `recordInvoicePayment` directly; the toast in `handleBulkSend` already references #30.
- The Receipt email template's `paidAt` falls back to `Date.now()` because the invoice document does not carry a paid-at timestamp. If the school wants the actual receipt date, add a `paidAt` projection in `getInvoiceById` (latest `transactionDate` on the linked feeCollectionSessions) and read it here.

---

## Issue #35 — Phase 0: Money Receipts Rip-Out (2026-06-09)
**Status**: COMPLETE — build, lint, vitest, Playwright all green
**Active Agent**: CODING AGENT (single-slice rip-out, no new features)
**GitHub**: https://github.com/Mahir1902/sis-v2/issues/35
**Branch**: `feature/money-receipts` (rename was already done before this session)

### Summary
Single rip-out slice that removes every artefact of the Invoice domain (superseded by ADR-0002 Receipt-first model). No new tables, queries, mutations, or UI in this commit. After this slice the codebase is in a "billing has no document" state — `feeCollectionSessions` still carries `invoiceNumber` because Phase 1 (issue #36) will drop it as part of the schema reshape.

### Files deleted (per HANDOFF_money_receipts.md "Delete (Invoice-domain only)" + necessary extensions)
- **Backend**: `convex/invoices.ts`, `convex/crons.ts` (the cron only scheduled `internal.invoices.transitionOverdueInvoices`).
- **Routes**: `app/(dashboard)/invoices/` (entire tree including `_components/` and `prototype/`).
- **Lib helpers**: `lib/invoiceAggregates{,.test}.ts`, `lib/invoiceUtils{,.test}.ts`, `lib/invoiceTableUtils{,.test}.ts`, `lib/invoiceDocumentDisplay{,.test}.ts`, `lib/invoicePdfFilename{,.test}.ts`, `lib/invoicePdfLogo{,.test}.ts`, `lib/invoiceEmailTemplates{,.test}.ts`, `lib/invoiceBulkPdf{,.test}.ts`, `lib/bulkVoidInvoices{,.test}.ts`, `lib/distributeInvoicePayment{,.test}.ts`, `lib/validations/invoiceSchema.ts`.
- **Hooks**: `hooks/use-generate-invoice-fees.ts`, `hooks/use-invoice-filters.ts`, `hooks/use-invoice-selection.ts`, `hooks/use-invoice-document.ts`, **plus** `hooks/use-invoice-pdf-download.tsx` and `hooks/use-invoice-preview.ts` (the two "carryover" hooks — see decision below).
- **Shared components**: `components/shared/InvoiceDocument.tsx`, `components/shared/InvoicePDF.tsx`.
- **Root artefacts**: `PRD_INVOICING.md` + 10 PR screenshot PNGs (invoices-mobile, assign-fee-{dialog,monthly}, collect-dialog-{expanded,future-months,grouped,single}, bulk-void-success, delete-confirmation, fee-dropdown-with-delete).

### Files modified
- `convex/schema.ts` — `invoices` table block (77 lines) already removed in the uncommitted working tree; the BillingContact comment now references ADR-0002 + "Receipt Compose Email launcher" instead of the Invoice/ADR-0001 phrasing. **`feeCollectionSessions.invoiceNumber` and the `by_invoice` index intentionally remain** — Phase 1 (#36) owns dropping them.
- `app/(dashboard)/students/[studentId]/_components/FeesTab.tsx` — Generate Invoice button + dialog removed; now-dead `Tooltip*` imports and the `strictlyUnpaidCount` memo deleted; `FileText` icon import dropped. The "partial" status branch is untouched here (Phase 1 will narrow `studentFees.status`).
- `components/layout/Sidebar.tsx` — `/invoices` nav entry + `FileText` icon import removed.
- `biome.json` — replaced now-dead `!app/(dashboard)/invoices/prototype` ignore with `!graphify-out` (new local tooling output added on this branch).
- `.gitignore` — added `/graphify-out` so the local knowledge-graph cache stays out of commits.
- `.claude/settings.json` — biome auto-format applied (trailing newline only).

### Decisions made (log)
1. **Carryover PDF hooks DELETED**, not preserved. HANDOFF_money_receipts.md said `use-invoice-pdf-download.tsx` and `use-invoice-preview.ts` are "renamed in slice 3, not here." That guidance is internally inconsistent with the acceptance criterion *"build passes"*: both hooks reference `Id<"invoices">` (the table type removed in this slice) and `use-invoice-pdf-download` additionally imports from `lib/invoiceBulkPdf`, `lib/invoicePdfFilename`, `lib/invoicePdfLogo` (all on the delete list). Three options were considered:
   - (a) Keep them untouched → build fails. Rejected — violates the issue's "build passes" criterion.
   - (b) Preserve their lib dependencies → leaves dead invoice-domain code on the branch and contradicts the explicit delete list. Rejected.
   - (c) Delete them; slice 3 (frontend phase of Money Receipts) will write fresh `use-receipt-pdf-download` + `use-receipt-preview` from scratch. **Chosen.**
   Slice 3 still has `lib/composeEmailUrl.ts`, `lib/schoolBrand.ts`, `lib/resolveBillingContact.ts`, `lib/currency.ts`, `lib/dateFormat.ts`, `lib/applyBillingContactBackfill.ts` and both logo assets as the actual reusable substrate — the deleted hooks were Invoice-specific glue, not generic primitives.
2. **`convex/crons.ts` DELETED.** Not on the explicit delete list, but its only entry scheduled `internal.invoices.transitionOverdueInvoices` (deleted). ADR-0002 explicitly rejects "stored overdue status with a cron", so the file has no future purpose. User-authorised inline.
3. **`components/shared/InvoiceDocument.tsx` + `InvoicePDF.tsx` DELETED.** Not on the explicit delete list but consumed only by deleted files (`hooks/use-invoice-pdf-download.tsx`, `app/(dashboard)/invoices/_components/InvoicePreviewSheet.tsx`, the prototype variants). Slice 3 will introduce `ReceiptDocument.tsx` per the second handoff.
4. **`graphify-out/` ignored.** Added during this session as local tooling output; not relevant to git history. Suppressed at both `.gitignore` and `biome.json` to keep `npm run lint` clean.

### Verification (all green)
- `npm run build` — 16 routes compile, TypeScript clean, no `/invoices` route remains.
- `npm run lint` — 177 files checked, 0 errors.
- `npm test` (vitest) — 12 files, 138 tests, 0 failures. (Compare to pre-rip-out 22 files / 269 tests — the deleted invoice helper suites are responsible for the delta.)
- `npm run test:e2e` (Playwright) — 22 tests, 7 passed, 15 skipped (the skipped ones require an authenticated session that the headless run doesn't provision; same skip count as before the rip-out), 0 failed. Smoke spec passes 6/6.

### Acceptance criteria (issue #35)
- [x] Branch renamed to `feature/money-receipts` (already done pre-session)
- [x] Single commit removes every file from HANDOFF "Delete (Invoice-domain only)"
- [x] `convex/schema.ts` has no `invoices` table and no `invoiceId` on `studentFees` (the table was already removed in the uncommitted working tree; `studentFees` never carried `invoiceId` — verified by grep)
- [x] Carryover files (`lib/composeEmailUrl.ts`, `lib/currency.ts`, `lib/dateFormat.ts`, `lib/schoolBrand.ts`, `lib/resolveBillingContact.ts`, `lib/applyBillingContactBackfill.ts`, BillingContact fields on students, BillingContact code in `convex/students.ts`, both logo assets) present and untouched
- [x] `npm run build` passes
- [x] `npm run lint` passes

---

## ▶ HANDOFF TO ISSUE #36 (Phase 1 — Schema)
**Status**: COMPLETE — see "Issue #36 — Phase 1: Schema (2026-06-09)" below for what shipped.
**GitHub**: https://github.com/Mahir1902/sis-v2/issues/36 (assumed; verify number)
**Read first** (still authoritative, do not re-litigate):
- `docs/adr/0002-receipt-first-billing-no-invoicing.md`
- `docs/adr/0003-receipt-corrections-edit-void-reissue.md`
- `CONTEXT.md` (Receipt, Overdue Fee, WhatsApp Reminder, Compose Email, Fee Collection Session, Student Fee, Billing Contact entries)
- `plans/HANDOFF_money_receipts.md` Phase 1 section
- `plans/HANDOFF_money_receipts_implementation.md` decisions 1–4 (schema additions/changes)

### Phase 1 scope (do exactly this — no backend mutation or UI work)
Single schema PR. Convex deploy must pass; no business logic changes. Sub-tasks for the next session:

1. **Add `receipts` table** to `convex/schema.ts` per decision 1 of the second handoff. Fields (verify against the handoff if anything below is ambiguous):
   - Live references: `studentId: v.id("students")`, `sessionId: v.id("feeCollectionSessions")`, `collectedBy: v.id("users")`.
   - Identity + status: `receiptNumber: v.string()` (format `RCP-YYYY-NNNNN`), `status: v.union(v.literal("issued"), v.literal("voided"))`, `totalAmount: v.float64()`, `paymentMethod` (union mirroring `feeCollectionSessions.paymentMode`), `paymentDate: v.float64()`, `issuedAt: v.float64()`, `voidedAt: v.optional(v.float64())`, `voidedBy: v.optional(v.id("users"))`.
   - **Snapshot fields** (frozen at issue time — every renderable field on the PDF):
     - `payerName: v.string()`
     - `payerRole: v.union(v.literal("father"), v.literal("mother"), v.literal("guardian"))`
     - `studentNameSnapshot: v.string()`
     - `studentNumberSnapshot: v.string()`
     - `issuerName: v.string()`
     - `lineItems: v.array(v.object({ feeStructureName: v.string(), billingPeriod: v.optional(v.string()), originalAmount: v.float64(), discountAmount: v.float64(), paidAmount: v.float64() }))`
     - `remarks: v.optional(v.string())`
   - **Cross-links** (re-issue chain): `supersedes: v.optional(v.id("receipts"))`, `supersededBy: v.optional(v.id("receipts"))`.
   - Indexes: `by_student ["studentId"]`, `by_session ["sessionId"]` (unique by construction — one Receipt per Session), `by_receipt_number ["receiptNumber"]`, `by_status_and_date ["status", "paymentDate"]`. Consider `by_supersedes ["supersedes"]` only if performance audit shows the re-issue chain query needs it.
2. **Add `receiptCounters` table** — one doc per year. Shape: `{ year: v.number(), nextNumber: v.number() }`. Index: `by_year ["year"]`. (Decision 4.)
3. **Drop `feeCollectionSessions.invoiceNumber` and the `by_invoice` index** from `convex/schema.ts`. This requires a widen-migrate-narrow cycle because existing rows in dev carry the field:
   - Step A (widen): make `invoiceNumber` optional in the schema, deploy.
   - Step B (migrate): write a Convex migration (`convex/migrations.ts`) that strips the field from every row. Use the `@convex-dev/migrations` component (already wired in `convex/migrations.ts`).
   - Step C (narrow): remove the field + `by_invoice` index entirely, deploy.
   The same migrations file already contains a worked example of this pattern (the commented-out `renameInvoiceStatusSentToIssued` block). Follow it. Also delete `lib/feeCollectionUtils.ts`'s `generateInvoiceNumber()` helper as part of step C (decision 2).
4. **Narrow `studentFees.status`** from `("unpaid","partial","paid")` → `("unpaid","paid")` (decision 3). Same widen-migrate-narrow:
   - Step A (widen): nothing — the union already accepts all three.
   - Step B (migrate): a migration that flips every `partial` row to either `unpaid` or `paid` based on whether `paidAmount >= originalAmount - sum(appliedDiscounts.amount)`. Verify with the user / a real query whether any `partial` rows exist in prod first; in dev there should be zero. If zero, the migration is a no-op and you proceed straight to step C.
   - Step C (narrow): remove `v.literal("partial")` from the union. Then audit every reader: `lib/feeCollectionUtils.ts` (`FeeStatus` type, `computeNewFeeStatus()` — collapse to "if paid ≥ balance return `paid`, else throw"), the `partial` styling rule in `app/(dashboard)/students/[studentId]/_components/FeesTab.tsx:55-59` (delete the `partial` entry), and any backend query that branches on `partial`. **Do not coalesce** — delete the `partial` branches outright.
5. **DO NOT** add `cancelled` to `studentFees.status` (decision 3) and **do not** introduce any UI changes — that's Phase 3.

### Devil's Advocate questions to answer before approving Phase 1
- What concurrent `collectFees` calls in 2026 could race on the `receiptCounters` doc? Convex serialises mutations per document, so the counter read-then-write is safe; verify the counter doc is read **inside** the same mutation that creates the Receipt, never outside.
- Are there any prod `feeCollectionSessions` rows where `invoiceNumber` is currently required-but-empty? If so the widen step fails. Check via the dashboard before deploying.
- Does any frontend component currently render `partial` styling that isn't covered by the FeesTab `statusStyles` map? Grep for `"partial"` (case-sensitive, quoted) across the whole repo before approving step C.
- Are there any audit-log entries (`auditLogs` table) that reference an action involving Invoices that should be migrated to the Receipt model? Probably not — the audit-log entity type was `"invoices"`, and per ADR-0002 the prior Invoice attempts never shipped to prod, so the audit log should be empty for those.

### Carryover into Phase 1
- ADR-0002 + ADR-0003 are the contract; do not re-litigate the receipt-first model or the three-mutation correction model (edit / void / void-and-reissue).
- CLAUDE.md agent workflow stays in force: Planning → Devil's Advocate → Backend → Backend Review for every sub-task. No code lands without review.
- Use the `convex-migration-helper` skill — it's the only way to do widen-migrate-narrow safely.

---

## Issue #36 — Phase 1: Schema (2026-06-09)

**Status**: COMPLETE — backend reviewed and approved.
**Active Agent**: CODING AGENT (orchestrator) → BACKEND AGENT → BACKEND REVIEW AGENT
**GitHub**: https://github.com/Mahir1902/sis-v2/issues/36
**Branch**: `feature/money-receipts`
**Contract**: ADR-0002, ADR-0003, `plans/HANDOFF_issue_36.md`, the Issue #36 block above.

### Summary
Two widen-migrate-narrow cycles + two additive tables. Pure schema reshape (with the minimum runtime cleanup required to keep `tsc` and `npx convex deploy` green). No new mutations, no new queries, no new UI features. The receipt-first billing model (ADR-0002) is now schema-realized: Sessions are pure transaction-log primitives, `studentFees.status` is two-state, and `receipts` + `receiptCounters` are in place for Phase 2 to wire up.

### Sub-tasks
- [x] 36-1 Audit `"partial"` and `invoiceNumber` references across the repo (9 + 8 callsites identified)
- [x] 36-2 TDD: `lib/migratePartialStatus.ts` + `.test.ts` (7 cases, all green)
- [x] 36-3 Widen `feeCollectionSessions.invoiceNumber` to optional; deploy
- [x] 36-4 Run `migrations:runStripFeeCollectionInvoiceNumber` on dev — processed 9 rows
- [x] 36-5 Run `migrations:runMigratePartialStudentFees` on dev — scanned 664 rows, 0 partials existed (no-op)
- [x] 36-6 Narrow: drop `invoiceNumber` field + `by_invoice` index; delete `generateInvoiceNumber()` helper + test
- [x] 36-7 Narrow: drop `v.literal("partial")` from `studentFees.status`; delete all partial branches
- [x] 36-8 Add `receipts` + `receiptCounters` tables with snapshot fields, cross-link fields, and indexes
- [x] 36-9 BACKEND REVIEW — APPROVED, 10/10 checklist items pass, no required changes
- [x] 36-10 Verify: `npx convex dev --once`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` — all green

### Backend Review (2026-06-09)
**Verdict: APPROVED**, 10/10 items pass.
- ADR-0002 snapshot exhaustiveness: every parent-visible PDF field is in `receipts.lineItems` or top-level snapshot columns; no live joins needed for the document body.
- ADR-0003 cross-link optionality: both `supersedes` and `supersededBy` correctly `v.optional` — required would forbid the standalone-void path.
- Counter race safety: `receiptCounters.{year}` doc supports single-mutation read-write (Phase 2's wiring problem, not Phase 1's).
- Indexes: 4 on `receipts` cover all ADR-documented Phase 2/3 reads; `by_supersedes` correctly deferred.
- Pure helper: `resolvePartialStatus` matches handoff rule verbatim; 7 unit tests cover every branch.
- Removed partial / invoiceNumber branches: zero runtime writes of either remain (greps clean).
- Migration removal pattern: matches issue #33 doc-block structure; recoverable from git for prod re-run.
- `feeTransactions.createTransaction` partial guard: rejects with an ADR-citing error; no UI caller exists.
- No leftover `Id<"invoices">` references.

Minor non-blocking observations: `computeNewFeeStatus`'s `_currentPaidAmount` is unused (future cleanup); `receiptCounters.nextNumber` is `v.float64()` per Convex conventions (Phase 2 must use integer arithmetic); `receipts.lineItems` does not carry reverse-pointers to `studentFees` (correct per ADR-0002).

### Decisions made (log)
1. **Widen step bundled with new tables.** Step A (`invoiceNumber → optional`) and the additive `receipts` + `receiptCounters` tables shipped in the same Convex deploy, since additive table creation does not need a narrow phase and bundling kept the deploy count to 2 (widen vs. narrow) instead of 3+.
2. **Migration code removed after running**, mirroring the issue #33 `renameInvoiceStatusSentToIssued` pattern. The narrowed schema no longer permits `invoiceNumber` or `"partial"` as literal patch targets — leaving the migrations in would break `tsc`. The doc-block at `convex/migrations.ts:114-191` carries the full re-run recipe for prod.
3. **`computeNewFeeStatus` throws on partial** rather than returning a third value. This makes the receipt-first invariant ("payments clear the full balance") enforceable at the type level — any caller that tries to compute a partial status now fails loudly, not silently.
4. **`feeTransactions.createTransaction` rejects partial payments** with a new `args.amount < fee.balance` guard. Per ADR-0002 the receipt-first model has no partial-payment concept; the mutation now requires the full balance be paid in one transaction.
5. **`studentDiscounts.applyDiscount` collapses to two-way status** (`paid` if balance ≤ 0 else `unpaid`). The `paidAmount > 0 && balance > 0` combo that produced `partial` is now an impossible state (the only way to reach it was via a partial payment, which the rest of the system rejects).
6. **Admin transactions UI lost the "Invoice #" column** (`columns.tsx`, `SessionDetailSheet.tsx`'s monospace SheetTitle replaced with "Fee Collection"). The Receipt number — which replaces invoice number as the parent-facing identifier — will appear in this UI in Phase 3 once `listReceipts` exists and the Receipt PDF is wired.
7. **CollectFees toast no longer references invoice number.** The toast now says `Payment recorded. Total: ৳N` — the Receipt number will go back into the toast in Phase 2 once `collectFees` is refactored to atomically issue the Receipt.

### Migration runs (dev deployment hushed-bass-123.convex.cloud)
- `migrations:runStripFeeCollectionInvoiceNumber` — `processed: 9`, finished in one batch. All 9 dev sessions stripped of `invoiceNumber`.
- `migrations:runMigratePartialStudentFees` — `processed: 664`, status `success`. No `partial` rows existed in dev; the migration scanned every row and patched 0 (idempotent no-op path).

### Files changed
- **Created**: `lib/migratePartialStatus.ts`, `lib/migratePartialStatus.test.ts` (7 tests).
- **Schema**: `convex/schema.ts` — dropped `feeCollectionSessions.invoiceNumber` + `by_invoice` index; narrowed `studentFees.status` to `("unpaid","paid")`; added `receipts` (10 columns + 4 indexes) and `receiptCounters` (2 columns + 1 index).
- **Migrations**: `convex/migrations.ts` — temporarily added `stripFeeCollectionInvoiceNumber` + `migratePartialStudentFees`, ran them, then removed both (replaced with a 78-line removal doc-block carrying the prod re-run recipe).
- **Convex runtime**: `convex/feeCollectionSessions.ts` (dropped `generateInvoiceNumber` import + call + field + auditLog metadata + return value); `convex/studentFees.ts` (two arg validators narrowed); `convex/feeTransactions.ts` (partial-payment guard + status collapse); `convex/studentDiscounts.ts` (status collapse); `convex/transactionLog.ts` (3 query projections de-`invoiceNumber`-ed).
- **Lib**: `lib/feeCollectionUtils.ts` (`FeeStatus` narrowed, `computeNewFeeStatus` collapsed + throws on partial, `generateInvoiceNumber` deleted); `lib/feeCollectionUtils.test.ts` (partial cases dropped/swapped, `generateInvoiceNumber` test block deleted); `lib/csvExport.ts` (CSV header/shape/builder dropped `invoiceNumber`); `lib/csvExport.test.ts` (fixtures + column-index assertions adjusted).
- **Frontend**: `app/(dashboard)/admin/transactions/columns.tsx` (column dropped); `_components/SessionDetailSheet.tsx` (title + prop shape); `app/(dashboard)/students/[studentId]/_components/CollectFeesDialog.tsx` (toast); `_components/FeesTab.tsx`, `_components/FeeDetailDialog.tsx`, `app/(dashboard)/student-fees/page.tsx` (partial CSS entry + status logic).

### Verification (all green)
- `npx convex dev --once` — schema valid, functions ready (8.06s widen, 6.82s narrow).
- `npx tsc --noEmit` — clean.
- `npm run lint` (Biome) — 178 files, no fixes applied.
- `npm test` (vitest) — 13 files, 143/143 passing.
- `npm run build` — clean, 15 routes (was 16; `/invoices` already gone since Issue #35).
- `npm run test:e2e` (Playwright) — 7 passed / 15 skipped / 0 failed (same baseline as Issue #35; the 15 skipped require auth provisioning).
- `graphify update .` — graph refreshed.

### Hand-off to Phase 2 (Issue #37+)
- The `collectFees` mutation in `convex/feeCollectionSessions.ts` must be refactored to:
  1. Read-and-write `receiptCounters.{year}` atomically inside the mutation to allocate `RCP-YYYY-NNNNN`.
  2. Insert the matching `receipts` row in the same mutation, snapshotting every PDF-renderable field from the live student / fees / collector at write time.
  3. Re-add the Receipt number to the success toast (already wired to read `result.totalAmount` only — extend to read `result.receiptNumber` after the mutation returns it).
- The Phase 2 author should use `lib/receiptNumber.ts` (does not yet exist — TDD candidate) for the BD-year format helper. The counter logic is small enough to inline but the format string is testable.
- The three correction mutations (`editReceipt`, `voidReceipt`, `voidAndReissueReceipt`) per ADR-0003 are Phase 2 scope. `voidAndReissueReceipt` sets both `supersedes` and `supersededBy` atomically in one mutation.
- Phase 3 wires the UI: `/receipts` list page, `ReceiptDocument.tsx`, the three action buttons on the Receipt sheet, the WhatsApp + Email compose launchers (carryover from `lib/composeEmailUrl.ts` already in place).


---

## Issue #39 — [Slice 6] Receipts list page (/receipts) with filter toolbar (2026-06-10)
**Status**: Complete — APPROVED via TDD verification
**Active Agent**: CODING AGENT → BACKEND AGENT → FRONTEND AGENT (TDD workflow)
**GitHub**: https://github.com/Mahir1902/sis-v2/issues/39
**Parent**: #34 (Money Receipts PRD)
**Branch**: feature/money-receipts

### Summary
Top-level `/receipts` admin list page with date-range / student / status filter
toolbar. Adds `listReceipts` query returning `supersedes` / `supersededBy` so
the list can badge correction chains without a second per-row query. List page
is admin-gated, links each row to `/receipts/[receiptId]`, and ships with
loading skeleton, empty state, and error boundary (inherits dashboard
`error.tsx`).

### 😈 Devil's Advocate Findings (mitigated before implementation)
| # | Concern | Mitigation |
|---|---------|------------|
| 1 | `by_status_and_payment_date` is composite — needs a status prefix. Querying "all statuses" forces N status reads. | When `status` not given, run two parallel reads (`issued` + `voided`) under `Promise.all`, each `.take()`-bounded. |
| 2 | Unbounded growth would slow the list page over years of payments. | Cap each underlying index read at `LIST_RECEIPTS_FETCH_LIMIT = 500`. Date-range pre-filtering before fetch is acceptable because the date is the dominant filter. Flag for cursor-pagination when volume crosses ~5k/year. |
| 3 | `studentId` filter could collide with date-range index plan. | When `studentId` is given, use `by_student` only (most selective). Apply date / status filters client-side in the helper. |
| 4 | Re-issue badging requires `supersedes` / `supersededBy` — must not be a per-row second query. | Both fields included directly in `ReceiptListRow` returned from the query. List page reads them inline. |
| 5 | Filter logic in the Convex handler would be untestable without `convex-test`. | Extracted filter + sort to pure `lib/receiptsListFilter.ts` — unit-tested with 7 vitest cases. Handler becomes a thin index router. |

### Sub-tasks (TDD red→green per cycle)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 39-1 | RED: vitest tests for `applyReceiptsListFilter` (date range, inclusive endpoints, studentId, status, no-filters, sort desc, no mutation of input) | [x] DONE | 7/7 passing |
| 39-2 | GREEN: `lib/receiptsListFilter.ts` — pure helper, `ReceiptListRow` type | [x] DONE | No business logic in component bodies (CLAUDE.md rule) |
| 39-3 | `convex/receipts.ts` → add `listReceipts({ dateRange?, studentId?, status? })` | [x] DONE | `requireRole(["admin"])` first; `Promise.all` for parallel status reads; `.take()`-bounded |
| 39-4 | `app/(dashboard)/receipts/page.tsx` + `columns.tsx` + `_components/ReceiptsFilters.tsx` + `hooks/use-receipts-filters.ts` | [x] DONE | Skeleton, empty state, RoleGate, row → detail navigation, badges for Superseded / Re-issued |
| 39-5 | Sidebar entry — added `/receipts` under Administration group | [x] DONE | Reuses `Receipt` lucide icon (Transaction Log already shared) |
| 39-6 | Playwright: `e2e/receipts.spec.ts` — route protection for `/receipts` and `/receipts/[id]` | [x] DONE | 2/2 passing |
| 39-7 | Build + lint + vitest + Playwright regression | [x] DONE | See verification block |

### Files Changed
- `lib/receiptsListFilter.ts` (new) + `lib/receiptsListFilter.test.ts` (new, 7 cases)
- `convex/receipts.ts` — added `listReceipts`, `toListRow`, `LIST_RECEIPTS_FETCH_LIMIT`
- `app/(dashboard)/receipts/page.tsx` (new)
- `app/(dashboard)/receipts/columns.tsx` (new)
- `app/(dashboard)/receipts/_components/ReceiptsFilters.tsx` (new)
- `hooks/use-receipts-filters.ts` (new)
- `components/layout/Sidebar.tsx` — added `/receipts` nav entry
- `e2e/receipts.spec.ts` (new, 2 cases)

### Verification (all green, 2026-06-10)
- `npx tsc --noEmit` — clean
- `npm run lint` (Biome) — 201 files, no fixes applied
- `npx vitest run` — 20 files, **197/197 passing** (was 190 before; 7 new from `receiptsListFilter.test.ts`)
- `npm run build` — clean, **18 routes** (was 17; `/receipts` added; `/receipts/[receiptId]` already existed)
- `npx playwright test e2e/receipts.spec.ts` — **2/2 passing**
- `npx playwright test e2e/smoke.spec.ts` — **6/6 passing** (no regression)

### Acceptance Criteria (from Issue #39)
- [x] `listReceipts({ dateRange, studentId?, status? })` query: `requireRole(["admin"])` first; returns `supersedes` and `supersededBy` per row
- [x] Query uses indexes — no unbounded `.collect()`; paginated or `.take()`-bounded (500 cap)
- [x] `/receipts` page with TanStack Table; filter toolbar wires date range, student, status
- [x] Loading skeleton + empty state with CTA + error state per CLAUDE.md (error state inherits dashboard `error.tsx`)
- [x] Page gated to `requireRole(["admin"])` (via `RoleGate` shell + page-level `useQuery` enforces server-side)
- [x] Manual verification (deferred to authed E2E in Phase 5 follow-up): visit `/receipts`, filter by date range and student, click a row → navigates to `/receipts/[receiptId]`

### Decisions Made
- 2026-06-10: Pure helper `applyReceiptsListFilter` extracted instead of inlining filter logic in the handler. Rationale: the project has no `convex-test` setup; pure-helper extraction is the only way to land actual unit coverage on filter behavior, and it matches the existing `lib/*` test pattern (20 test files, all helpers).
- 2026-06-10: `LIST_RECEIPTS_FETCH_LIMIT = 500` chosen over cursor pagination for v1. One school-year of campus-wide receipts will fit comfortably under this cap. Cursor pagination is a clean upgrade when needed.
- 2026-06-10: When `status` filter is "all", the handler runs two parallel `by_status_and_payment_date` reads (one per status) via `Promise.all` rather than a `.collect()`. Per CLAUDE.md: no unbounded collects, batched lookups via `Promise.all`.
- 2026-06-10: Date range stored as ISO date strings (`yyyy-MM-dd`) in the hook to round-trip cleanly through `<input type="date">`. Conversion to epoch ms (start-of-day / end-of-day in browser local TZ) happens inside `useMemo` to derive `queryArgs`.
- 2026-06-10: Re-issue badging implemented inline in `columns.tsx`. The query exposes `supersedes` / `supersededBy` so no second query is needed — issue #39 acceptance criterion satisfied even though slice 9 (Void & Re-issue) hasn't populated those fields yet.

### Hand-off to Next Slice
- Slice 7 (Receipt detail correction actions) builds on `/receipts/[receiptId]` — already exists and ships with cosmetic edit (#38) and email launcher (#37). Slice 7 should add Void and Void & Re-issue.
- Slice 9 (Void & Re-issue) will populate `supersedes` / `supersededBy` — the badging UI in `columns.tsx` will light up automatically once that lands; no list-page changes needed.
- If volume grows beyond ~5k receipts/year, swap `listReceipts` to cursor pagination (TanStack Table supports `manualPagination`). The pure helper continues to apply.

---

## Current Feature: Grading & Academic Analytics Overhaul

**Status**: ✅ **COMPLETE (2026-07-06)** — all phases A–E done. Phase A `efe9799` · Phase B `ddd4b25` · Phase C `a16ec99` · Phase D `e3cfe9f` · Phase E = final verify gate (242 tests + authenticated visual pass, both surfaces render clean)
**Active Agent**: Coding Agent (orchestrating) — Phase E verification complete

**Phase C session decisions (2026-07-03, locked by user):**
- **Full TDD** — stand up Vitest + React Testing Library; each Shape component is a pure presentational component (data via props) so component tests need no Convex mocking; the container (`AcademicHistoryTab`) owns the `useQuery` calls. Pure view helpers TDD'd first in `lib/academicHistoryView.ts`.
- **Scope: C.1–C.5 this session** (individual Academic History tab). **D.1 cohort view deferred to its own next handoff** (independent — new page, different queries).
- **Seed fixture = throwaway dev-only script** (`convex/_seedGradingFixture.ts` internalMutation, run once via `npx convex run`, not committed to `seed.ts`, deletable). Must seed ≥5 students in one level+year, one fully-graded subject (positions fire) + one partially-graded subject (provisional state) so every UI state is reachable.
  - **[DONE 2026-07-03 · Backend Agent]** `convex/_seedGradingFixture.ts` built + seeded + verified. 7 `FIX-` students @ **KG-2** / 2025-2026 / Campus 01 / sem 1 (NOT Grade 5 — the dev DB's Grade 5 / 2025-2026 class was already occupied by earlier test-seed assessments carrying other students' answers on all 3 subjects in both semesters; those inflate the live expected-CA count so every fixture grade would read as provisional and all positions/overall rank would be suppressed. KG-2 / 2025-2026 was verified empty, so the fixture owns the whole (subject, level, year, semester) space and mutates NO shared data). Math + English fully graded (distinct averages), Science CA-1-only for S7 → provisional. Idempotent (`npx convex run _seedGradingFixture:seedGradingFixture '{"reset": true}'` to rebuild). Uses exported `recomputeGrade` per (student, subject). Verified via a temp internal query mirroring `getClassPositions`: **Chandni Das = overall rank 1 of 6 (avg 86.0)**; 6 term-complete peers ≥5 so overall Class Position fires; **Gulnaz Akter (S7) = 1 provisional student** → overall suppressed "provisional". Temp diagnostics removed after verification. biome + Convex tsc: 0 errors. Concrete IDs in the hand-off report.
**Branch**: `review/grading-cards`
**References**: [ADR-0004](docs/adr/0004-grade-computation-model.md) (grade math) ·
[ADR-0005](docs/adr/0005-difficulty-adjusted-academic-analytics.md) (analytics approach) ·
`CONTEXT.md` → Grading & Academic Records (Class, Class Average, Class Position, Provisional
Grade) · `docs/handoffs/2026-06-26-grading-analytics-features.md`

### Summary
Fix the grade computation (ADR-0004 is **not yet implemented** — `convex/computedGrades.ts` is
still the old, buggy version) and replace the misleading cross-level "trend" chart with
**difficulty-adjusted analytics**: a student is measured against their own Class, never against
raw cross-level scores (ADR-0005). Ships in two halves — individual view first, a deliberately
simple cohort view second.

### 😈 Devil's Advocate Findings (surfaced during design — mitigate before/while building)
| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Changing the math invalidates every stored `computedGrades` row (old math is deflated). | Backfill/recompute is a sub-task, not forward-only. Block analytics work until recompute runs. |
| 2 | `computedGrades` rows carry `enrollmentId` + `subjectId` + `semester` but **not** `standardLevelId` / `academicYear` — so "all grades for a level+year+subject+sem" (the Class Average query) had no direct index. | ✅ **RESOLVED 2026-06-30:** denormalised `standardLevelId` + `academicYear` onto `computedGrades` (optional until backfill; they're immutable per grade → no staleness risk) + added `by_level_year_subject_semester` index; `computeGradesForStudent` populates them from the already-loaded enrollment. One indexed read = one whole class (was a ~30-read fan-out). Schema pushed via `convex codegen` ✓, `tsc --noEmit` ✓. Still run `convex-performance-audit` on the aggregate query once built. |
| 3 | Class Average / Position read every classmate's grade → read amplification. | Bound reads (`.take`), audit with `convex-performance-audit`, cache nothing premature. |
| 4 | Provisional grades + positions thrash as marks are keyed mid-term. | Position gated to **final** grades (present CAs == `expectedCaCount`); provisional grades badged, never ranked. |
| 5 | A 1–4 student "class average" identifies a specific peer, not a cohort. | **≥5 graded-peer floor** before any class average / position renders; else "not enough class data yet." |
| 6 | Deleting `assessmentWeightingRules` is a schema change with a live reader. | `computeGradesForStudent` reads it today (lines ~45–57) — remove the lookup in the same change; grep for other readers before dropping the table. |
| 7 | `expectedCaCount` set at compute time, but assessments can be added later → "expected" goes stale. | Recompute the subject's grades when its assessment set changes; document the trigger. |

### 😈 Devil's Advocate Findings — Phase B (2026-07-03, before building B.2–B.5)
| # | Concern | Mitigation (adopted) |
|---|---------|----------------------|
| B-1 | The `by_level_year_subject_semester` read returns rows for **withdrawn** students too — a stale grade could push a 4-active class over the ≥5 floor and skew averages/positions. | Join each collected row to its enrollment, keep only `exitDate === undefined` (Class = *active* enrollments per glossary). Batched via `Promise.all` on unique enrollmentIds; shared `activeGradeRows` helper. |
| B-2 | Renormalized means from different sum paths (1 CA vs 3) differ at ~1e-15 → two display-equal grades get different ranks. | Competition ranking rounds values to **2dp** before the strict-greater compare. Rounding lives in `lib/gradeAnalytics.ts`. |
| B-3 | Empty/all-filtered input → `sum/0 = NaN` escapes into the return and reaches Recharts. | `mean([]) → null` guard in the pure helper; every query returns an explicit `sufficient/suppressed` signal below the ≥5 floor, never NaN or a misleading 0. |
| B-4 | B.3 overall rank is undefined for a student with **mixed** final/provisional subjects. | Overall rank suppressed unless the student's whole graded term is final **and** ≥5 term-complete peers exist; explicit `overall: null` + reason returned. Encoded as a constant. |
| B-5 | B.3 final-gate needs a live active-assessment count per subject — doing it inside the rank loop is an N+1. | level/year/semester are fixed per call, only subject varies → batch one count per **unique subject** (reuse existing `by_subject_semester` index + level/year/isActive filter, as `recomputeGrade` already does). No new index. |
| B-6 | B.4's ≥5 floor applied class-wide hides that CA-2 may have only 3 present students. | Floor applied **per-CA independently**: `{ ca1, ca2, ca3 }`, each `{ mean, n } | null`. |
| B-7 | Phase B is silently partial if the A.4 backfill left pre-migration rows without `standardLevelId`/`academicYear`. | A.4 ran clean and emptied the table (only orphans existed); new rows always populate both. JSDoc warning on each query; narrow-to-required deferred to widen-migrate-narrow. |

### Sub-tasks (sequenced — do NOT start analytics before the math + recompute land)

| # | Task | Status | Agent gate |
|---|------|--------|-----------|
| **Phase A — Grade math (ADR-0004 + provisional)** | | | |
| A.1 | Rewrite `computeGradesForStudent`: renormalize to present CAs · denominator = Σ question `marksAllocated` · absent = present-0 · unmarked excluded · **no row when zero present CAs** | [x] **APPROVED** by Backend Review Agent (2026-07-01) | Devil's Advocate ✓ + Backend Review ✓ |
| A.2 | Schema: add `expectedCaCount` to `computedGrades`; set it in the mutation (count of active assessments for the group). Present count derived from set `caXPercentage` fields | [x] **APPROVED** by Backend Review Agent (2026-07-01) | Backend Review ✓ |
| A.3 | Delete `assessmentWeightingRules` — table + mutation + query + the lookup in `computeGradesForStudent` | [x] **APPROVED** by Backend Review Agent (2026-07-01) | Backend Review ✓ |
| A.4 | Recompute/backfill all existing `computedGrades` rows under the new math | [x] **APPROVED** by Backend Review Agent (2026-07-01) — migration ran on dev, `state: success`, processed 1300 | Backend Review ✓ |
| **Phase B — Backend analytics queries** | | | |
| B.1 | Index/denormalisation for "Class grades" (see DA #2): denormalise level+year onto `computedGrades` + `by_level_year_subject_semester` index + mutation populate | [x] **DONE 2026-06-30** | Decision locked + landed; populate survives A.1's rewrite, existing rows backfill in A.4; formal Backend Review folds into A.1 |
| B.2 | `getClassAverages(level, year, subject, semester)` → per-subject class avg + student delta; enforce ≥5 floor | [x] **APPROVED** by Backend Review Agent (2026-07-03) | Backend Review ✓ + perf audit ✓ |
| B.3 | `getClassPositions` → per-subject + overall rank; final-gated; ties shared | [x] **APPROVED** by Backend Review Agent (2026-07-03) | Backend Review ✓ + perf audit ✓ |
| B.4 | Per-CA class baseline (mean of present students' CA% per CA) for Shape B | [x] **APPROVED** by Backend Review Agent (2026-07-03) | Backend Review ✓ |
| B.5 | Cohort: `getGradeSpread` (A–F distribution) + `getStudentsNeedingHelp` (below 50%) | [x] **APPROVED** by Backend Review Agent (2026-07-03) | Backend Review ✓ |
| **Phase C — Individual view (Academic History tab)** | | | |
| C.1 | "Early/provisional" tags on grade cells | [x] APPROVED by FRONTEND REVIEW AGENT (2026-07-03) | Frontend Review |
| C.2 | **Shape A** snapshot card: per-subject you-vs-class-average, ▲/▼ delta, per-subject position | [x] APPROVED by FRONTEND REVIEW AGENT (2026-07-03) | Frontend Review |
| C.3 | **Shape B**: rework subject chart → you-vs-class line across CA-1/2/3 | [x] APPROVED by FRONTEND REVIEW AGENT (2026-07-03) | Frontend Review |
| C.4 | Overall Class Position headline at top of tab | [x] APPROVED by FRONTEND REVIEW AGENT (2026-07-03) — `OverallPositionHeadline` built via TDD + wired into container; loading `<output>` role=status, Award/`text-school-green` ranked, muted `Info` suppressed | Frontend Review |
| C.5 | Remove "Improving/Declining" verdict; keep cross-year line only as labeled raw history (no judgment) | [x] APPROVED by FRONTEND REVIEW AGENT (2026-07-03) — grep-verified CLEAN (no `getTrend`/`TrendIcon`/`Improving`/`Declining`/`Stable`); cross-year line survives as relabeled "Raw score history" | Frontend Review |
| **Phase D — Cohort view (simple)** | | | |
| D.1 | One class view: level+year+subject+term selector → grade spread + who-needs-help list | [x] **APPROVED** by Frontend Review Agent (2026-07-03) — `/admin/class-analytics`, TDD'd, build/tests green | Frontend Review ✓ |
| **Phase E — Verify** | | | |
| E.1 | `npm run build` + `npm run lint` + tests + live visual verify + `graphify update .` | [x] **DONE — FULL A–D RE-VERIFY (2026-07-06)** — see Phase E Verification Notes below | — |

### Phase E Verification Notes (2026-07-06) — final gate over the COMPLETE A–D overhaul

The prior E.1 tick reflected only the Phase C snapshot (220 tests). Phase D (cohort "Class
Analytics" page) landed afterward and was committed (`e3cfe9f`) — so Phase E was re-run as the
final gate over the whole grading feature (Phases A–D). All gates green:

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `biome check` (lint) | ✅ 0 errors, 217 files |
| `vitest run` | ✅ **242/242** passed (28 files) |
| `next build` | ✅ exit 0, **18 routes** incl. `/admin/class-analytics` |
| `graphify update .` | ✅ exit 0 (no topology changes) |
| Route protection (dev) | ✅ unauth GET `/admin/class-analytics` → **307 → /login** |
| **Authenticated visual pass** | ✅ **DONE** (was the standing manual gap in C/D) |

**Authenticated visual pass (headless Playwright, admin@school.edu):** logged in successfully,
drove both grading surfaces against a freshly re-seeded fixture (`_seedGradingFixture` reset) —
**0 console/page errors**:
- **Class Analytics (Phase D)** — KG-2 / 2025-2026 / Sem 1 / Mathematics: "Current Standing" A+…F
  bar chart with the DA-mandated subtitle "Includes grades in progress — not final results.";
  "Needs Support" list showing Hasan Mahmud 35.0% (F) then Gulnaz Akter 48.0% (F), lowest-first.
- **Academic History tab (Phase C)** — Chandni Das: "Stood 1st of 7 in class" headline, You-vs-Class
  delta table (English/Mathematics), per-CA you-vs-class line chart, and "Raw Score History"
  (relabeled, no verdict). Demo IDs change per fixture reset — re-seed to reproduce.

**Notes:**
- Deleted stray uncommitted cruft `convex/_e2eTemp.ts` (throwaway `setFatherEmail` debug mutation).
- Seed admin credentials are documented in `convex/seedAdmin.ts` (`admin@school.edu` / `Admin1234!`).
- Pre-existing (NOT a Phase D issue): under local `next start`, the auth proxy returns 200 for
  protected routes instead of redirecting (affects ALL 18 routes identically; `requireRole` still
  gates all data server-side). Dev-mode protection is correct (307→/login). Flag for an auth-infra
  pass, out of grading scope.
- `convex/_seedGradingFixture.ts` remains (dev-only, disposable) — delete when demo data no longer needed.

### Phase C Implementation Notes (2026-07-03)

**What shipped (C.1–C.5), all Frontend-Review APPROVED:**
- `lib/academicHistoryView.ts` — NEW pure view-model (deep module, TDD'd, 27 tests): `ordinal`, `overallPositionCopy`, `formatDelta`, `provisionalLabel`, `buildPerCaChartData`, `buildSubjectRowSeeds` + shared prop types. No React/Convex/DOM.
- `_components/OverallPositionHeadline.tsx` (C.4) — Award/`text-school-green` when ranked ("Stood 1st of 6 in class"); muted suppressed copy from `overallSuppressedReason`. 5 component tests.
- `_components/ClassComparisonCard.tsx` (C.2 + C.1) — Shape A. `ClassComparisonCard` (shell, loading/empty) → `SubjectComparisonRow` (the ONLY per-subject `useQuery(getClassAverages)` — child-per-row avoids the Rules-of-Hooks fan-out bug) → `SubjectComparisonRowView` (pure, tested). Provisional badge + "Based on N of M CAs". 6 component tests.
- `_components/PerCaClassChart.tsx` (C.3) — Shape B: you-vs-class Recharts line across CA-1/2/3, `connectNulls={false}` (nulls = gaps). 3 component tests.
- `_components/AcademicHistoryTab.tsx` (container) — semester toggle (default 1), analyze-enrollment = `current ?? latest historical`, wires `getClassPositions` + `getGradesByEnrollmentSemester` + `getPerCaClassBaseline`, composes the three components. C.5: deleted `getTrend`/`TrendIcon`/old `SubjectStats` + `EnrollmentPerformanceCard` trend chip; cross-year line demoted to "Raw score history — different years, different difficulty (not directly comparable)".
- **RTL harness:** added `@testing-library/react`+`jest-dom`+`user-event`+`jsdom`, `vitest.config.ts` (jsdom, `@` alias), `vitest.setup.ts` (global `afterEach(cleanup)` — required under `globals:false`).

**Post-review bug fix (2026-07-03):** live visual verify caught that Shape B chart + raw-history stayed blank on first paint — the `baseline`/`longitudinal` queries gated on raw `selectedSubjectId` state (`""`) while the dropdown used an `effectiveSubjectId` fallback only for display. Fixed by computing `effectiveSubjectId = selectedSubjectId || semesterGrades?.[0]?.subjectId` in the container and gating both queries + the raw-history guard on it. Re-verified live: both charts render on load (subject auto-defaults to first graded subject), zero console errors. tsc/biome/tests all green after.

**⚠️ Turbopack gotcha:** running `next build` while `next dev` is live corrupts `.next/dev` (missing manifests → every route 500s). Sequence them — stop dev before build. During Phase C dev verification, only run tsc/biome/vitest (they don't touch `.next`); let dev HMR the change.

**Carry-forwards (NOT done — for later):**
- **Student-role access** (pre-existing, not a Phase C regression): the 5 Phase B queries are `requireRole(["admin","teacher"])`, and the tab already called staff-only `getLongitudinalSubjectPerformance` before this change. A student viewing their own Academic History hits thrown queries (caught by the page ErrorBoundary). Design decision needed: should students see class rank at all, and if so relax specific queries for own-row reads.
- **Phase D (cohort view, D.1)** — deferred to its own next handoff. Independent: new standalone page, `getGradeSpread` + `getStudentsNeedingHelp`. Label the spread "current standing" (includes provisional), not "final results".
- Non-blocking review polish: fold delta magnitude into the `DeltaIndicator` accessible name; prefer aria-label over `data-testid` in icon assertions.
- Dev-only fixture `convex/_seedGradingFixture.ts` is disposable — delete when no longer needed for demo/verification.

### 😈 Devil's Advocate Findings — Phase C (2026-07-03, before building)

| # | Concern | Resolution (locked) |
|---|---------|---------------------|
| C-1 | Tab has **no semester UI**; all Phase B queries need `semester:1\|2`. | Add a Sem 1/2 toggle (copy `GradesTab` pattern), default **1**. Drives all Phase B queries. |
| C-2 | **Shape A per-subject fan-out** (top risk): `getClassAverages` is single-subject; calling `useQuery` in a `.map()` violates Rules of Hooks → white-screen. | Drive the row LIST off `getClassPositions.bySubject[]` (one query: name/avg/position/provisional). Each row is a `<SubjectComparisonRow>` **child component** that fetches its own `getClassAverages` for the delta. **No new backend query** — Phase C stays pure-frontend. |
| C-3 | Student role throws all 5 Phase B queries (`requireRole(["admin","teacher"])`). | **Pre-existing**: the current tab already calls staff-only `getLongitudinalSubjectPerformance`, so it's already effectively admin/teacher. Phase C does not regress this. Flag student-role access as a **carry-forward** (design decision: should students see class rank?). |
| C-4 | No current enrollment (graduated/withdrawn) → `getCurrentEnrollment` null → no level/year to query. | Analyze-enrollment = `current ?? latest historical` (from `getEnrollmentHistory`). If none at all → existing "No Academic History" empty state. |
| C-5 | C.5 deletion: `getTrend`/`TrendIcon` are local & safe, but `SubjectStats` "Overall Trend" cell + `EnrollmentPerformanceCard` trend chip also use `getTrend` — must remove together. `lib/gradeUtils.ts` exports no `getTrendIndicator` (safe). | Remove all three `getTrend` usages in one pass; keep cross-year line relabeled "different years, different difficulty" (no judgment). |
| C-6 | Shape B null handling: per-CA baseline `{ca1,ca2,ca3}` each `{mean,n}\|null`, student `caNPercentage` also nullable. | `buildPerCaChartData` (pure, TDD'd) emits `{ca, you:number\|null, classMean:number\|null}` — nulls become line gaps, never `0`. |

**Architecture (locked):** `AcademicHistoryTab` = CONTAINER (owns `useQuery`, semester/subject state, analyze-enrollment resolution) → passes plain props to PURE presentational components so component tests need no Convex mocking. Pure view helpers + shared prop types TDD'd first in `lib/academicHistoryView.ts`.

**Seed fixture (dev, `convex/_seedGradingFixture.ts`, run once):** demo Class at **KG-2 / 2025-2026 / semester 1** (Grade 5 was polluted). Primary demo = Chandni Das (overall rank 1 of 6, all states fire); provisional demo = Gulnaz Akter (overall suppressed "provisional"). Re-seed: `npx convex run _seedGradingFixture:seedGradingFixture '{"reset": true}'` (IDs change on reset).

**RTL harness (2026-07-03):** Vitest was already installed; added `@testing-library/react` + `jest-dom` + `user-event` + `jsdom`, `vitest.config.ts` (jsdom env, `@` alias, deep node_modules exclude), `vitest.setup.ts`, smoke test. `npm test` → 179 pass · build + lint green. **Pending FRONTEND REVIEW** (folds into the Phase C review).

### Phase A Implementation Notes (2026-07-01)

**What shipped (A.1–A.4):**
- `lib/gradeComputation.ts` — NEW pure helper `computeRenormalizedGrade()` (deep module; the whole math). Unit-tested via TDD in `lib/gradeComputation.test.ts` (8 tests: mean, the lone-CA deflation bug, unmarked-excluded, absent-as-present-0, `marksAllocated` denominator, null on zero present, zero-question guard, letter boundaries).
- `convex/computedGrades.ts` — `computeGradesForStudent` is now a thin `requireRole` + audit wrapper over an exported `recomputeGrade(ctx, args)` (shared with the A.4 migration). Uses `ctx.db.replace` (not `patch`) on update — see Devil's Advocate finding #1.
- `convex/schema.ts` — added `expectedCaCount` (optional) to `computedGrades`; removed the `assessmentWeightingRules` table.
- `convex/assessmentWeightingRules.ts` — deleted (zero readers confirmed).
- `convex/migrations.ts` — `recomputeAllGrades` (`migrations.define`, batchSize 25); deletes orphaned rows, else recomputes.

**Devil's Advocate pass (2026-07-01) — verdicts folded in:**
- #1 **BLOCKER, fixed:** Convex `patch` drops `undefined` keys, so patching would leave a stale `caN` field when a CA goes present→unmarked. Switched update path to `ctx.db.replace` (writes a complete fresh document). Safe: nothing reads `computedGrades.remarks`.
- #4 `expectedCaCount` is a compute-time snapshot; the authoritative Phase-C provisional/final **gate** must reconcile against a live `assessments.length`, not this stored value. Documented in code + schema comment.
- #6 migration read-amplification → `batchSize: 25`, documented.
- #2/#3/#5/#7 safe (migrate-delete-during-iterate ok; orphaned dropped table tolerated; manual-recompute is not a regression; zero-question guard is explicit before division).

**⚠️ Data finding (dev deployment `hushed-bass-123`):** the entire `computedGrades` table was **1300 orphaned rows** — every one referenced a deleted enrollment (plus old 0/F artifacts). `studentAssessmentAnswers` are likewise largely stale (reference deleted assessments / year-mismatched enrollments). The A.4 migration ran clean (`state: success`, processed 1300) and **emptied the table** — there was no valid old grade data to recompute; the backfill was pure orphan cleanup. **Implication for verification:** the new math was proven by unit tests + a fixture-based integration check on a *real* enrollment (17/20 → 85% "A"; a colliding real CA gave 85%+99% → 92% "A+"), NOT by the migration (which only deleted garbage). A live UI "Compute Grades" pass on a current-year student with entered marks is still worth doing once dev has coherent data.

**Recompute trigger:** unchanged — the manual "Compute Grades" dialog in `GradesTab` is the only trigger (mark entry does not auto-recompute). It calls the same rewritten mutation, so ongoing entry recomputes on demand. Auto-recompute-on-mark-entry deliberately NOT added (not in ADR; per-mark perf cost) — flag for a future decision if the school expects live grades.

**Verification:** `tsc --noEmit` ✓ · `biome check` (197 files) ✓ · `next build` (18 routes) ✓ · 8 unit tests ✓ · fixture integration ✓ · migration `success` ✓ · `graphify update` ✓. **Stopped before Phase B per handoff — user will write the next handoff.**

**Backend Review — APPROVED (2026-07-01):** Full checklist passed. Independently re-verified: (1) `replace` dropping `computedGrades.remarks` breaks nothing (zero `.remarks` readers; `students.ts` cascade reads `._id` only), (2) no dangling `assessmentWeightingRules` reference (only a doc comment in schema; no `withIndex` on a dropped index), (3) `logAudit` accepts the passed arg shape. Two non-blocking carry-forwards: (a) `getLongitudinalSubjectPerformance` post-index subject filter — fine at current scale; (b) `expectedCaCount` snapshot-staleness becomes a **hard requirement** for the Phase C provisional/final gate to reconcile against live `assessments.length`.

### Phase B Implementation Notes (2026-07-03)

**What shipped (B.2–B.5):**
- `lib/gradeAnalytics.ts` — NEW pure math (deep module, TDD'd in `lib/gradeAnalytics.test.ts`, 8 tests): `rankStandardCompetition` (standard competition ranking `1 + |{y : v(y) > v(x)}|`, rounds to 2dp before compare so display-equal grades tie), `mean` (null on empty — never NaN), `gradeSpread` (six letter buckets, zero-filled).
- `convex/computedGrades.ts` — five read-only queries under the `// ─── Phase B` banner, all `requireRole(["admin","teacher"])`, each ONE indexed `by_level_year_subject_semester` read then active-enrollment filter then pure math:
  - **B.2 `getClassAverages`** — class avg + optional student value/delta; `sufficient:false`+`classAverage:null` below the ≥5 floor.
  - **B.4 `getPerCaClassBaseline`** — `{ca1,ca2,ca3}`, each `{mean,n}|null`, ≥5 floor applied **per-CA independently**.
  - **B.3 `getClassPositions`** — one student's per-subject + overall ranks; **final-gated on a LIVE assessment count** (`liveAssessmentCount`, batched per unique subject via `by_subject_semester`), provisional excluded, ties shared; overall suppressed unless the student's whole graded term is final AND ≥5 term-complete peers (`overallSuppressedReason`: `not_graded`/`provisional`/`insufficient_peers`).
  - **B.5 `getGradeSpread`** (A–F distribution, includes provisional = "current standing") + **`getStudentsNeedingHelp`** (<50%, lowest-first).
- Private helpers: `presentCaCount`, `activeRows` (batched `exitDate === undefined` filter — DA B-1), `classSubjectRows`, `classTermRows`, `liveAssessmentCount`.

**Devil's Advocate pass (2026-07-03) — all seven mitigations implemented** (see the DA table above): B-1 withdrawn-exclusion, B-2 2dp tie-rounding, B-3 null-not-NaN, B-4 overall-final-gate, B-5 batched live count / no new index, B-6 per-CA floor, B-7 backfill-completeness JSDoc.

**Backend Review — APPROVED (2026-07-03):** Full CLAUDE.md checklist + `convex-performance-audit` passed. Verified: role gate first in all 5 handlers; declared indexes only; no N+1 (`liveAssessmentCount` once per **unique** subject, enrollment/name reads batched); reads one-class-bounded — a `.take()` would silently corrupt an aggregate so **not** warranted; no NaN path; no schema leak; `studentFullName` to teachers is within scope. Three non-blocking carry-forwards for Phase C: (a) label the cohort spread "current standing" (includes provisional) not "final results"; (b) narrow `standardLevelId`/`academicYear` to required (widen-migrate-narrow) so future orphans can't drop out of analytics; (c) `getClassPositions` "term-complete" does not yet require full subject coverage — revisit if the overall headline needs it.

**Verification:** `tsc --noEmit` ✓ · `biome check` ✓ · `next build` (18 routes) ✓ · 177 unit tests ✓ (incl. 8 new). **NOT yet exercised against live data** — dev `computedGrades` is empty (A.4 cleared 1300 orphans), so B.2–B.5 return empty/"not enough data" until a coherent ≥5-student Class fixture is seeded. Pure math is unit-proven; the thin query wrappers are Backend-Review-proven; live integration is a Phase C prerequisite (seed fixture). **Stopped before Phase C per handoff.**

### Decisions Made (this session, 2026-06-30)
- ADR-0004's math is **unbuilt**; this feature implements it before any analytics. Verified `computedGrades.ts`, `studentAssessmentAnswers.ts`, `MarkEntryGrid.tsx` — answer rows are created lazily, so "Present CA = ≥1 answer row" holds at the data layer.
- **Zero present CAs → no `computedGrade` row** (not 0/F). "Not yet graded" = absence of a row.
- **Provisional grades** flagged via `expectedCaCount`; letter grade stays renormalized/authoritative.
- Old **cross-level "Improving/Declining" verdict removed** (apples-to-oranges); see ADR-0005.
- **Individual analytics = Shape A (you-vs-class snapshot) + Shape B (you-vs-class within-term line)**; Shape C (gap-over-time) deferred.
- **Class = level + year** (section cosmetic); **Class Average & Position need ≥5 graded peers**; **Position final-gated**, ties shared; **overall position** is the headline, per-subject is detail.
- **Cohort first cut = grade spread + below-50% list only**. Per-question (②) and concept-tag (③) analytics deferred — `conceptTag` / `learningObjective` stay parked per CONTEXT.md.

---

## Current Feature: React Testing Library harness (test infra only)
**Status**: In Progress
**Active Agent**: FRONTEND AGENT

### Goal
Add the React Testing Library layer on top of the existing Vitest setup so component
tests can be written, WITHOUT breaking the existing 18 pure-logic `lib/*.test.ts` files.
Harness setup only — NO Phase C feature code.

### Sub-tasks
- [ ] 1. Install RTL devDeps (@testing-library/react, /jest-dom, /user-event, jsdom) via npm
- [ ] 2. Rewrite vitest.config.ts — react() plugin, jsdom env, setupFiles, @ alias, include/exclude
- [ ] 3. Create vitest.setup.ts (import "@testing-library/jest-dom/vitest")
- [ ] 4. Add tracer-bullet component test at components/__rtl_smoke__.test.tsx
- [ ] 5. Verify: npm test (all pass), npm run lint (0 errors), npm run build (green)

### Implementation Notes (2026-07-03) — RTL harness
**What shipped:**
- devDeps: `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1`,
  `@testing-library/user-event@^14.6.1`, `jsdom@^29.1.1` (React 19 / Vitest 4 compatible).
- `vitest.config.ts` — rewritten: `react()` plugin, `environment: "jsdom"`, `globals: false`
  (existing lib tests use explicit `import { ... } from "vitest"`, so unaffected),
  `setupFiles: ["./vitest.setup.ts"]`, `@` alias → project root (mirrors tsconfig `"@/*": ["./*"]`),
  `include: ["**/*.test.{ts,tsx}"]`, deep-glob `exclude` (`**/node_modules/**`, `**/.next/**`,
  `**/.sandcastle/**`, `e2e/**`).
- `vitest.setup.ts` — single line: `import "@testing-library/jest-dom/vitest";`.
- `components/__rtl_smoke__.test.tsx` — tracer-bullet: renders `<button aria-label="ping">`,
  asserts `getByRole` + `toBeInTheDocument` + `toHaveTextContent`, and `cn("a","b") === "a b"`
  via the `@` alias to prove alias resolution inside a `.test.tsx` file.

**Gotcha found + fixed:** first jsdom run leaked 7 third-party test files from
`.sandcastle/worktrees/.../node_modules/` (2 zod codec tests failed) because a bare
`"node_modules"` exclude only matches top-level. Fixed by switching to deep globs (`**/node_modules/**`)
and adding `**/.sandcastle/**`. No existing test needed a `// @vitest-environment node` fallback —
all 20 pure-logic tests pass under jsdom unchanged.

**Verification:** `npm test` → 21 files / 179 tests passed (exit 0) ·
`npm run lint` (biome, 202 files) → 0 errors · `npm run build` → 18 routes, green,
no test/config files bundled.

### Sub-tasks (RTL harness)
- [x] 1. Install RTL devDeps — DONE (awaiting FRONTEND REVIEW)
- [x] 2. Rewrite vitest.config.ts — DONE (awaiting FRONTEND REVIEW)
- [x] 3. Create vitest.setup.ts — DONE (awaiting FRONTEND REVIEW)
- [x] 4. Smoke test components/__rtl_smoke__.test.tsx — DONE (awaiting FRONTEND REVIEW)
- [x] 5. Verify test/lint/build all green — DONE (awaiting FRONTEND REVIEW)

**Status**: Review (ready for FRONTEND REVIEW AGENT)

---

## Current Feature: Academic History view-model (Phase C)
**Status**: Review (ready for FRONTEND REVIEW AGENT)
**Active Agent**: FRONTEND AGENT

### Goal
Create `lib/academicHistoryView.ts` (pure functions + shared types) and its
Vitest test `lib/academicHistoryView.test.ts` via strict TDD (red→green, one
behavior at a time). No React, no Convex calls, no DOM.

### Exports to build (pure)
- Types: Direction, Rank, OverallSuppressedReason, SubjectRowSeed, SubjectRowView, PerCaChartPoint
- ordinal(n)
- overallPositionCopy(overall, reason)
- formatDelta(delta)
- provisionalLabel(presentCaCount, expectedCaCount)
- buildPerCaChartData(baseline, student)

### Sub-tasks (strict TDD, red→green per behavior)
- [x] 1. ordinal — DONE (5 tests) — awaiting FRONTEND REVIEW
- [x] 2. overallPositionCopy — DONE (6 tests) — awaiting FRONTEND REVIEW
- [x] 3. formatDelta — DONE (6 tests) — awaiting FRONTEND REVIEW
- [x] 4. provisionalLabel — DONE (3 tests) — awaiting FRONTEND REVIEW
- [x] 5. buildPerCaChartData — DONE (3 tests) — awaiting FRONTEND REVIEW

### Verification (2026-07-03)
- `npm test` → 22 files / 202 tests passed (179 baseline + 23 new). Nothing broken.
- `npx biome check lib/academicHistoryView.ts lib/academicHistoryView.test.ts` → 0 errors
  (initial run flagged tab vs 2-space format; fixed with `--write`).
- `npx tsc --noEmit` → no type errors on the new file.

### Notes / additions beyond spec
- Exported extra named types for the container to reuse (not renamed, spec unchanged):
  `OverallPositionCopy`, `CaBaselinePoint`, `PerCaBaseline`, `StudentCaPercentages`.
  All spec-named types + function signatures match the contract exactly.
- No React / Convex / DOM — pure functions only. Copy strings verbatim from spec.

---

## Current Feature: Phase C.2 — "You vs Class" per-subject comparison card (+ C.1 provisional tags)
**Status**: In Progress
**Active Agent**: FRONTEND AGENT

### Sub-tasks (TDD: red → green → refactor, one behavior at a time)
- [x] C.2.1 SubjectComparisonRowView (pure) — full-data render (name, You, Class, +Δ up-icon, position, no badge) — GREEN
- [x] C.2.2 SubjectComparisonRowView — classAverage null → "not enough class data yet", no delta icon — GREEN
- [x] C.2.3 SubjectComparisonRowView — negative delta → down icon + "below class" aria-label — GREEN
- [x] C.2.4 SubjectComparisonRowView — provisional true → "Provisional" badge + provisionalLabel, no position — GREEN
- [x] C.2.5 ClassComparisonCard — rows=[], loading=false → empty state — GREEN
- [x] C.2.6 ClassComparisonCard — loading=true → skeleton, not empty state — GREEN
- [x] C.2.7 SubjectComparisonRow (fetch wrapper) — thin useQuery wrapper; verified live, not unit-tested (avoids Convex provider)
- [x] C.2.8 npm test (216/216 pass, 25 files) + npx biome check (0 errors, 3 files) + tsc clean → READY FOR FRONTEND REVIEW AGENT

### Notes
- Fixed a shared-harness bug: `vitest.setup.ts` had no `afterEach(cleanup)`, so with `globals: false` RTL DOM leaked between tests in the same file (false failures from prior renders). Added explicit cleanup — benefits all component tests. Full suite re-verified green.
- A11y: delta indicator uses `role="img"` + `aria-label` (e.g. "5.0 below class"); loading uses `<output>` (implicit status role) per the OverallPositionHeadline convention; direction conveyed by icon+label, never color alone.
- **Status**: awaiting FRONTEND REVIEW AGENT approval before marked complete.

---

## Current Feature: Phase D / D.1 — Admin "Class Analytics" page (cohort one-class view)
**Status**: In Progress
**Active Agent**: FRONTEND AGENT
**Baseline**: 25 files / 220 tests passing.

No new backend — consumes the Backend-Review-approved `getGradeSpread` (B.5a) and
`getStudentsNeedingHelp` (B.5b). Mirrors the Phase C precedent: pure view-model
(`lib/cohortView.ts`) + presentational components + container page. TDD, vertical slices.

### DA mitigations (LOCKED — implement all)
1. Route `admin/class-analytics/page.tsx`; sidebar "Class Analytics"; wrap in RoleGate(admin).
2. Semester ALWAYS passed (default 1) to BOTH queries — never undefined to getGradeSpread.
3. Selector: level (req) + year (req) + term (default 1) + subject (optional/"All subjects"). Queries "skip" until level+year resolve.
4. FOUR empty states in cohortView.ts (unit-tested): (a) no grades total=0; (b) grades but none <50% (good-news); (c) subject selected, no grades; (d) all passing for subject.
5. "All subjects" → who-needs-help groups by studentId (one row per student, failing subjects nested). Specific subject → flat list. Grouping in cohortView.ts + unit-tested.
6. Chart title "Current Standing"; visible subtitle "Includes grades in progress — not final results." exported as CONSTANT. No "Results" as a heading/label anywhere.
7. Exactly TWO useQuery calls (one per Phase B query). No per-subject query in a .map. Subject list = one selector query.
8. Mobile 375px: fixed chart height + ResponsiveContainer width 100%; needs-help list collapses to name + grade% + subject subtitle; overflow-x-auto if table.

### Sub-tasks (strict TDD, red→green per behavior)
- [x] D.1.1 cohortView: spread → ordered A+…F chart series `{ grade, count }[]` — GREEN (1 test)
- [x] D.1.2 cohortView: total/count labels (`gradeCountLabel`) — GREEN (3 tests)
- [x] D.1.3 cohortView: 4-way empty-state discriminator (`cohortState` + copy constants) — GREEN (6 tests)
- [x] D.1.4 cohortView: needs-help grouping (`groupNeedsHelpByStudent`) — GREEN (4 tests)
- [x] D.1.5 cohortView: `CURRENT_STANDING_TITLE` + `CURRENT_STANDING_SUBTITLE` constants — GREEN (2 tests)
      → lib/cohortView.ts: 16 tests green, tsc clean, biome 0 errors.
- [x] D.1.6 GradeSpreadChart presentational component (jsdom-safe) — GREEN (4 tests). Title "Current Standing", visible subtitle constant, count label, loading `<output>`.
- [x] D.1.7 NeedsHelpList presentational component (jsdom-safe) — GREEN (2 tests). Grouped (student-once, subjects nested) + flat (subject subtitle) modes.
- [x] D.1.8 Container page `app/(dashboard)/admin/class-analytics/page.tsx` — RoleGate(admin), 4 selectors, exactly TWO cohort useQuery, semester always passed, skip until level+year, 4 empty states + loading + good-news. Verified via tsc/biome + live (not unit-tested — needs Convex provider, per Phase C SubjectComparisonRow precedent).
- [x] D.1.9 Sidebar entry "Class Analytics" (BarChart3 icon, Administration group, admin-only).
- [x] D.1.10 Full verify: npm test 28 files/242 tests (was 220) + tsc clean + biome 0 errors on all 8 files.

### Verification (2026-07-03)
- `npx vitest run` → 28 files / 242 passed (baseline 220 + 22 new). Nothing broken.
- `npx tsc --noEmit` → clean (no output).
- `npx biome check` on all created/changed files → 0 errors (initial line-wrap format auto-fixed with `--write`).
- `npx vitest list` confirms new test files are project-scoped (no `.sandcastle`/`node_modules` leak).
- DID NOT run `next build` (next dev is live — build corrupts .next per project rule).

### DA mitigations — how each is satisfied
1. Route `admin/class-analytics/page.tsx`; sidebar "Class Analytics"; content wrapped in `RoleGate allowedRoles={["admin"]}`.
2. `selectedSemester` state defaults "1"; `semester` (parsed 1|2) passed to BOTH getGradeSpread + getStudentsNeedingHelp; comment states the constraint on each call.
3. Selectors: level (req) + year (req) + term (default 1) + subject (optional, "All subjects" sentinel → subjectId undefined). Both cohort queries `"skip"` until level+year resolve; semester always defaulted so never blocks.
4. Four empty states discriminated in `cohortState` (unit-tested): empty / empty_subject / all_passing / all_passing_subject. Good-news copy uses "every student is passing" (never "no data yet").
5. `groupNeedsHelpByStudent` (unit-tested) groups by studentId when NO subject; page renders `NeedsHelpList mode="grouped"`. Subject selected → `mode="flat"` one-row-per-student.
6. Chart title `CURRENT_STANDING_TITLE` = "Current Standing"; visible `CardDescription` = `CURRENT_STANDING_SUBTITLE` constant. No "Results" heading/label anywhere (grep-verified).
7. Exactly TWO cohort `useQuery` (getGradeSpread + getStudentsNeedingHelp). No per-subject query in a `.map`. Subject list is one selector query. Comment states the constraint.
8. Mobile: chart `ResponsiveContainer width="100%" height={240}`; NeedsHelpList rows are flex name+grade% with subject on its own subtitle line; grid is `grid-cols-1 lg:grid-cols-2`.

**Status**: awaiting FRONTEND REVIEW AGENT approval before marked complete.
