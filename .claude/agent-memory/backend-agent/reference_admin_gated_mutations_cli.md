---
name: admin-gated-mutations-not-runnable-from-cli
description: requireRole-gated mutations throw "Unauthenticated" under `npx convex run` — operator instructions must say dashboard "Act as user"
metadata:
  type: reference
---

`npx convex run <fn>` calls with **no auth identity**, so any function whose first line is
`requireRole(ctx, [...])` throws `Unauthenticated`. Ungated ops functions (e.g.
`seed:seedReferenceData`, the `_seed*` fixtures) run fine from the CLI — gated ones do not.

The working path for an ops/one-off admin mutation is the Convex dashboard function runner
with *Act as user*, supplying a subject of the form `"<usersTableId>|<anything>"` —
`requireRole` splits on `|` and does `ctx.db.get(userId)` (see
[[requireRole-subject-format]]).

**How to apply:** whenever a ticket requires an ops mutation to be admin-gated, do not write
runbook steps that say `npx convex run …` — they will fail for the operator. Either document
the dashboard route, or expose the mutation behind an admin UI action.
