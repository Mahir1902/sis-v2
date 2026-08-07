---
name: convex-tsc-stricter-than-root-tsc
description: Root `npx tsc --noEmit` skips convex/ files; only `npx convex dev/codegen` typechecks them (and is stricter)
metadata:
  type: reference
---

Running `npx tsc --noEmit` at the repo root can PASS while a `convex/*.ts` file has a type
error. Convex functions are typechecked separately by `npx convex dev` / `npx convex codegen`
using Convex's own tsc invocation, which is stricter about generated-table union types.

Concrete case (2026-07-03): a `doc as { name: string }` cast on a value whose type was a
union over all table-document shapes was accepted by root tsc but rejected by Convex tsc with
TS2352 ("neither type sufficiently overlaps"). The push silently failed, so the function
never registered and `npx convex run` returned "Could not find function ...". Fix was to drop
the cast (all four reference tables carry `name: string`, so `r.name` is directly valid).

**How to apply:** After editing anything under `convex/`, verify it compiles by running
`npx convex dev --once` (or `npx convex codegen`) — do NOT rely on root `npx tsc --noEmit`
alone. If `npx convex run <fn>` reports "Could not find function", suspect a failed push from
a Convex-tsc error, not a missing-file problem.

When deploying is undesirable (shared checkout, another agent mid-edit on `convex/schema.ts`,
or a coordinator owns the build), `npx tsc --noEmit -p convex/tsconfig.json` typechecks the
`convex/` tree locally without pushing anything. Confirmed working 2026-08-07.

Also: a background `npx convex dev` watcher races with the one-shot deploy that `npx convex
run` triggers. When a fresh function won't register, kill the background watcher, run
`npx convex dev --once` to push cleanly, then run the function, then restart the watcher.
