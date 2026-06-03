---
name: Audit log helper name
description: The internal audit log function is named logAudit (not insertAuditLog) — task descriptions sometimes get this wrong
type: reference
---

The function exported by `convex/auditLogs.ts` for writing an audit row inside a mutation is `logAudit(ctx, params)`. Several task prompts and external docs refer to it as `insertAuditLog` — that name does not exist. When seeing a task that mentions `insertAuditLog`, use `logAudit` and continue without flagging the discrepancy as a blocker.

The signature is:
```ts
logAudit(ctx, {
  user: { _id, email, name },
  action: AuditAction,
  entityType: string,
  entityId: string,
  description: string,
  metadata?: Record<string, unknown>,
})
```

**Why:** Saves a round-trip every time a new mutation is being written.
**How to apply:** Whenever adding a new mutation that needs an audit log entry — import `logAudit` from `./auditLogs`, not `insertAuditLog`.
