---
status: accepted
date: 2026-06-30
---

# Difficulty-adjusted academic analytics: measure students against their own class

## Context and decision

"How is this student doing?" cannot be answered honestly with raw percentages. A subject's
difficulty changes between grade levels, so a score plotted across levels (Grade 2 Math 85% →
Grade 4 Math 75%) is apples-to-oranges — yet the existing Academic History chart did exactly
that and stamped an "Improving / Declining" verdict on it. The verdict punished students for
sitting harder papers. See [CONTEXT.md → Grading & Academic Records] for the language
(Class, Class Average, Class Position, Provisional Grade) and [ADR-0004] for the grade-math
fix this builds on.

We are standardising all academic analytics on **same-difficulty comparison**: a student is
measured against the classmates who sat the *same papers*, or against their own movement
*within one term*. Difficulty is cancelled out by construction rather than corrected for.

Concretely:

- **The unit of comparison is the Class = standard level + academic year** (not section — sections
  are cosmetic, and assessments/marks are already defined per level). The baseline is the
  **Class Average**: the mean of present students' renormalized weighted averages for one
  subject + semester.
- **Individual view** (student's Academic History tab) presents two same-difficulty shapes:
  a per-subject *you-vs-class-average* snapshot, and a *you-vs-class* line across CA-1/2/3
  within one term. Plus an **overall Class Position** headline and per-subject positions.
- **Cohort view** (first cut) is two reads over data already stored: an A–F **grade spread**
  and a **below-50% "who needs help"** list. Per-question and concept-level analytics are
  explicitly deferred, not designed-in.
- **The old cross-level "Improving / Declining" verdict is removed.** A cross-year line may
  survive only as raw history, labeled "different years, different difficulty," carrying no
  judgment.
- **Guardrails:** class average and position appear only with **≥5 graded peers** (a 1–4
  student "average" identifies a specific classmate, not a cohort); **Class Position** shows
  only on **final** (non-Provisional) grades so it does not thrash as marks are keyed in
  mid-term; ties share a rank.

## Considered options

- **Cross-level statistical normalisation** (z-scores / standardised scores across levels, so a
  single longitudinal line is "fair"). Rejected for v1: heavy to compute and explain, opaque to
  teachers and parents ("why is my 75% shown as +0.4?"), and overkill for a single-school SIS.
  The class-relative comparison gives the same difficulty-cancelling property in numbers everyone
  already understands.
- **Percentile / rank as the only signal** (drop the average-delta, show only "you're in the top
  20%"). Rejected: percentile alone hides the actual mark and over-emphasises ranking. We show
  above/below-average always and gate the harder-edged Class Position behind finality + the
  5-peer floor.
- **Gap-over-time line** (plot the student's delta-to-class-average across years — the honest
  version of the cross-level chart). Not rejected, *deferred* (it was "Shape C"). It is the most
  powerful longitudinal view but the most abstract to read; ship the legible snapshot + within-term
  line first.
- **Keep the cross-level raw-% trend with a softer label.** Rejected as the headline: the verdict
  is the part that lies, and a difficulty-blind trend invites the same misreading even relabeled.
  Raw history survives only as explicitly-labeled, judgment-free context.
- **Per-question / concept-tag analytics now.** Deferred: per-question aggregation needs a new
  read but no new data; concept analytics needs a tagging UI plus per-question tagging effort.
  Neither is required to make the basics honest, and the user asked to keep the first cut simple.

## Consequences

- **New read-amplifying queries — bounded to one indexed read.** Class Average and Class Position
  read every classmate's computed grade for a subject/term. **Resolved 2026-06-30:**
  `standardLevelId` + `academicYear` are denormalised onto `computedGrades` (immutable per grade,
  so no staleness) with a `by_level_year_subject_semester` index — a whole class is one indexed
  range read, not a fan-out over enrollments. Fields are optional until the ADR-0004 recompute
  backfills them, then narrow to required. Still run `convex-performance-audit` on the aggregate
  once built.
- **Depends on ADR-0004 landing first.** The comparison must be like-for-like *renormalized*
  values; comparing against the old deflated math would be meaningless. Order is: math fix +
  recompute, then analytics.
- **`expectedCaCount` (from ADR-0004's provisional work) becomes load-bearing for position
  gating** — "final" means present CAs == expected CAs.
- **Section is formally non-load-bearing for grading/analytics.** If the school later wants
  section-level comparison (different teachers, genuinely different cohorts), that is a new
  decision, not a tweak — the Class is defined as level + year here.
- **The cohort view is deliberately shallow.** Per-question and concept analytics are parked; when
  they land they will reuse this view's level/year/subject/term selector, not replace it.
