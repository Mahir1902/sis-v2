---
name: Approved hook extraction pattern for Convex data + display derivation
description: FunctionReturnType+NonNullable for Convex return types; discriminated union state from hooks; as-cast allowed when Convex schema union is structurally identical to shared type
type: project
---

For CLAUDE.md rule #9 (no business logic in component bodies), the approved pattern is:

1. **Hook lives in `/hooks/use-<name>.ts`** with `"use client"` directive.
2. **Convex return type resolved via** `NonNullable<FunctionReturnType<typeof api.domain.queryName>>` — this is idiomatic and keeps the hook in lockstep with the backend.
3. **Hook returns a discriminated union** `{ state: "loading" | "not-found" | "ready"; ... }` so the component exhausts all branches without null/undefined collision.
4. **`as InvoiceStatus` cast** (and similar re-aliasing casts) is acceptable when the Convex schema union is structurally identical to the shared type — no members are added or removed. Verify by reading `convex/schema.ts` before approving.
5. A second `as InvoiceStatus` cast in the component body is acceptable when the component needs `status` for a purpose the hook did not expose (e.g., `data-invoice-status` attribute, `statusBadgeClass`). Flag as non-blocking suggestion to add `status` to the hook's `ready` branch.

**Why:** Established in INV27 follow-up refactor (2026-06-01). `useQuery` in component bodies blocks AC #10 compliance.

**How to apply:** When reviewing any component that calls `useQuery` directly, require extraction to a custom hook using this pattern. The hook must handle loading/not-found/ready states itself.
