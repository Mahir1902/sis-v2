---
status: accepted
date: 2026-11-10
---

# A Class is per campus: campus + standard level + academic year

## Context and decision

The school runs three campuses. "Which class is this student in?" was answered two ways in
code: attendance (issue #111) took the register per (campus, level, year), while mark entry,
promotion and the ADR-0005 analytics worked per (level, year) and so mixed the campuses —
`getEnrollmentsByLevelYear` put every campus's Grade 4 on one mark sheet (#120), and Class
Average / Class Position pooled the three campuses. CONTEXT.md sided with the second reading
("Class = level + year").

The school's answer (2026-11-10): a **Class is campus + standard level + academic year**. A
teacher takes a register, enters marks and compares a child with the pupils in the room; the
school ranks "4th in class" within one campus. We are making the code say exactly that:

- **One roster.** `getClassRoster(ctx, { campus, standardLevelId, academicYear })` in the
  Placement module is the only reader of "who is in the class": open enrollments only
  (`exitDate` unset), de-duplicated per student (newest open row wins), read from a
  `by_class` index on exactly those three fields, with **no silent cap** — it throws above
  1,000 rows instead of quietly dropping the 201st student. Mark entry, attendance, promotion
  candidates and analytics all read it or its denormalised copy.
- **Analytics per campus.** `computedGrades` gains `campus` (copied from the enrollment at
  compute time, like `standardLevelId` / `academicYear`) and a
  `by_class_subject_semester` index; Class Average, per-CA baseline, Class Position, grade
  spread and the needs-help list all take a campus. Rollout is widen (optional field, this
  deploy) → backfill (`migrations:runBackfillComputedGradeCampus`) → narrow (later, with the
  other still-optional denormalised fields).
- **Assessments stay per level + year.** One CA paper per grade level, sat by every campus;
  marks for it are entered one campus at a time. If a campus ever sets its own papers, that is
  a new decision.
- **The ≥5-peer floor stays.** A per-campus class is smaller than a whole level, so Class
  Average and Class Position are suppressed more often ("not enough class data yet"). That
  is intended: a 1–4 peer baseline names a classmate rather than a cohort, and the number of
  pupils actually in the room is the honest denominator.
- **An enrollment with no campus is in no Class.** Legacy import rows may lack a campus. They
  appear on no roster, register, promotion list or class statistic until an admin sets the
  campus via Edit Student; `migrations:placementReport` lists them (`noCampus`).

## Considered options

- **Keep Class = level + year and add a campus filter to mark entry only** (the narrowest fix
  for #120). Rejected: it leaves two definitions of "class" in the code — rosters per campus,
  statistics per level — and the ranking the school prints is a within-campus one.
- **Filter grades by enrollment campus after the level + year read** instead of copying
  campus onto `computedGrades`. Rejected: the analytics already load every row's enrollment
  to drop leavers, so it would work, but it keeps an index keyed on the wrong unit and makes
  every class read 3× larger than the class. Copying one more immutable-per-grade field
  mirrors how level and year already got there, and keeps "one indexed read per class".
- **Paginate the roster** rather than throwing on overflow. Rejected for now: a class is tens
  of pupils; a 1,000-row class is corrupt data, not a page-2 case. The throw is one line and
  loud; pagination can replace it if a real class ever approaches the ceiling.
- **Lower the peer floor for campus classes.** Rejected: the floor protects individuals, and
  it does not get safer because the group is smaller.

## Consequences

- **Screens choose a campus.** Mark entry, promotion and class analytics gain a campus picker;
  the student's Academic History uses the enrollment's own campus.
- **A mid-year campus change (amend) reaches stored grades on the next recompute**, exactly
  like the existing level copy. Until then the student's grades sit in the old campus's
  statistics. The write-path recompute work (review candidate 6) closes that window.
- **Two indexes are replaced**: `enrollments.by_campus_standard` → `by_class`;
  `computedGrades.by_level_year_subject_semester` → `by_class_subject_semester`. Every reader
  changed in the same PR.
- **`getEnrollmentsByLevelYear` is deleted.** Nothing may read a roster without a campus.
- **ADR-0005 is amended** on the one point of what a Class is; its method (same-difficulty
  comparison, finality gate, tie rules) is unchanged.
