# Handoff — Grading Overhaul, Phase A (grade-math implementation)

**Date:** 2026-06-30
**Branch:** `review/grading-cards`
**Next session:** Start implementing **Phase A** (grade computation fix), then continue down the plan.

---

## TL;DR

The previous session was a **design session** (grill-with-docs), not an implementation one. The
full design for the grading + analytics overhaul is now locked and written into artifacts. **No
production logic has been built yet** except one small backend enabler (B.1, see below).

Your job next: implement **Phase A** — fix the grade math. Everything else (analytics queries,
charts, cohort view) is meaningless until the math is correct and existing grades are recomputed.

**Do not re-litigate the design.** It's decided and documented. Read the artifacts, then build.

---

## Where the design lives (read these first — don't duplicate them here)

| What | Path |
|------|------|
| **The sequenced plan** (Phase A–E, sub-tasks, Devil's Advocate findings) | `TASK_LOG.md` → "Current Feature: Grading & Academic Analytics Overhaul" |
| **Grade-math spec** (the rules Phase A implements) | `docs/adr/0004-grade-computation-model.md` |
| **Analytics approach** (why class-relative, what's deferred) | `docs/adr/0005-difficulty-adjusted-academic-analytics.md` |
| **Domain glossary** (Class, Class Average, Class Position, Provisional Grade, Present CA, Absent vs Unmarked) | `CONTEXT.md` → "Grading & Academic Records" |
| **Original feature brief** (the 4 analytics features, priority) | `docs/handoffs/2026-06-26-grading-analytics-features.md` |

---

## Git state (all uncommitted on `review/grading-cards`)

```
 M CONTEXT.md                    ← glossary additions (this session)
 M TASK_LOG.md                   ← new feature plan (this session)
 M convex/schema.ts              ← B.1: computedGrades denormalised fields + index
 M convex/computedGrades.ts      ← B.1: mutation populates the new fields
 M convex/_generated/api.d.ts    ← regenerated (convex codegen)
?? docs/adr/0004-...md           ← (created earlier, untracked)
?? docs/adr/0005-...md           ← analytics ADR (this session)
?? docs/handoffs/                ← this doc + the 06-26 brief
?? convex/_e2eTemp.ts            ← pre-existing, NOT from this work — leave it alone
```

Nothing is committed. Decide commit boundaries as you go (the B.1 schema change is a clean,
self-contained first commit if you want one).

---

## What already landed this session (B.1 — the analytics enabler)

`computedGrades` rows didn't carry level/year, so the future Class Average / Class Position
queries had nothing to index on. Fixed:

- `convex/schema.ts` — `computedGrades` gained `standardLevelId` + `academicYear` (both
  `v.optional` for now) and a `by_level_year_subject_semester` index.
- `convex/computedGrades.ts` — `computeGradesForStudent` populates both from the enrollment it
  already loads.
- Verified: `npx convex codegen` ✓, `npx tsc --noEmit` ✓, `npm run lint` ✓, `graphify update .` ✓.

**Carry this forward:** when you rewrite `computeGradesForStudent` in A.1, **keep those two
populate lines** — they're correct and independent of the math. After A.4's backfill, narrow the
two fields (and `expectedCaCount`) from optional → required (widen-migrate-narrow).

---

## Phase A — the work (full task list + rules are in `TASK_LOG.md` / ADR-0004)

Implementation pointers and gotchas **not** already in the ADR:

**A.1 — Rewrite `computeGradesForStudent`** (`convex/computedGrades.ts`, currently the old buggy version):
- **Present CA = the student has ≥1 answer row for that assessment.** Verified safe: rows are
  created lazily (`upsertAnswer` / `bulkMarkEntry` / `MarkEntryGrid` only write touched cells),
  so row-existence reliably means "marked."
  - **Absent** = rows exist with `isAbsent: true`, marks 0 → counts as a **present 0**.
  - **Unmarked** = no rows → **excluded** from the denominator (not a zero).
- **Denominator = Σ `assessmentQuestions.marksAllocated`** for that assessment — NOT
  `assessment.totalMarks`. The current code uses `totalMarks` (the bug). You'll need to load each
  assessment's questions (`by_assessment`) to sum allocated marks. **Watch N+1** — batch the
  questions + answers loads with `Promise.all` across assessments.
- **Renormalize:** divide by the summed weight of *present* CAs, not a fixed 1.0. Equal weights.
- **Zero present CAs → write NO row** (this session's decision A). Edge case the ADR doesn't spell
  out: if a stale row exists from the old math and recompute now finds zero present CAs, **delete
  the existing row** — otherwise an old "0 / F" lingers and re-introduces the bug.
- Consider extracting the pure renormalization + letter-grade math into a testable helper
  (`lib/gradeUtils.ts` already exists; the project's test pattern is "pure helpers, unit-tested" —
  ~20 vitest files). This is the cleanest way to get red-green coverage on the math.

**A.2 — `expectedCaCount`** on `computedGrades`: the count of active assessments for the group.
The mutation already loads the `assessments` array — it's `assessments.length`. Powers the
Provisional Grade tag (present count < expected → provisional). Present count is derivable from how
many `caXPercentage` fields are set, so only `expectedCaCount` needs storing.

**A.3 — Delete `assessmentWeightingRules`.** Confirmed reader inventory (no frontend touches it):
- `convex/assessmentWeightingRules.ts` — delete the whole file.
- `convex/schema.ts` — remove the table definition.
- `convex/computedGrades.ts` — remove the lookup + `w1/w2/w3` rule branch (replace with equal split).
- `_generated/api.d.ts` regenerates on codegen — don't hand-edit.

**A.4 — Recompute / backfill all existing `computedGrades`.** No migrations component is installed
(`convex/` has none). Two options: install `@convex-dev/migrations` (use the
`convex-migration-helper` skill), or write a one-off `internalMutation` that pages `computedGrades`
and re-runs compute per (enrollment, subject, semester). This pass **also backfills the B.1 fields
+ `expectedCaCount`**, which unblocks the optional→required narrowing.
- **Also verify the recompute trigger:** changing the mutation only affects grades when it *runs*.
  Find what currently calls `computeGradesForStudent` (mark entry? a manual button?) and make sure
  ongoing entry recomputes, not just the one-time backfill.

---

## Workflow constraints (from `CLAUDE.md` — these are enforced)

- Mandatory agent gates: **Planning → Devil's Advocate → Backend → Backend Review.** A.1–A.4 all
  touch schema or financial-adjacent grade logic → **Devil's Advocate + Backend Review are
  required** before marking any sub-task done. Update `TASK_LOG.md` before/after each.
- Backend rules: `requireRole(["admin","teacher"])` first; declared indexes for every `withIndex`;
  no unbounded `.collect()`; `Promise.all` for batched loads; percentages/letter grades server-side.
- **Done = `npm run build` + `npm run lint` pass + Playwright E2E + `graphify update .`** (user
  strongly prefers Playwright E2E verification).

---

## Suggested skills

Invoke per the project's agent system:

- **superpowers:test-driven-development** (or **tdd**) — extract the renormalization/letter-grade
  math into a pure helper and drive it red-green. Highest-leverage skill for Phase A; the math has
  clear edge cases (renormalize, absent vs unmarked, zero present CAs).
- **convex** + **convex-migration-helper** — A.2/A.3 schema changes and the A.4 recompute/backfill.
- **convex-performance-audit** — A.1 loads questions + answers per assessment (N+1 risk) and A.4
  pages a whole table; audit both.
- **devils-advocate** / **backend-agent** / **backend-review-agent** (agents) — the mandatory gates.
- **playwright-cli** — E2E verification of the grades tab after the math change.
- **graphify** — `graphify query` to navigate before grepping; `graphify update .` after code changes.

---

## First steps for the next session

1. Read the four artifacts in the table above (plan, ADR-0004, ADR-0005, CONTEXT glossary).
2. Planning Agent → confirm A.1–A.4 in `TASK_LOG.md`; Devil's Advocate pass on the rewrite.
3. Implement A.1 (with the B.1 populate lines preserved), unit-testing the pure math.
4. A.2 → A.3 → A.4, Backend Review gating each.
5. Verify (build/lint/E2E/graphify), then move to Phase B (the analytics queries the B.1 index now supports).
