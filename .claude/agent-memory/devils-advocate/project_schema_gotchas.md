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

---

**`computedGrades` optional CA fields are NOT cleared by `db.patch` with `undefined` values.**
Convex's serialiser drops `undefined` keys from patch objects (same as `JSON.stringify`), so a `db.patch(id, { ca2Percentage: undefined })` call leaves the old `ca2Percentage` value in place. This means when a CA transitions from "present" to "unmarked" (student's answer rows are deleted or never entered), the stale `ca2*` fields survive in the stored row. The only safe approach is `db.replace(id, fullGradeObject)` on the update path — `db.replace` writes the document wholesale so missing optional fields are removed. This affects `recomputeGrade` and any future mutation that patches a `computedGrades` row.

**Why:** Confirmed during Phase A adversarial review (2026-07-01). The schema declares all CA fields as `v.optional(v.float64())`, so `db.replace` is schema-valid without the optional fields. `db.patch` is NOT safe here.

**How to apply:** Any time a mutation touches `computedGrades` on an existing row, flag `db.patch` as wrong and require `db.replace`.

---

**Dropping a table from `schema.ts` while rows exist in the DB does NOT fail `npx convex dev`.**
Confirmed for `assessmentWeightingRules` removal (Phase A, ADR-0004). Convex tolerates orphaned physical rows — it simply stops generating typed API access for the table. No data-delete step is required before removing the table definition. The orphaned rows become inaccessible via typed APIs and are eventually GC'd. All import sites must be removed in the same commit or TypeScript compilation will fail.

**How to apply:** When planning a table drop, the only blocking step is removing all TypeScript import/call sites. Orphaned DB rows are not a deploy blocker.
