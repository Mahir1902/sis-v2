---
name: reference-widening-blast-radius-method
description: How to size a convex/schema.ts type change in this repo — dataModel.d.ts derives from schema.ts at the type level, so tsc is an exact checklist
metadata:
  type: reference
---

`convex/_generated/dataModel.d.ts` derives its types from `convex/schema.ts` **at the type
level** (`import schema from "../schema.js"`), so editing the schema and running `tsc`
reports the exact null-safety blast radius with no codegen step, no `convex dev`, no
grepping. Measure the baseline first — if it is 0 errors, every error after the edit is
caused by the edit.

Two projects must both be run; neither alone is sufficient:
- `npx tsc --noEmit` — root config, `exclude`s `convex/` from globbing but still checks
  convex files reachable through imports.
- `npx tsc --noEmit -p convex` — the Convex project's own stricter config.

Note this does **not** require pushing to a deployment, so it is safe in a shared checkout
where `npx convex dev` may be running for someone else.

Two categories the typechecker will NOT report, and that must be hunted by eye:
1. `as unknown as SomeHandWrittenType` casts at a component boundary — they disable
   checking entirely, and hand-written row types drift from the query that feeds them.
2. Values interpolated into template literals — `` `tel:${phone}` `` silently becomes
   `"tel:undefined"`, and `` `${name} ${number}` `` makes rows searchable by the literal
   word "undefined".
