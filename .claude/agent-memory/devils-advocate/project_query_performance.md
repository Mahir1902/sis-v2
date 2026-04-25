---
name: Query Performance Risks
description: Confirmed Convex query performance pitfalls specific to SIS v2 — critical for scale decisions
type: project
---

**The getAllStudents enrichment pattern costs 4 db reads per student (standardLevel, academicYear, campus, storage URL).**
At 2000 students with .take(2000), this is 8000 database reads in a single query execution. Convex's per-function read limit is not publicly documented but observed limits in practice are in the thousands. This plan hits that ceiling.

**Why:** Each student carries three foreign key IDs that must be resolved to names, plus an optional storage URL. The current Promise.all() pattern is the right approach (avoids N+1 sequential awaits), but it still fires 4 parallel reads per row.

**How to apply:** When reviewing any plan that loads all students at once, always calculate (num_students × 4) and flag if > 2000 total reads. Recommend the "lookup table pre-fetch" pattern instead: load all standardLevels, academicYears, and campuses once (3 reads total), then do in-memory joining with a Map.

---

**Convex's response payload size limit is ~8MB.**
A student record with all fields (NID numbers, addresses, health info, sibling arrays) is large. 2000 fully-enriched student records could approach or exceed this limit. The plan to drop pagination and use .take(2000) has not accounted for payload size.

**How to apply:** For any useQuery that loads all students, insist on a slimmed projection (only fields the table actually displays) rather than returning the full document.
