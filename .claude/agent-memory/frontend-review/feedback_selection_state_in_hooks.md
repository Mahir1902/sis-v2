---
name: Row-selection state management belongs in a custom hook
description: UI row-selection state (ref-based Set, version counter, toggle handlers, value-aggregation useMemo) must be extracted to /hooks, not implemented inline in the page component body
type: feedback
---

Multi-row selection state in a table page qualifies as logic that must be extracted to a custom hook per CLAUDE.md rule 9. Even though the Set itself holds UI state (not Convex data), the `selectionTotalValue` useMemo derives from the query result (`rows`) — that derivation from query data makes it a blocking issue exactly like `filteredLogs` on the audit-log page.

The typical pattern to extract: `selectedIdsRef`, `selectionVersion`, `bumpSelection`, `handleToggleRow`, `handleToggleAllVisible`, `handleClearSelection`, and `selectionTotalValue` → `hooks/use-invoice-selection.ts` (or equivalent per-domain hook).

**Why:** Same rule as filter-logic-in-hooks: useMemo that depends on query data is business logic, not display logic. The Invoice page (Issue #28) was rejected for this reason; the hook to create is `use-invoice-selection.ts`.

**How to apply:** Any page that manages multi-row selection alongside Convex-query rows should use a dedicated selection hook. Flag as blocking (red) when the selectionTotalValue or equivalent aggregation is inside the component body as a useMemo over query data.
