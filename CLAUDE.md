# CLAUDE.md — School Information System v2

## PROJECT OVERVIEW

Rebuilding a School Information System (SIS) for a real school from the ground up.
The v1 codebase exists at `../sis-school-management/` as a reference, but this is a
clean rewrite with better architecture, security, and maintainability.

**Goal**: Recreate all existing SIS v1 functionality with proper structure, then extend it
with role-based access control (admin, teacher, student).

---

## SKILL INSTALLATION (RUN FIRST)

Before writing any code, install all required skills:
```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/shadcn/ui --skill shadcn
npx skills add https://github.com/get-convex/agent-skills --skill convex-quickstart
npx skills add https://github.com/get-convex/agent-skills --skill convex-setup-auth
npx skills add https://github.com/waynesutton/convexskills --skill convex
npx skills add https://github.com/get-convex/agent-skills --skill convex-migration-helper
npx skills add https://github.com/get-convex/agent-skills --skill convex-create-component
npx skills add https://github.com/get-convex/agent-skills --skill convex-performance-audit
npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
npx skills add https://github.com/obra/superpowers --skill writing-plans
```

Read the relevant SKILL.md files before starting any task.

---

## DEV COMMANDS

```bash
npm run dev        # Next.js with Turbopack (built-in, no --turbopack flag needed)
npx convex dev     # Convex backend — run in parallel with dev
npm run build      # Must pass before any feature is marked complete
npm run lint       # Must pass before any feature is marked complete
```

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15+ (App Router, latest stable) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui latest — `npx shadcn@latest add` |
| Backend/DB | Convex (deployment: hushed-bass-123.convex.cloud) |
| Auth | `@convex-dev/auth` (email/password) |
| Forms | React Hook Form + Zod |
| Type Safety | TypeScript strict mode throughout |
| UI State | Zustand only — no Redux |
| Server State | Convex reactive queries (`useQuery`) |
| Tables | TanStack Table v8 |
| Charts | Recharts v3 |
| Notifications | Sonner |

**Note on tRPC**: Convex provides end-to-end type safety natively through its generated
API types. tRPC is NOT needed and must NOT be added.

---

## BRAND / DESIGN TOKENS

- `school-green`: `#018737`
- `school-yellow`: `#F88B0E`

Defined in `app/globals.css` inside `@theme {}` — **no tailwind.config.ts**.
```css
@theme {
  --color-school-green: #018737;
  --color-school-yellow: #F88B0E;
}
```
Use as: `bg-school-green`, `text-school-yellow`, `border-school-green`, etc.
White backgrounds throughout. Gray for secondary text.

## Tailwind v4 Rules
- **No `tailwind.config.ts`** — Tailwind v4 is CSS-first
- `postcss.config.mjs` uses `@tailwindcss/postcss`
- Never add a `tailwind.config.ts` file

## shadcn/ui
- Style: **New York** — selected during `npx shadcn@latest init`
- Add components: `npx shadcn@latest add [component-name]`
- Config file: `components.json`
- Always use shadcn primitives as base — never build raw UI for things shadcn covers

---

## AGENT SYSTEM

Declare your active agent role at the start of **every response**.
Never skip the review step. Update `TASK_LOG.md` before and after every action.
Sub-tasks are only marked complete when the relevant review agent explicitly approves.

---

### 🗂️ PLANNING AGENT
**Responsibilities:**
- Reads the feature request and `TASK_LOG.md` to understand current state
- Breaks features into atomic, testable sub-tasks
- Writes the updated task plan to `TASK_LOG.md`
- Identifies which agents are needed and in what order
- Skills: `writing-plans`, `find-skills`

**Never writes application code.**

---

### 😈 DEVIL'S ADVOCATE AGENT
**Responsibilities:**
- Invoked by the PLANNING AGENT before any implementation begins
- Challenges every assumption in the plan — asks "what could go wrong?"
- Identifies edge cases, missing requirements, security gaps, and over-engineering
- Questions whether the chosen approach is the simplest that will work
- Probes the data model for inconsistencies before schema is written
- Writes findings to `TASK_LOG.md` under "Devil's Advocate Review"
- Does NOT block progress — flags concerns and proposes mitigations

**Mandatory triggers — the Devil's Advocate Agent MUST be invoked before:**
- Any new database table or schema change
- Any auth or permission logic
- Any fee calculation or financial logic
- Any multi-step form or workflow
- Any new page or major component

**Questions this agent always asks:**
1. What happens if the user submits this form twice?
2. What is the worst-case DB query cost for this at 10,000 records?
3. Which role should NOT be able to see this data — and is that enforced server-side?
4. What happens if a referenced document is deleted?
5. Is there a simpler data model that achieves the same result?
6. What does the UI look like in the error state / empty state / loading state?
7. Are we solving a real problem or a hypothetical one?

**Never writes application code.** Writes concerns and mitigations only.

---

### ⚙️ BACKEND AGENT
**Responsibilities:**
- All Convex schema changes (`convex/schema.ts`)
- All Convex queries, mutations, and actions
- Auth configuration and role setup
- Data validation logic inside Convex functions
- Index optimisation and query efficiency
- Skills: `convex`, `convex-quickstart`, `convex-setup-auth`,
  `convex-migration-helper`, `convex-create-component`, `convex-performance-audit`

**Rules:**
- Always validate that indexes exist before querying with `withIndex`
- Never expose sensitive data to roles that shouldn't see it
- Every mutation must validate input and check permissions via `requireRole()`
- Use `.take(100)` + pagination — never unbounded `.collect()` on large tables
- Batch lookups with `Promise.all()` — no sequential awaits in loops (N+1)
- Document every function with a JSDoc comment
- Error messages must not leak internal schema or state

---

### 🔍 BACKEND REVIEW AGENT
**Responsibilities:**
- Reviews all Convex code written by the Backend Agent
- Checks: type safety, index usage, permission checks, input validation,
  error handling, no N+1 patterns, no unbounded collects
- Runs through the `convex-performance-audit` skill checklist
- Approves or returns with **specific** required changes (never vague feedback)
- Writes review result to `TASK_LOG.md`

**Code cannot proceed until this agent approves.**

**Checklist (must verify all before approving):**
- [ ] Auth check at the top of every mutation
- [ ] `requireRole()` called with correct role list
- [ ] No raw user input inserted without validation
- [ ] Sensitive fields (NID, financial) gated to admin only
- [ ] Storage uploads validated (file type, size limits)
- [ ] No function exposes another student's data to non-admin
- [ ] Error messages don't reveal schema or internal state
- [ ] Indexes present for all query patterns used
- [ ] No unbounded `.collect()` calls
- [ ] No N+1 query patterns

---

### 🎨 FRONTEND AGENT
**Responsibilities:**
- All Next.js page and layout components
- All React components under `components/` and `app/`
- shadcn/ui component usage and customisation
- Form building with React Hook Form + Zod
- Responsive design with Tailwind CSS v4
- Client-side state with Zustand
- Skills: `frontend-design`, `shadcn`, `vercel-react-best-practices`, `next-best-practices`

**Rules:**
- Every data-fetching component must handle: loading skeleton, empty state with CTA, error state
- Forms use React Hook Form + Zod — never `useState` for form fields
- No TypeScript `any` — use types from `convex/_generated/dataModel`
- Mobile-first — design for mobile, then scale up
- Colors use CSS variables from theme, never hardcoded hex values
- No business logic in components — extract to custom hooks in `/hooks`
- Toast notifications (Sonner) for all mutation success/error states
- Read `frontend-design` SKILL.md before building any new UI

---

### 🔍 FRONTEND REVIEW AGENT
**Responsibilities:**
- Reviews all frontend code written by the Frontend Agent
- Checks: accessibility, loading/empty/error states, mobile responsiveness,
  no hardcoded values, proper TypeScript types, no `any`, clean component structure
- Approves or returns with specific required changes
- Writes review result to `TASK_LOG.md`

**Code cannot proceed until this agent approves.**

**Checklist (must verify all before approving):**
- [ ] Loading skeleton rendered during data fetch
- [ ] Empty state with CTA when list/table is empty
- [ ] Error state handled (not just `if (!data) return null`)
- [ ] No TypeScript `any`
- [ ] No hardcoded color values — Tailwind classes only
- [ ] Interactive elements have aria labels
- [ ] Renders correctly on mobile (375px width)
- [ ] No business logic inside component bodies
- [ ] Sonner toast on mutation success and error
- [ ] Form validation errors display inline

---

### ✅ CODING AGENT
**Responsibilities:**
- Executes sub-tasks from `TASK_LOG.md` one at a time
- Invokes PLANNING AGENT → DEVIL'S ADVOCATE AGENT → relevant implementation agents → review agents, in that order
- Marks sub-tasks complete in `TASK_LOG.md` only after both review agents approve
- Runs `npm run build` and `npm run lint` after each sub-task completes
- Never skips the review step, even for small changes

**The Coding Agent orchestrates — it delegates, never codes directly.**

---

## TASK LOG SYSTEM

`TASK_LOG.md` must exist at the project root at all times.
It is the single source of truth for what has been built and what remains.

### Format
```markdown
# SIS v2 Task Log

## Current Feature: [Feature Name]
**Status**: [Planning | Devil's Advocate Review | In Progress | Review | Complete]
**Active Agent**: [Agent Name]

### Devil's Advocate Findings
- Concern: [description] → Mitigation: [description]

### Sub-tasks
- [x] 1. Task description — APPROVED by Backend Review Agent (date)
- [x] 2. Task description — APPROVED by Frontend Review Agent (date)
- [ ] 3. Task description — IN PROGRESS
- [ ] 4. Task description — PENDING

### Review Notes
**Backend Review (task 1):** [notes]
**Frontend Review (task 2):** [notes]

---

## Completed Features
- [x] Project scaffold and base config

## Decisions Made
- [date] Chose X over Y because Z

## Remaining Features (in priority order)
1. ...
```

**Rules:**
- Update `TASK_LOG.md` at the start and end of every agent action
- A sub-task is only marked `[x]` when the review agent has explicitly approved it
- Never delete completed entries — they are the project history

---

## PROJECT STRUCTURE

```
sis-v2/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Role-aware sidebar + ConvexAuthNextjsProvider
│   │   ├── students/
│   │   │   ├── page.tsx
│   │   │   ├── columns.tsx
│   │   │   ├── _components/
│   │   │   └── [studentId]/
│   │   │       ├── page.tsx
│   │   │       └── _components/
│   │   ├── fees/
│   │   ├── student-fees/
│   │   └── admin/
│   │       └── assessments/
│   ├── globals.css                 ← Tailwind v4 @import + @theme block
│   └── layout.tsx                  ← ConvexAuthNextjsServerProvider + Toaster
├── components/
│   ├── ui/                         ← shadcn primitives (auto-generated)
│   ├── layout/                     ← Sidebar, DashboardWrapper
│   ├── forms/                      ← Form components
│   ├── data-table/                 ← TanStack table wrappers
│   └── shared/                     ← Shared business components
├── convex/
│   ├── auth.ts
│   ├── auth.config.ts
│   ├── http.ts
│   ├── schema.ts
│   ├── seed.ts
│   ├── lib/
│   │   └── permissions.ts          ← requireRole() helper
│   └── *.ts                        ← one file per domain
├── hooks/                          ← Custom React hooks (no business logic in components)
├── lib/
│   ├── utils.ts                    ← cn() and helpers
│   ├── gradeUtils.ts
│   └── validations/                ← Zod schemas, one file per domain
├── types/                          ← Shared TypeScript types
├── middleware.ts                   ← Auth + route protection
├── TASK_LOG.md
└── CLAUDE.md
```

---

## AUTHENTICATION & ROLES

### Setup
- `ConvexAuthNextjsServerProvider` in `app/layout.tsx` — **server component, no `"use client"`**
- `ConvexAuthNextjsProvider` in `app/(dashboard)/layout.tsx` — client component wrapper
- Route protection via `middleware.ts` at project root

### Role System
```typescript
// convex/schema.ts
users: defineTable({
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("teacher"), v.literal("student")),
  isActive: v.boolean(),
})
.index("by_email", ["email"])
```

### Permission Matrix
| Feature | Admin | Teacher | Student |
|---------|-------|---------|---------|
| Create/edit students | ✅ | ❌ | ❌ |
| View all students | ✅ | ✅ | ❌ (own only) |
| Enter grades | ✅ | ✅ (own classes) | ❌ |
| View grades | ✅ | ✅ | ✅ (own only) |
| Manage fees | ✅ | ❌ | ❌ |
| View own fees | ✅ | ❌ | ✅ |
| Manage fee structures | ✅ | ❌ | ❌ |
| Upload report cards | ✅ | ✅ | ❌ |

### requireRole() Helper
```typescript
// convex/lib/permissions.ts
export async function requireRole(
  ctx: MutationCtx | QueryCtx,
  allowedRoles: ("admin" | "teacher" | "student")[]
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", q => q.eq("email", identity.email!))
    .first();
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}
```

**Every Convex mutation calls `requireRole()` as the first thing in its handler.**

---

## CONVEX BACKEND RULES

The Backend Review Agent will reject code that violates any of these:

1. **No unbounded collects.** Use `.take(n)` + pagination on large tables.
2. **All `withIndex` calls must have the index declared in `schema.ts`.**
3. **Every mutation validates permissions** via `requireRole()`.
4. **Input validation** happens explicitly in the handler, not just via Convex types.
5. **No N+1 queries.** Use `Promise.all()` for batched lookups.
6. **Error messages** must not reveal schema, table names, or internal state.
7. **Sensitive fields** (NID numbers, financial data) returned only to admin callers.
8. **`percentage` and `letterGrade` always computed server-side** — never trust from client.
9. **Storage IDs resolved to URLs** inside query handlers via `ctx.storage.getUrl()`.
10. **Real-time subscriptions** (`useQuery`) preferred over polling.

---

## FRONTEND RULES

The Frontend Review Agent will reject code that violates any of these:

1. **Use shadcn primitives** for all UI elements shadcn covers.
2. **Every data-fetching component** handles: loading skeleton, empty state, error state.
3. **Forms use React Hook Form + Zod** — never `useState` for form fields.
4. **No TypeScript `any`** — use types from `convex/_generated/dataModel`.
5. **Mobile-first** — design for 375px, then scale up.
6. **Colors via Tailwind classes** — no hardcoded hex or rgba values.
7. **Route + role protection** enforced at middleware AND within page components.
8. **Toast notifications** (Sonner) for all mutation success and error outcomes.
9. **No business logic in component bodies** — extract to hooks in `/hooks`.
10. **Accessibility** — every interactive element has proper aria labels.

---

## GRADE SYSTEM

Uses the **full CA-1/2/3 assessment system** (not simple per-subject marks):

| Table | Purpose |
|-------|---------|
| `assessments` | CA-1, CA-2, CA-3 definitions per subject/level/year/semester |
| `assessmentQuestions` | Questions per assessment with marks allocated |
| `studentAssessmentAnswers` | Marks per student per question |
| `assessmentWeightingRules` | Configurable CA-1/2/3 weights (default: 1/3 each) |
| `computedGrades` | Aggregated weighted grade per student/subject/semester |

**Formula:** `weightedAvg = (ca1% × ca1Weight) + (ca2% × ca2Weight) + (ca3% × ca3Weight)`

Letter grade calculation (always server-side):
```ts
if (pct >= 90) return "A+";
if (pct >= 80) return "A";
if (pct >= 70) return "B";
if (pct >= 60) return "C";
if (pct >= 50) return "D";
return "F";
```

---

## FILE UPLOAD PATTERN

```ts
// 1. Generate upload URL (mutation)
const uploadUrl = await generateStudentPhotoUrl();
// 2. POST file with native fetch — no axios
const res = await fetch(uploadUrl, {
  method: "POST",
  body: file,
  headers: { "Content-Type": file.type },
});
const { storageId } = await res.json();
// 3. Pass storageId to createStudent mutation
```

File constraints:
- Student/family photos: max 4MB, images only
- Report card PDFs: max 5MB, `application/pdf` only

---

## SCHEMA IMPROVEMENTS OVER V1

Apply these corrections — they were bugs in v1:

1. **`feeType` must be lowercase literals** — v1 mixed `"Admission"` and `"admission"`. Always lowercase.
2. **`students.status` is a union literal type**, not `v.string()`.
3. **`standardLevels` names must exactly match seed data** — v1 had name inconsistencies that broke lookups.
4. **Add a `staff` table** if `promotionDetails.approvedBy` references `v.id("staff")`.
5. **`gradeMapping` seeded on first deploy** — never manually created.
6. **`feeTransactions.academicYear` is `v.id("academicYears")`**, not a plain string.
7. **Indexes must exist** for every field used with `withIndex`.
8. **Sibling linking is bidirectional** — when A lists B as sibling, patch B's `siblingIds` too.
9. **Current enrollment detected via `exitDate === undefined`**, not `status === "active"`.
10. **Report card uniqueness enforced** — check before insert: one per `enrollmentId + semester`.

---

## NAMING CONVENTIONS

| Thing | Convention | Example |
|-------|-----------|---------|
| Convex query | camelCase verb | `getStudentById` |
| Convex mutation | camelCase verb | `createStudent`, `updateStudentStatus` |
| React component | PascalCase | `StudentAdmissionForm` |
| Hook | `use` prefix + camelCase | `useStudentFilters` |
| Zod schema | camelCase + `Schema` | `studentAdmissionSchema` |
| Zod inferred type | PascalCase + `Values` | `StudentAdmissionValues` |
| Route segment | kebab-case | `/students/[studentId]/academic-history` |
| Convex table | camelCase plural | `students`, `enrollments`, `feeStructures` |

---

## STATUS BADGE COLORS

```ts
const statusStyles = {
  active:      "bg-green-400/40 text-green-700",
  graduated:   "bg-purple-400/40 text-purple-700",
  transferred: "bg-yellow-400/40 text-yellow-700",
  withdrawn:   "bg-gray-400/40 text-gray-700",
  suspended:   "bg-orange-400/40 text-orange-700",
  expelled:    "bg-red-400/40 text-red-700",
}
```

---

## STANDARD LEVEL CODES (must match DB exactly)

| Name | Code |
|------|------|
| Play Group | PG |
| Nursery | NUR |
| KG-1 | KG1 |
| KG-2 | KG2 |
| Grade 1–12 | 01–12 |

---

## FEATURE PRIORITY (build in this exact order)

Do not start the next phase until the current is approved and logged complete.

### Phase 1 — Foundation
1. Project scaffold (Next.js, Tailwind v4, shadcn New York)
2. Convex project setup and schema
3. Convex Auth setup (email/password, roles)
4. `middleware.ts` route protection
5. Dashboard shell (sidebar, navbar, role-aware navigation)

### Phase 2 — Core Student Management
6. Standard levels, academic years, campus setup screens
7. Student admission form (3-step: student info → family → fees)
8. Students list page (DataTable with search + filters)
9. Student detail page (5 tabs: Overview, Fees, Academic History, Grades, Report Cards)
10. Student status management

### Phase 3 — Academic Management
11. Subjects management
12. Assessment creation (CA-1/2/3 per subject/level/semester)
13. Grade entry (marks per student per question per assessment)
14. Computed grades + academic history tab
15. Report card upload and management

### Phase 4 — Fee Management
16. Fee structure management (per standard level)
17. Student fee assignment on admission
18. Fee collection + payment recording
19. Discount rules and application

### Phase 5 — Roles & Access Control
20. Teacher accounts — grade entry for assigned classes only
21. Student accounts — view own profile, grades, fees
22. Admin settings — user management, role assignment

---

## STARTING INSTRUCTIONS

When you first read this file, do the following in order:

1. Install all skills listed above
2. Switch to **PLANNING AGENT** — create `TASK_LOG.md` with Phase 1 sub-tasks
3. Switch to **DEVIL'S ADVOCATE AGENT** — challenge the Phase 1 plan, log findings
4. Switch to **BACKEND AGENT** — read `convex-quickstart` SKILL.md, then scaffold:
   ```bash
   npx create-next-app@latest sis-v2 --typescript --tailwind --app
   # Copy .env.local from ../sis-school-management/.env.local
   npx convex dev
   npx shadcn@latest init   # New York style, CSS variables on, Tailwind v4
   ```
5. Work through `TASK_LOG.md` sub-tasks one at a time
6. **Never move to the next sub-task** without the review agent approving the current one

When in doubt about a design decision, prefer the simpler approach and log it
under "Decisions Made" in `TASK_LOG.md`.

---

## KEY FILES

| File | Purpose |
|------|---------|
| `convex/schema.ts` | All database table definitions |
| `convex/lib/permissions.ts` | `requireRole()` helper |
| `convex/seed.ts` | Seed data (academic years, levels, grade mapping) |
| `lib/gradeUtils.ts` | `getLetterGradeBadgeColor`, `getTrendIndicator`, `formatPercentage` |
| `lib/validations/` | Zod schemas, one file per domain |
| `hooks/use-sidebar.ts` | Zustand sidebar state |
| `middleware.ts` | Auth route protection |
| `TASK_LOG.md` | Live task tracking — always up to date |

---

*This file is the contract between you and the project.
If something is unclear, update this file before proceeding.*
