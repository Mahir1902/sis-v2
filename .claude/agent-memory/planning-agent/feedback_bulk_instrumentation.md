---
name: Bulk mutation instrumentation pattern
description: How to plan sub-tasks when a feature requires touching many existing mutation files at once
type: feedback
---

When a feature requires instrumenting a large number of existing mutations (more than ~6), split the backend instrumentation into multiple sub-tasks grouped by domain rather than one large task.

Pattern used for audit log (2026-04-26):
- Group 1: students + enrollments (AL-3a)
- Group 2: fees + discounts (AL-3b)
- Group 3: assessments + grades + reports + users + promotions + academic years (AL-3c)

**Why:** A single "instrument all 25 mutations" task is too large to review atomically and creates a blast radius if something is wrong. Domain grouping keeps each sub-task reviewable in one session and lets the backend review agent give targeted feedback.

**How to apply:** Any time a cross-cutting backend change touches more than 6 files, split into 2–3 domain groups. Always note which files belong to each group explicitly in the task description so the Backend Agent does not have to re-derive this.
