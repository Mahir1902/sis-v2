---
name: students-schema-widened-for-import
description: Since issue #93, nearly every students field is optional — code reading a student doc must guard, and must never fill an absent field with a placeholder
metadata:
  type: project
---

The `students` table was widened for the Excel import (issue #93, map #80). Only
`studentNumber`, `standardLevel`, `academicYear` and `createdAt` are still required —
the other 29 named fields are `v.optional`. `enrollments.campus` was widened too.

**Why:** the school's spreadsheet has no column for roughly half the app's fields, and the
map's standing decision (D5/D6) forbids inventing values to satisfy the schema. Widening
required → optional is backward-compatible, so it shipped as one clean deploy with no
`@convex-dev/migrations` widen-migrate-narrow cycle. Accepted as a one-way door: once the
importer writes students with `fatherName` unset, narrowing back is a real migration.

**How to apply:** any new code touching a student doc must guard the optional fields.
The house rule is *degrade honestly, never substitute*: em-dash, "Not recorded", omit the
element, or refuse the operation. Specifically forbidden as fixes: `"Unknown"`, `"active"`,
`Date.now()`, or a `?? ""` that ends up being written back to the DB.

Where this bites hardest, and the precedents already set:
- Financial/legal writes **refuse** rather than snapshot a stand-in — `collectFees` throws
  when `studentFullName` or `primaryBillingContact` is unset (a receipt freezes the payer
  name forever).
- Name searches use `s.studentFullName?.toLowerCase().includes(q) ?? false` — an unnamed
  student never matches a *name* query but stays findable by student number.
- `healthIssue` absent must never render "No issues" — that is a positive medical claim.
- Form pre-fills leave the value genuinely unset so the Zod schema blocks the save, rather
  than pre-filling a default the admin might submit without noticing.

`lib/validations/` was deliberately NOT weakened — the manual admission form keeps its own
strict contract and still requires every field. Do not loosen it to match the DB.

See [[reference-widening-blast-radius-method]] for how to size a change like this.
