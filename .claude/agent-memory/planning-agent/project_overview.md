---
name: SIS v2 Project Overview
description: High-level facts about the SIS v2 project that inform planning decisions
type: project
---

SIS v2 is a School Information System rebuild for a real school. Stack: Next.js 15+ (App Router), Convex backend, shadcn/ui New York style, Tailwind v4, React Hook Form + Zod, Sonner toasts.

Phases 1–5 were completed and audited by 2026-04-05. The project is now in an incremental feature addition phase, with each feature tracked under a named section in TASK_LOG.md.

**Why:** Clean rewrite of v1 with proper RBAC, schema correctness, and agent-reviewed code quality.

**How to apply:** When planning new features, do not re-scaffold anything — the foundation is solid. Focus plans on the domain layer only (schema, mutations, queries, page components). Always verify which shadcn components are already installed before flagging them as missing.
