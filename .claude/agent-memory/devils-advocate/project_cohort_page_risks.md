---
name: project-cohort-page-risks
description: DA findings for Phase D.1 cohort class-analytics page — semester divergence, empty states, dedup, provisional labeling
metadata:
  type: project
---

Phase D.1 cohort page DA review completed 2026-07-03. Key locked mitigations:

**Semester divergence (finding 2):** `getGradeSpread` semester is OPTIONAL in backend but MUST always be passed from frontend. Default selector to Sem 1, never leave undefined. The backend's optional signature is for programmatic use only; the UI must never exercise the undefined path or the two panels describe different populations silently.

**Why:** If spread is called without semester and needs-help is called with semester=1, the chart covers the full year but the list covers one term — looks coherent but is wrong.

**Empty states (finding 3):** Four distinct cases — no grades at all (3a), grades exist but none <50% (3b), no grades for selected subject (3c), grades exist for subject but all passing (3d). Cases 3b and 3d are good news and must NOT reuse the "no data yet" copy from 3a/3c. The `lib/cohortView.ts` view-model must distinguish all four using `total` + `subjectName` props.

**Needs-help deduplication (finding 4):** When subjectId is undefined ("All subjects"), `getStudentsNeedingHelp` returns one row per student-subject pair. The frontend MUST group by studentId so the same student name does not appear N times in the list. When a specific subject is selected, flat list is fine (at most one row per student).

**Provisional labeling (finding 8):** `getGradeSpread` includes provisional grades. Chart title must be "Current Standing" with a visible (not hover-only) subtitle "Includes grades in progress — not final results." Never use "Results" or "Distribution" alone. The subtitle string should be exported from `lib/cohortView.ts` as a constant so it cannot be omitted.

**Route/label decision (finding 6):** LOCKED as `/admin/class-analytics` (route) and "Class Analytics" (sidebar label). "Cohort" is ADR-0005 internal jargon; "Class Analytics" matches CONTEXT.md primary term and existing admin route naming.

**No fan-out queries (finding 7):** The cohort page must have exactly two `useQuery` calls — `getGradeSpread` and `getStudentsNeedingHelp`. No per-subject `getClassAverages` map. Any expansion is a separate page.

**How to apply:** Enforce findings 2, 3, 4, 8 in `lib/cohortView.ts` (TDD first) before building any component. Add explicit comments in the page container for findings 2 and 7.
