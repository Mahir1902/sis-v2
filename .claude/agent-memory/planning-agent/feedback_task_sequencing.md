---
name: Mandatory agent sequencing for every feature
description: The required order of agents for any feature: backend → backend review → frontend → frontend review → build check
type: feedback
---

Every feature in SIS v2 must follow this exact agent sequence, with no skipping:

1. PLANNING AGENT — read TASK_LOG.md, write plan
2. BACKEND AGENT — write Convex schema/query/mutation changes
3. BACKEND REVIEW AGENT — approve or reject; frontend is blocked until approved
4. FRONTEND AGENT — write Next.js page/component changes
5. FRONTEND REVIEW AGENT — approve or reject; feature is blocked until approved
6. CODING AGENT — run `npm run build` + `npm run lint`; mark feature complete

**Why:** The Phases 1–5 audit found that all code was written without review gates, requiring a full re-audit in April 2026. The review gates exist to catch issues before they compound.

**How to apply:** Even for single-file backend changes (like adding validation to a mutation), the backend review step is still required before frontend work begins.
