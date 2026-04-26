---
name: Audit Log Feature
description: Architecture decisions and sub-task pattern for the audit log feature added 2026-04-26
type: project
---

The audit log feature adds a tamper-evident admin-only trail for all ~25+ mutations.

Key decisions:
- `logAudit` is a plain async function (not a Convex mutation) — called inside existing mutations so it runs in the same transaction at no extra network cost.
- `auditLogs` table has 3 indexes: `by_timestamp`, `by_entity` (composite: entityType+entityId), `by_user`.
- `metadata` is `v.any()` in schema but constrained to `Record<string, unknown>` in the TypeScript helper.
- `entityId` stored as `v.string()` (not `v.id()`) to support heterogeneous entity types.
- No cursor pagination in v1 — `.take(100)` on `getRecentLogs`.
- Instrumentation split into 3 backend sub-tasks by domain (students/enrollments, fees/discounts, assessments/grades/reports/users/promotions) so each is independently reviewable.

**Why:** The school admin needs an accountability trail for sensitive student and financial data. Every mutation already returns the acting user from `requireRole()`, making instrumentation low-overhead.

**How to apply:** When planning similar "cross-cutting write instrumentation" features (e.g., notifications, webhooks), use the same 3-group domain split pattern. Always confirm that `requireRole` exists in the target mutation before adding a call that depends on its return value.
