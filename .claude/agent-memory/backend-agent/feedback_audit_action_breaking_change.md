---
name: Adding an AuditAction is a frontend-breaking change
description: Adding a literal to the AuditAction union forces an update to the audit-log page's badge style map — anticipate this before declaring a backend task done
type: feedback
---

When extending the `AuditAction` v.union in `convex/schema.ts` (and the matching `AuditAction` type in `convex/auditLogs.ts`), the build will fail until `app/(dashboard)/admin/audit-log/page.tsx` adds the new action to BOTH:

1. `ACTION_OPTIONS: { value: AuditAction; label: string }[]` — drives the filter dropdown.
2. `ACTION_BADGE_STYLES: Record<AuditAction, string>` — exhaustive-checked by TS.

**Why:** The page uses a `Record<AuditAction, string>` which TypeScript enforces exhaustively. Forgetting it breaks `npm run build` even though `lib/*` tests and lint all pass.

**How to apply:** Whenever a backend task adds a new AuditAction literal, also patch `audit-log/page.tsx` in the same change (or explicitly hand off to FRONTEND AGENT). Don't claim the backend task is "done" until the build passes.
