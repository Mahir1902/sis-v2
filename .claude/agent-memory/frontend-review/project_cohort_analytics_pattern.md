---
name: project-cohort-analytics-pattern
description: Approved architecture and DA mitigation patterns for admin cohort analytics pages (Phase D / D.1)
metadata:
  type: project
---

The Phase D cohort analytics page (`app/(dashboard)/admin/class-analytics/page.tsx`) established several approved patterns worth reusing on future read-only analytics pages:

**DA mitigations that are now proven patterns:**

1. **Sentinel string for optional Select value** — `const ALL_SUBJECTS = "__all__"` avoids `undefined` state in controlled shadcn Select; convert to `undefined` at query-arg derivation time. Approved.

2. **Skip gate comment + semester default** — always initialize `useState<"1"|"2">("1")` for semester so it never blocks the `ready` gate. Comment the constraint inline (DA #2). Approved pattern for any filtered analytics page.

3. **Exactly TWO cohort useQuery calls** — selector-source queries (levels, years, subjects) are allowed on top; the two data queries are the only ones that should be gated by `ready`. Comment count inline per DA rule. This is the enforcement point for the Phase C fan-out trap.

4. **Pure view-model in `lib/`** — all branching logic (empty-state discrimination, grouping, series building, copy constants) lives in a tested `lib/*View.ts` file, not in the component body. Component only renders — zero logic. Approved and enforced.

5. **Four-way empty state discrimination** — `cohortState()` returns one of five `kind` values; good-news variants (`all_passing`, `all_passing_subject`) must NOT use copy that reads as "no data yet". Both good-news states render a `GoodNewsState` with a green checkmark icon — visually distinct from the `EmptyState` inbox icon. Approved copy constants exported from view-model.

6. **`var(--color-school-green)` / `var(--color-border)` in Recharts props** — these are Tailwind v4 CSS variable refs, not raw hex; allowed in Recharts `fill`/`stroke` props where Tailwind classes can't reach. Not a violation.

7. **`<output aria-label="..." aria-busy="true">` for loading skeletons** — the `<output>` element carries an implicit ARIA `status` role, making the skeleton accessible without an extra `role="status"` attribute. First seen Phase D; approved pattern for all future loading states.

**Why:** These patterns eliminate the Phase C fan-out bug risk (Rules-of-Hooks violation from per-subject useQuery in .map) and the DA silent-bug risk (undefined semester passed to getGradeSpread silently merging semesters).

**How to apply:** Any new admin analytics page with multi-selector filters should follow this architecture. Flag deviations — especially any useQuery inside .map or undefined passed to a required query arg — as blocking.

Related: [[feedback_filter_logic_in_hooks]], [[project_hook_extraction_pattern]]
