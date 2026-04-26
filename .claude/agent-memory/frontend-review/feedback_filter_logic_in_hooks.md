---
name: Filter logic must live in custom hooks, not useMemo in component bodies
description: CLAUDE.md rule 9 requires all business logic (including array filtering/derivation from query data) to be extracted to hooks in /hooks, not implemented inline as useMemo calls inside components
type: feedback
---

Filter logic — even when implemented via `useMemo` — is business logic and must be extracted to a custom hook in `/hooks`. This is a blocking (red) issue per CLAUDE.md rule 9: "No business logic in component bodies — extract to custom hooks in `/hooks`".

**Why:** The Frontend Agent repeatedly places filter/derivation logic as `useMemo` calls inside page components instead of extracting them. The AL-5 audit log page was rejected for this reason: `filteredLogs` and `entityTypeOptions` were both `useMemo` inside the component rather than in `hooks/use-audit-log-filters.ts` as the Agent Notes required.

**How to apply:** Any time a component body contains `useMemo` calls that filter, sort, or derive a dataset from query data, flag it as a required fix and ask the Frontend Agent to extract to a named hook in `/hooks/`. The hook should return the derived values and the setter functions for the filter state.
