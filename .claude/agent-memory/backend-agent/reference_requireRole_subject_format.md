---
name: requireRole subject parsing
description: requireRole reads JWT subject as "userId|sessionId" and does a direct ctx.db.get — not an email lookup
type: reference
---

`convex/lib/permissions.ts#requireRole` uses `identity.subject.split("|")[0]` to extract the users-table `_id` directly. No email lookup, no by_email index hit. This is the canonical pattern for the project.

```ts
const userId = identity.subject.split("|")[0] as Id<"users">;
const user = await ctx.db.get(userId);
```

**Why:** Convex Auth's JWT sub claim is shaped `userId|sessionId`. The earlier `.withIndex("by_email", q => q.eq("email", identity.email!))` pattern was abandoned because non-null-asserting `identity.email!` is fragile and the index hit is unnecessary.

**How to apply:** When writing new mutations, don't reinvent the auth lookup. Just call `requireRole(ctx, [...roles])` first thing in the handler. The returned `user` is the full `Doc<"users">`.
