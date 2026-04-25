---
name: Schema Gotchas
description: Confirmed schema vulnerabilities and data model risks found during adversarial review of SIS v2
type: project
---

**Students table has zero indexes declared in schema.ts.**
Any query against students using .filter() performs a full table scan. At 500-2000 students with 4 enrichment lookups each, this creates 2000-8000 db reads per query invocation. Adding filters via server-side `.filter()` without indexes compounds the cost.

**Why:** The students table was built without indexes, likely because pagination was originally used (cursor-based paginate() doesn't require field indexes). Moving to useQuery + .filter() exposes this gap.

**How to apply:** Flag every proposed students query that uses .filter() as requiring an index audit first. Recommend adding indexes on `standardLevel`, `academicYear`, `status`, `gender` before shipping server-side filtering.

---

**`students.studentDiscounts.academicYear` is a plain string, not v.id("academicYears").**
The `studentDiscounts` table uses `academicYear: v.string()` rather than the proper FK. This is an existing inconsistency that could break joins. Same issue in `advancePayments`.

---

**`enrollments.campus` is a plain string, not v.id("campuses").**
The enrollments table stores campus as a string, not a reference ID. The students table correctly uses `v.id("campuses")`. This inconsistency will cause confusion in any cross-table enrollment queries.

---

**`students` table stores `createdAt` as an ISO string (`v.string()`), not a float64 timestamp.**
Every other date field in the schema uses `v.float64()` (Unix ms). This makes sorting by creation date inconsistent and fragile (lexicographic string sort would work only if ISO format is consistent).
