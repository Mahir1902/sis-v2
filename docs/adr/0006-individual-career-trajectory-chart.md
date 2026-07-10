---
status: accepted
date: 2026-07-10
---

# Individual career trajectory chart: raw grade history as judgment-free context

## Context and decision

The Academic History tab needs a chart that ties a student's per-term averages together
across their whole career — the "how has this student done over the years" view. The hard
part is that such a line necessarily crosses grade levels, and a subject's difficulty
changes between levels, so a continuous line risks exactly the apples-to-oranges misread
that [ADR-0005] set out to kill (it removed the old cross-level "Improving / Declining"
verdict for this reason). ADR-0005 already sanctions one survivor: *"a cross-year line may
survive only as raw history, labeled 'different years, different difficulty,' carrying no
judgment."* This ADR specifies the concrete design of that survivor; it does not change
ADR-0005's policy. Charted via `/wayfinder` ticket 0002.

The chart plots **one overall line** — the mean of a student's subject weighted-averages
per term — using the same aggregate the enrollment accordion already computes (`sem1Avg`,
`sem2Avg`). No per-subject lines (N crossing lines multiply the cross-level confusion) and
no class-average overlay (a cohort line across levels is the deferred "Shape C" gap chart,
still parked).

Concretely:

- **X-axis: one point per semester**, categorical and evenly spaced over the terms that
  have *final* grades. Per-semester (not per-year) is deliberate: the S1→S2 step *within* a
  level is a **same-difficulty** move — the honest kind — while only the year/level
  boundaries are the difficulty jumps.
- **Level boundaries: connect within a level, break between levels.** The two semesters of
  one level are joined into a segment; the line is *broken* between levels so the eye can't
  trace a continuous "trend" across a difficulty jump. A shaded, labeled band ("Grade 9",
  "Grade 10", …) sits behind each level's segment to make the difficulty context explicit.
- **No verdict.** One neutral-coloured line, point values only. No trend arrows, no
  improving/declining label, no cross-level rank, no numeric deltas (the slope shows
  within-level movement; a "+4% since Sem 1" number is the first step back onto the verdict
  path). Title **"Grade history"** with a persistent caption: *"Different years, different
  difficulty — shown as context, not a like-for-like comparison."*
- **Edge states.** Render the chart only with **≥2 points** (below that the accordion
  already shows the single term). Gap years are drawn as simple absence — the x-axis lists
  only terms that have grades; no placeholder. **Provisional / partial-CA terms are omitted
  until final** (all three CAs present), so an unstable number that will move as marks are
  keyed in never appears as a settled point. Consequence: the current in-progress term does
  not show until it closes.

## Considered options

- **Per-subject multi-line** (one line per subject across the career). Rejected: N lines
  each crossing level boundaries multiplies the exact cross-level misread ADR-0005 targets.
  The subject breakdown already lives in the enrollment accordion.
- **Continuous line + level bands, no break.** Rejected as the default: prettier as a growth
  story, but an unbroken line invites the like-for-like reading even with bands and a
  caption — ADR-0005's stated fear that "a difficulty-blind trend invites the same
  misreading even relabeled." The break carries the semantics; the band carries the label.
- **One point per year** (average both semesters). Rejected: discards the honest
  same-difficulty within-level S1→S2 movement and leaves a very sparse line (~3 points).
- **Class-average overlay / gap-to-class line ("Shape C").** Not chosen here — it is the
  deferred, more abstract longitudinal view ADR-0005 parked; this ticket ships the legible
  raw-history line first.
- **Plot provisional terms (flagged, or identically).** Rejected in favour of omitting them:
  the finality gate that ADR-0005 applies to Class Position applies in spirit here too —
  cleaner to show only settled points than to explain a moving one. (This is *stricter* than
  ADR-0005, which only gated Position on finality, not raw history.)
- **Amend ADR-0005 / no decision record.** Rejected in favour of a dedicated ADR: the design
  is a self-contained, buildable spec worth its own record rather than a footnote on 0005 or
  a decision that lives only in a wayfinder ticket.

## Consequences

- **No new query or data.** The line reuses `getComputedGradesByStudent` +
  `getEnrollmentHistory` and the accordion's existing per-term aggregate; there is no new
  read to performance-audit. Build is a Recharts component on the Academic History tab.
- **This ADR is design-only (planning).** Building the chart is the follow-on once
  wayfinder ticket 0002 closes; the spec here is what implementation consumes.
- **ADR-0005 is unchanged** and remains the source of truth for the no-cross-level-comparison
  policy; this ADR is a permitted implementation of its "judgment-free context" clause.
- **Shared visual language across the four grade charts** (term/year selector, colour scale,
  suppression-state treatment) is deliberately *not* fixed here. This chart's patterns —
  level bands, break-between-levels, the persistent disclaimer caption, final-terms-only —
  become seed values for that later reconciliation, once the cohort charts (wayfinder
  tickets 0003/0004/0005) also land.
