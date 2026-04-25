---
name: Inline dialog vs extracted component decision
description: When to keep a dialog inline in a page file vs extracting it to a separate component file
type: feedback
---

Small dialogs (3 fields or fewer, used in exactly one page) should be written inline in the page file — not extracted to a separate component file.

**Why:** Extraction adds indirection and a new file to review without real benefit when the component is not reused. The codebase already follows this pattern in assessments/page.tsx (inline create dialog) and promotions/page.tsx (inline confirm AlertDialog).

**How to apply:** Check reuse first. If the dialog is used in more than one place, or has more than ~5 form fields, extract it. Otherwise keep it inline. Record the decision in the "Decisions Made" block of the relevant TASK_LOG.md section.
