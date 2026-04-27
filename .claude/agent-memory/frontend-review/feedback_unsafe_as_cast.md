---
name: Unsafe "as" cast to silence null on Convex Id props
description: Frontend Agent uses "as Id<'table'>" to cast potentially-null state values before passing to component props, creating a type lie that TypeScript accepts at compile time but breaks semantics at runtime.
type: feedback
---

When a state variable is typed `Id<"table"> | null` and used as a prop typed `Id<"table">`, the Frontend Agent has used `createFor as Id<"standardLevels">` to silence the type error. This is a blocking issue: if the parent renders the child component unconditionally (even with `open={false}`), the prop receives a `null` value that the child's type signature says is impossible.

**Why:** Seen in `fees/page.tsx:126` — `standardLevelId={createFor as Id<"standardLevels">}` when `createFor` can be `null`. The dialog is conditionally opened via `open={!!createFor}`, but the component is always mounted, so `standardLevelId` receives `null` with a lie type on every render where no level is selected.

**How to apply:** Flag any `someNullableVar as Id<"table">` pattern when passing to a non-nullable prop. The correct fix is either: (a) conditional rendering — only mount the component when the value is non-null (`{createFor && <Dialog standardLevelId={createFor} />}`), or (b) provide a non-nullable fallback only when semantically safe.
