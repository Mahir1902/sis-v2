---
name: Convex query nullable array filtering pattern
description: Approved pattern for filtering null entries from Convex query results that return (T | null)[]
type: project
---

When a Convex query returns `(T | null)[]` (e.g. from `Promise.all` with possible null entries), the approved pattern in this codebase is to declare a typed `isNonNull<T>` guard and use `.filter(isNonNull)` at the call site.

```ts
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}
```

**Why:** `filter(Boolean)` narrows to `NonNullable<T>` in some TS versions but is less explicit and can break if T includes falsy values. The named guard is self-documenting and consistently typed.

**How to apply:** Accept this pattern in review without flagging. Do not suggest replacing with `filter(Boolean)` or inline arrow functions.
