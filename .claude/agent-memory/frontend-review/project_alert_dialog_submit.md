---
name: AlertDialog submission pattern
description: Approved pattern for AlertDialog with async mutation — cancel must be disabled during submission
type: project
---

When an AlertDialog triggers an async mutation (e.g. bulk operations), the approved pattern is:
- `isSubmitting` state on the parent component
- `AlertDialogCancel disabled={isSubmitting}` — prevents accidental close mid-flight
- `AlertDialogAction onClick={handler} disabled={isSubmitting}` — the action is NOT a submit button inside a form; it fires the handler directly
- Show loading text inline: `{isSubmitting ? "Processing..." : "Confirm"}`

**Why:** Prevents double-submit on slow mutations and gives the user clear feedback that the operation is in flight.

**How to apply:** Any AlertDialog that wraps a mutation must follow this pattern. Flag missing `disabled={isSubmitting}` on Cancel as 🔴 REQUIRED in review.
