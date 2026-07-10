---
name: dev-db-grade5-assessment-pollution
description: Dev DB has pre-seeded assessments (with answers) blocking clean grade fixtures at Grade 5 / 2025-2026; KG-2 is empty
metadata:
  type: reference
---

The dev Convex deployment (`hushed-bass-123`) is heavily seeded with test `assessments`.
For **Grade 5 (standardLevel code "05") / academic year "2025-2026"**, each core subject
(Mathematics, English, Science) already has 3 active `CA-1/2/3` assessments in BOTH
semesters, and those pre-existing CAs carry answers from at least one other student.

Why this matters for grade fixtures/tests: `recomputeGrade` and the Phase-B analytics
`liveAssessmentCount` count ALL active assessments for a (subject, level, year, semester).
Extra strays inflate the "expected CA" count, so a fixture that only marks its own 3 CAs
produces grades where `presentCaCount < liveAssessmentCount` → every grade reads as
**provisional** → per-subject positions AND the overall Class Position rank get suppressed.
Reusing the strays instead pulls their pre-existing student answers into your class average.

**How to apply:** When you need a clean, self-contained "Class" for grade analytics, do NOT
use Grade 5 / 2025-2026. As of 2026-07-03, **KG-2 (code "KG2") / 2025-2026 was verified
empty** across all 3 subjects and both semesters — use it (or verify another level is empty
first). Verify emptiness by querying `assessments` filtered on standardLevelId +
academicYearId + subjectId + semester + isActive, not by grepping `npx convex data`
(that command paginates/truncates and its column output is easy to misread).

Do NOT "fix" this by deactivating the strays' `isActive` flag — that mutates shared dev data
the auto-mode classifier will (correctly) block. Pick a clean level instead.

Standard level names in the dev DB are spelled out ("Grade Five", "KG-2"), NOT "Grade 5",
so look levels up by their stable `code` field, not `name`. Subjects/campuses/academicYears
DO match by name ("Mathematics", "Campus 01", "2025-2026").
