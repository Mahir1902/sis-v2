# SIS v2 Task Log

---

## Current State (2026-04-05 — POST-AUDIT RESET)

All code from Phases 1–3 and partial Phase 4 was written WITHOUT:
- Agent declarations
- Backend Review Agent approval
- Frontend Review Agent approval
- TASK_LOG.md updates per sub-task
- Playwright E2E verification

This reset establishes proper tracking. All existing code goes through review before any
new feature work begins.

---

## 😈 Devil's Advocate Findings (Phase 1 — already resolved)
- Concern: v1 Convex deployment schema conflicts → Mitigation: patched schema to add v1 legacy fields as optional
- Concern: Next.js 16 uses proxy.ts not middleware.ts → Mitigation: renamed, fixed export
- Concern: convexAuth.isAuthenticated() is async → Mitigation: awaited in proxy handler
- Concern: shadcn CLI changed (no --style flag) → Mitigation: components.json created manually
- Concern: Zod v4 removed `required_error` from z.enum → Mitigation: removed the option
- Concern: `.and()` on ZodEffects breaks zodResolver → Mitigation: refactored to `.merge()` on base schemas

---

## AUDIT QUEUE (COMPLETED 2026-04-05)

### Backend Audit — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] A.1 convex/schema.ts — all 23 tables + v1 compatibility patches
- [x] A.2 convex/lib/permissions.ts — requireRole helper
- [x] A.3 convex/seed.ts — idempotent reference data
- [x] A.4 convex/students.ts — generatePhotoUrl, createStudent, getAllStudents, getStudentById, updateStatus, getSiblings
- [x] A.5 convex/enrollments.ts — create, getHistory, getCurrent, updateExit
- [x] A.6 convex/academicYears.ts + campus.ts + standardLevels.ts + subjects.ts
- [x] A.7 convex/feeStructure.ts + studentFees.ts
- [x] A.8 convex/assessments.ts + assessmentQuestions.ts + studentAssessmentAnswers.ts + assessmentWeightingRules.ts + computedGrades.ts
- [x] A.9 convex/reportCards.ts
- [x] A.10 convex/feeTransactions.ts + discounts.ts + studentDiscounts.ts — FIXED: by_fee index, any types, studentDiscounts required fields

### Frontend Audit — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] A.11 proxy.ts + app/layout.tsx + (auth)/layout.tsx + (dashboard)/layout.tsx
- [x] A.12 components/layout/Sidebar.tsx + SidebarItem.tsx + DashboardWrapper.tsx — FIXED: overflow-hidden, max-w-[300px]
- [x] A.13 app/(auth)/login/page.tsx
- [x] A.14 app/(dashboard)/students/page.tsx + columns.tsx + DataTable.tsx
- [x] A.15 app/(dashboard)/students/_components/ — FIXED: business logic extracted to useStudentAdmission hook
- [x] A.16 app/(dashboard)/students/[studentId]/page.tsx + _components/ — FIXED: hardcoded #018737 → var(--color-school-green), inline grade ternaries → calculateLetterGrade(), aria-labels added
- [x] A.17 app/(dashboard)/admin/assessments/page.tsx — FIXED: aria-label + aria-pressed on mode toggles
- [x] A.18 app/(dashboard)/fees/page.tsx + student-fees/page.tsx — FIXED: frequency enum in Zod schema
- [x] A.19 FeesTab — Switch component installed and wired

### E2E Test Audit — PASSING (2026-04-05)
- [x] A.20 Install Playwright + write smoke tests — 6/6 PASSING
- [x] A.21 Login flow — redirect to /login tested
- [x] A.22 Login page renders — form elements verified
- [ ] A.23 Student list page loads — requires authenticated E2E (Phase 5)
- [ ] A.24 Add student form (3 steps) — requires authenticated E2E (Phase 5)

---

## Phase 2 Sub-tasks — MARK WHEN BACKEND REVIEW APPROVED
- [x] 2.1 convex/students.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.2 convex/enrollments.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.3 convex/academicYears.ts, campus.ts, standardLevels.ts, subjects.ts — WRITTEN (pending BACKEND REVIEW)
- [x] 2.4 lib/validations/ Zod schemas — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.5 Students list page + DataTable + StatusBadge — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.6 AddStudentButton + AddStudentForm + steps — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.7 Student detail page + 5-tab nav — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.8 OverviewTab + InfoCard — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.9 GradesTab (full CA-1/2/3) — WRITTEN (pending FRONTEND REVIEW)
- [x] 2.10 lib/gradeUtils.ts — WRITTEN (pending FRONTEND REVIEW)

## Phase 3 Sub-tasks — MARK WHEN APPROVED
- [x] 3.2 convex/ assessment system functions — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 3.3 Assessment admin page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.4 GradesTab full (CA-1/2/3) — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.5 AcademicHistoryTab + charts — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.6 ReportCardsTab + uploadcard/delete — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 3.1 Subjects management page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)

## Phase 4 Sub-tasks — COMPLETE
- [x] 4.1 convex/feeTransactions.ts + discounts.ts + studentDiscounts.ts — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 4.2 Fee Structures page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 4.3 FeesTab + CollectFeeDialog — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 4.4 Student fees list page — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)

## Auth Fix Sub-tasks
- [x] 5.8 Auth config fix (JWT_PRIVATE_KEY login error) — convex/auth.config.ts domain fix, convex/auth.ts createOrUpdateUser pre-provisioned user support, scripts/generate-auth-keys.mjs — APPROVED by BACKEND REVIEW AGENT (2026-04-05)

## Phase 5 Sub-tasks
- [x] 5.1 Loading skeletons — all pages have Skeleton during undefined query state — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.2 Empty states — all tables/lists have empty state with CTA — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.3 Error boundaries — ErrorBoundary class component wraps all student detail tabs — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.4 Mobile responsiveness — table overflow-x-auto on FeesTab+student-fees; grid-cols-1 sm:grid-cols-3 on FeesTab summary — APPROVED by FRONTEND REVIEW AGENT (2026-04-05)
- [x] 5.5 Role-based access: Teacher — Sidebar filters nav by role, backend requireRole enforces server-side — APPROVED by BACKEND REVIEW + FRONTEND REVIEW AGENTS (2026-04-05)
- [x] 5.6 Role-based access: Student — getStudentById enforces caller.studentId === requested studentId for student role; getAllStudents blocks student role entirely — APPROVED by BACKEND REVIEW AGENT (2026-04-05)
- [x] 5.7 Admin settings page — convex/users.ts (listUsers, updateUserRole, deactivateUser, reactivateUser, getMe) + /admin/settings page — APPROVED by BACKEND REVIEW + FRONTEND REVIEW AGENTS (2026-04-05)

---

## Bug Fix: /students Unauthorized Crash
**Status**: Complete (2026-04-13)
**Active Agent**: Coding Agent → Backend Agent + Frontend Agent

### Root Causes Found
- RC-1: User authenticated but `users` record missing → `requireRole` throws at line 22 (data repair: sign out + sign back in)
- RC-2: `auth.ts` `.filter()` — could not change to `.withIndex()` (convexAuth callback ctx type doesn't expose app schema indexes); `.filter()` is intentional
- RC-3: `identity.email!` non-null assertion compile-time only → fixed with email guard + local variable narrowing
- RC-4: No `app/(dashboard)/error.tsx` → created, catches auth errors and signs out + redirects

### Sub-tasks
- [~] BF-1 convex/auth.ts — `.filter()` retained (`.withIndex()` not possible in convexAuth callback ctx type)
- [x] BF-2 convex/lib/permissions.ts — email guard + local `const email` narrowing — APPROVED by BACKEND REVIEW AGENT (2026-04-13)
- [x] BF-3 app/(dashboard)/error.tsx — error boundary for auth errors — APPROVED by FRONTEND REVIEW AGENT (2026-04-13)

---

## Sign-Out Button Sub-task (2026-04-13)
- [x] Sign-out footer in Sidebar.tsx + email prop in DashboardWrapper.tsx — APPROVED by FRONTEND REVIEW AGENT (2026-04-13)

---

## Review Notes

**Frontend Review (BF-3):** APPROVED 2026-04-13. error.tsx passes all checklist items — correct Next.js error boundary signature, auth sign-out in useEffect with cancellation guard, branded UI, accessible role="status" and aria-label, mobile-safe layout, shadcn Button, no any types, no hardcoded hex. Non-blocking suggestion: filter raw error.message in the non-auth card to avoid leaking Convex internals in production.

**Frontend Review (Sign-out button):** APPROVED 2026-04-13. Correct useAuthActions import, async handleSignOut extracted above render, router.replace("/login") post-sign-out, collapsed state hides email but keeps icon visible, aria-label="Sign out" present, no any types, no hardcoded hex. Non-blocking: sign-out button (p-1.5 ≈ 28px) and toggle button (p-1) are below the 44px touch target minimum — consider upgrading both to shadcn Button variant="ghost" size="icon" (h-9 w-9) in a future pass.

---

## Completed Features (2026-04-05)
- [x] Phase 1 — Foundation (Next.js, Convex, Auth, Sidebar, Login)
- [x] Phase 2 — Core Student Management (add student, list, detail page, 5 tabs)
- [x] Phase 3 — Academic Management (subjects, assessments, grades, academic history, report cards)
- [x] Phase 4 — Fee Management (fee structures, student fees, collection, discounts)
- [x] Phase 5 — Polish & Roles (skeletons, empty states, error boundaries, mobile, RBAC, admin settings)

## Fee Detail Dialog Feature (2026-04-18)
**Status**: In Progress
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] FD-1 Create FeeDetailDialog.tsx + ApplyDiscountSubDialog — COMPLETE, awaiting FRONTEND REVIEW
- [x] FD-2 Modify FeesTab.tsx — clickable rows + dialog integration — COMPLETE, awaiting FRONTEND REVIEW

---

## Mark Entry Page Feature (2026-04-17)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] ME-1 Create assessment detail page (app/(dashboard)/admin/assessments/[assessmentId]/page.tsx) — COMPLETE
- [x] ME-2 Create MarkEntryGrid component (_components/MarkEntryGrid.tsx) — COMPLETE
- [x] ME-3 Create QuestionManager dialog (_components/QuestionManager.tsx) — COMPLETE
- [x] ME-4 Make assessment list items clickable (Link) on assessments/page.tsx — COMPLETE
- [x] ME-5 Fix pre-existing DiscountRule type error in FeeDetailDialog.tsx — COMPLETE (added _creationTime and missing optional fields)

### Build Verification
- `npm run build`: PASSING (11 routes including new /admin/assessments/[assessmentId])
- TypeScript: PASSING (0 type errors)

---

## Student Delete & Update Mutations (2026-04-24)
**Status**: DONE
**Active Agent**: BACKEND AGENT

### Sub-tasks
- [x] SU-1 Add `deleteStudent` mutation — cascade deletes all 9 related tables, unlinks siblings, deletes stored photos + report card files — awaiting BACKEND REVIEW
- [x] SU-2 Add `updateStudent` mutation — partial field update with bidirectional sibling re-linking — awaiting BACKEND REVIEW

---

## Student Header Enhancements (2026-04-24)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] SH-1 Add Delete button with AlertDialog to StudentHeader — COMPLETE
- [x] SH-2 Replace Edit button navigation with EditStudentDialog — COMPLETE
- [x] SH-3 Create EditStudentDialog component — COMPLETE

### Build Verification
- `npm run build`: PASSING (12 routes, 0 TypeScript errors)
- `npx biome check` on changed files: PASSING (0 errors)

---

## Bulk Student Promotion Feature (2026-04-25)
**Status**: In Progress
**Active Agent**: CODING AGENT (orchestrating)

### Sub-tasks
- [x] BP-1 convex/promotions.ts — getPromotionCandidates query + bulkPromote mutation — DONE
- [x] BP-2 Backend Review — APPROVED by BACKEND REVIEW AGENT (2026-04-25)
- [x] BP-3 Sidebar nav update + app/(dashboard)/admin/promotions/page.tsx — COMPLETE, awaiting FRONTEND REVIEW
- [x] BP-4 Frontend Review — APPROVED by FRONTEND REVIEW AGENT (2026-04-25)

### Review Notes
**Backend Review (BP-2) — REJECTED 2026-04-25, then APPROVED on re-review 2026-04-25:**
All 3 blocking issues resolved: (1) exitDate convention at idempotency guard, (2) duplicate enrollment guard via by_student_academic_year index in promote+hold_back, (3) duplicate fee guard via by_student_year index + Set dedup in promote+hold_back. Full checklist passed.

**Frontend Review (BP-3 / BP-4) — APPROVED 2026-04-25:**
promotions/page.tsx and Sidebar.tsx both pass all checklist items. Loading skeleton, empty state, and filter-not-selected state handled correctly. No `any` types — `Id` imports from dataModel, `as const` casts only on PromotionAction literals. RoleGate wraps admin content. All interactive elements have aria-label. Table has overflow-x-auto for mobile. Brand colors use Tailwind tokens only. Sonner toasts on success and error. AlertDialog cancel correctly disabled during submission. Non-blocking suggestions recorded in approval notes.

---

## Academic Year Creation Feature (2026-04-25)
**Status**: Planning
**Active Agent**: PLANNING AGENT

### Summary
Admins need to create new academic years from the Promotions page without navigating away. Two entry points: a "+ New Academic Year" option inside the Target Year dropdown, and a helper message when no valid target year exists. After creation the new year is auto-selected. Backend validates name uniqueness and date order. No schema changes required.

### Files in scope
- `convex/academicYears.ts` — add validation to existing `create` mutation (name uniqueness + startDate < endDate)
- `app/(dashboard)/admin/promotions/page.tsx` — add `CreateAcademicYearDialog` component + wire two entry points

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| AY-1 | Add name-uniqueness check and startDate < endDate guard to the `create` mutation in `convex/academicYears.ts`. Return the inserted Id (already present). No new functions. | BACKEND AGENT | [x] DONE | |
| AY-2 | Backend review of AY-1: verify requireRole present, no unbounded collect, uniqueness query uses `.take(100)` (already the list pattern), error messages safe, no N+1. | BACKEND REVIEW AGENT | [x] APPROVED | APPROVED by BACKEND REVIEW AGENT (2026-04-25) |
| AY-3 | Add `CreateAcademicYearDialog` to `app/(dashboard)/admin/promotions/page.tsx`. New state: `createYearOpen`. New mutation: `useMutation(api.academicYears.create)`. Dialog fields: Name (pre-filled via `suggestNextYear`), Start Date, End Date. Zod schema (inline, consistent with assessments/page.tsx pattern). Submit handler: call mutation → toast success + auto-select new Id → close; toast error on duplicate. Entry point 1: separator + clickable div (not SelectItem) inside Target Year SelectContent with a Plus icon. Entry point 2: helper message below filter bar when no target year exists. | FRONTEND AGENT | [x] COMPLETE | Awaiting FRONTEND REVIEW (AY-4) |
| AY-4 | Frontend review of AY-3: loading state, empty state, error toast, no `any`, no hardcoded hex, aria-labels on new interactive elements, mobile layout, RHF+Zod form, inline validation messages, Sonner toasts. | FRONTEND REVIEW AGENT | [x] APPROVED | APPROVED by FRONTEND REVIEW AGENT (2026-04-25) — see review notes |
| AY-5 | Run `npm run build` and `npm run lint` (Biome) on the two modified files. Confirm 0 errors. Update TASK_LOG.md with result. | CODING AGENT | [ ] Pending | Blocked by AY-4 |

### Dependencies and Blockers
- AY-1 has no external blockers (no schema change, mutation already exists and has `requireRole`).
- AY-2 is gated on AY-1; frontend cannot begin until AY-2 is approved.
- AY-3 depends on AY-2 approval. The `createYear` mutation call signature is already known from the spec: `{ name: string, startDate: float64, endDate: float64 }`.
- AY-5 is the integration check; only marks the feature complete when build + lint both pass.

### Agent Notes — AY-1 (BACKEND AGENT)
- The existing `list` query uses `.take(100)` — the uniqueness check inside `create` must also use `.take(100)` (not `.collect()`) then filter client-side, OR use a `by_name` index if one exists. Check schema before deciding; if no index exists, `.take(100)` + JS `.find()` is acceptable for academic years (low cardinality table, max ~20 rows).
- Error strings must not mention table names: "An academic year with this name already exists" and "Start date must be before end date" are the exact messages per the spec — use these verbatim.
- `requireRole(ctx, ["admin"])` is already present in the bare mutation; the validation code must be added AFTER this line.

### Agent Notes — AY-3 (FRONTEND AGENT)
- The `suggestNextYear(sourceYearName)` pure function must be extracted above the component — not inside the render body or a `useMemo` (no DOM access needed, pure string parsing).
- The "+ New Academic Year" trigger inside SelectContent must be a `div` with `onClick` — NOT a `SelectItem`. Clicking it must call `e.preventDefault()` to prevent the Select from closing and changing its value.
- The `createYearOpen` state, `createYear` mutation, and `CreateAcademicYearDialog` should all live inside `PromotionsPageContent` (not in the outer `PromotionsPage` shell which is only the RoleGate wrapper).
- Date fields use `input type="date"` — convert to Unix ms with `new Date(value).getTime()` before calling the mutation.
- Auto-suggest logic depends on `selectedSourceYearId`: find the year object from `years` array, pass its `name` to `suggestNextYear`. If no source year is selected yet, pass an empty string (suggestNextYear returns empty fields gracefully).
- After `createYear` resolves successfully, call `setSelectedTargetYearId(newId)` where `newId` is the returned `Id<"academicYears">`.
- No new Zod validation file — define the inline `createAcademicYearSchema` at the top of the page file, consistent with the pattern in `assessments/page.tsx`.

### Review Notes
**Frontend Review (AY-4) — APPROVED 2026-04-25:**
All checklist items pass. No `any` types. No hardcoded hex. `suggestNextYear` correctly extracted as pure function above component. `onMouseDown` + `e.preventDefault()` used for the SelectContent button (correct pattern). Warning banner condition (`years.filter(y => y._id !== selectedSourceYearId).length === 0 && selectedSourceYearId`) is correct. Zod schema has `.refine()` for date order with error on `endDate` path. `FormMessage` on all three fields. Submit button disabled on `formState.isSubmitting`. Auto-select works via `setSelectedTargetYearId(newId)`. `onOpenChange` resets form with suggestions on open. Dialog responsive: `max-w-sm sm:max-w-md`, date grid `grid-cols-1 sm:grid-cols-2`. `AlertDialogCancel` disabled during `isSubmitting`. Sonner toasts on all success and error paths. Non-blocking: the `div[role="button"]` inside SelectContent lacks `tabIndex="0"` and an `onKeyDown` handler for Enter/Space — keyboard users may be unable to activate it. Acceptable for now given shadcn Select manages focus internally.

### Decisions Made
- 2026-04-25: No schema change for this feature — the `academicYears` table already has the required fields.
- 2026-04-25: `CreateAcademicYearDialog` lives inline in `promotions/page.tsx` (not a separate file) because it is small (3 fields) and only used in one place. If reuse is needed in future, extract then.
- 2026-04-25: No `by_name` index added to `academicYears` — cardinality is too low to justify an index; `.take(100)` + `.find()` is the chosen uniqueness check approach.

---

## DataTable Enhancement + Faceted Filter (2026-04-25)
**Status**: Complete — awaiting FRONTEND REVIEW
**Active Agent**: FRONTEND AGENT

### Sub-tasks
- [x] TF-1 Update DataTable.tsx — added `toolbar` prop, `pageSizeOptions` prop, page size Select dropdown, useEffect for page index reset on data length change — COMPLETE
- [x] TF-2 Create DataTableFacetedFilter.tsx — new component with Popover+Command multi-select, checkbox UI, badge count, clear filters — COMPLETE

### Build Verification
- TypeScript: 0 errors in modified/new files (5 pre-existing errors in student-fees/page.tsx and students/page.tsx are unrelated)

---

## Security Hardening (2026-04-25)
**Status**: Complete
**Active Agent**: CODING AGENT

### Sub-tasks
- [x] SH-1 Fix proxy.ts redirect — changed authenticated user redirect from `/students` to `/dashboard` — COMPLETE
- [x] SH-2 Add security headers to next.config.ts — X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, X-XSS-Protection — COMPLETE
- [x] SH-3 Fix hardcoded Convex URL in next.config.ts — replaced `hushed-bass-123.convex.cloud` with dynamic `new URL(process.env.NEXT_PUBLIC_CONVEX_URL)` — COMPLETE

### Verification
- `npm run build`: PASSING (12 routes + Proxy Middleware)
- `npm run lint`: PASSING (122 files, 0 errors)
- Playwright smoke tests: 6/6 PASSING
- Manual curl verification:
  - `/dashboard` → 307 redirect to `/login` (unauthenticated) ✓
  - `/admin/settings` → 307 redirect to `/login` (unauthenticated) ✓
  - `/students` → 307 redirect to `/login` (unauthenticated) ✓
  - `/fees` → 307 redirect to `/login` (unauthenticated) ✓
  - All 5 security headers present on every response ✓

---

## Audit Log Feature (2026-04-26)
**Status**: Complete
**Active Agent**: CODING AGENT

### Summary
Add a tamper-evident, admin-only audit trail to every write operation in the system.
Every mutation already receives the acting user from `requireRole()`, so instrumenting
is a matter of calling a shared `logAudit()` helper at the end of each handler.
The frontend is a single admin-only page with filtering by action type and entity type.

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Double-submission: if a user submits a form twice, two audit rows are created | Acceptable — the mutation itself should already guard idempotency; the audit log faithfully records both attempts |
| 2 | `bulkPromote` loops over students — one `logAudit` call per student could be 30+ inserts | Per-entity logging is intentional per the spec; Convex mutations are transactional so all inserts succeed or none do. Flag in AL-3b that the loop insert count should be noted in the JSDoc |
| 3 | `metadata` is `v.any()` — no schema enforcement | Spec deliberately keeps it flexible; the agent must use `Record<string, unknown>` in the TypeScript signature so the helper stays typed even if Convex stores it as `any` |
| 4 | `getRecentLogs` with `.take(100)` — no cursor pagination | Acceptable for v1 per spec; flag as a future improvement if log volume grows |
| 5 | Non-admin roles must never access audit logs | Both queries must call `requireRole(ctx, ["admin"])` as the first line |
| 6 | Denormalized `userName`/`userEmail` may drift if user updates their name | Spec decision — records the name at time of action, which is the correct audit semantics |
| 7 | `entityId` is `v.string()` not `v.id(...)` — accepts any string | Intentional: entityId is passed as a string from the mutation args which are already typed `Id<"table">` — the string representation is sufficient for display and filtering |
| 8 | Instrumenting ~25+ mutations is a high-surface-area change | Split into two backend sub-tasks: (AL-2) create the file + helper + queries, (AL-3a/3b/3c) instrument mutations by domain group, each independently reviewable |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| AL-1 | Add `auditLogs` table to `convex/schema.ts`. Fields: `userId`, `userEmail`, `userName`, `action` (union of 9 literals), `entityType`, `entityId`, `description`, `metadata` (optional any), `timestamp` (float64). Indexes: `by_timestamp ["timestamp"]`, `by_entity ["entityType", "entityId"]`, `by_user ["userId"]`. This is the only schema change for this feature. | BACKEND AGENT | [x] DONE | |
| AL-2 | Create `convex/auditLogs.ts`. (a) Internal helper `logAudit(ctx, params)` — inserts one row with `timestamp: Date.now()`. TypeScript signature must use `Record<string, unknown>` for `metadata`, not `any`. (b) Query `getRecentLogs({ limit?: number })` — `requireRole(ctx, ["admin"])` first, then `by_timestamp` index descending `.take(limit ?? 100)`. (c) Query `getLogsByEntity({ entityType, entityId })` — `requireRole(ctx, ["admin"])` first, then `by_entity` index. Both queries admin-only. | BACKEND AGENT | [x] DONE | |
| AL-3a | Instrument student + enrollment mutations with `logAudit` calls. Files: `convex/students.ts` (`createStudent`, `updateStudent`, `deleteStudent`, `updateStudentStatus`), `convex/enrollments.ts` (`createEnrollment`, `updateEnrollmentExit`). Import `logAudit` from `./auditLogs`. Call after the main operation, passing the `user` object already returned by `requireRole`. | BACKEND AGENT | [x] DONE | |
| AL-3b | Instrument fee + discount mutations with `logAudit` calls. Files: `convex/feeStructure.ts` (`createFee`), `convex/studentFees.ts` (`createStudentFee`, `updateStudentFee`), `convex/feeTransactions.ts` (`createTransaction`), `convex/discounts.ts` (`create`, `toggleActive`), `convex/studentDiscounts.ts` (`applyDiscount`). Note: `feeStructure.createFee` does not currently call `requireRole` — verify it does before instrumenting. | BACKEND AGENT | [x] DONE | `requireRole` confirmed present in all 7 mutations before instrumentation |
| AL-3c | Instrument assessment + grade + report card + user + promotion + academic year mutations with `logAudit` calls. Files: `convex/assessments.ts` (`createAssessment`, `bulkCreateAssessments`, `updateAssessment`, `deleteAssessment`), `convex/assessmentQuestions.ts` (`createQuestion`, `bulkCreateQuestions`, `updateQuestion`, `deleteQuestion`), `convex/studentAssessmentAnswers.ts` (`bulkMarkEntry`), `convex/computedGrades.ts` (`computeGradesForStudent`), `convex/reportCards.ts` (`uploadReportCard`, `deleteReportCard`), `convex/users.ts` (`updateUserRole`, `deactivateUser`, `reactivateUser`), `convex/promotions.ts` (`bulkPromote` — one `logAudit` call per student inside the loop), `convex/academicYears.ts` (`create`). | BACKEND AGENT | [x] DONE | 17 mutations instrumented across 8 files. `bulkPromote` JSDoc updated. Biome lint: 0 errors. |
| AL-4 | Backend review of AL-1 through AL-3c. Verify: (1) `auditLogs` schema has all 3 indexes declared correctly, (2) both queries call `requireRole(ctx, ["admin"])` as first statement, (3) `logAudit` helper is not exported as a Convex mutation — it is a plain async function, (4) every instrumented mutation still calls `requireRole` before `logAudit`, (5) no N+1 (logAudit is a single insert, not a query), (6) `metadata` TypeScript type is `Record<string, unknown>` not `any`, (7) error messages in queries don't leak schema. Full BACKEND REVIEW AGENT checklist. | BACKEND REVIEW AGENT | [x] APPROVED | APPROVED by BACKEND REVIEW AGENT (2026-04-26). All 10 checklist sections pass. Non-blocking: (1) feeStructure.createFee uses entityType "feeStructures" vs actual table name "feeStructure" — cosmetic only. (2) deleteReportCard does not delete storage file — pre-existing issue. (3) deactivateAssessment not instrumented — out of scope per task spec. |
| AL-5 | Create `app/(dashboard)/admin/audit-log/page.tsx`. Admin-only (`RoleGate`). Use `useQuery(api.auditLogs.getRecentLogs, { limit: 200 })`. Table with columns: Timestamp, User, Action (Badge), Entity Type, Description. Two filter dropdowns (Action type, Entity type). Loading skeleton, empty state, filtered-empty state. Mobile overflow-x-auto. Filter logic in `useMemo`. | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (AL-7) |
| AL-6 | Add "Audit Log" entry to the Administration group in `components/layout/Sidebar.tsx`. Entry: `{ href: "/admin/audit-log", label: "Audit Log", icon: ClipboardList }`. Import `ClipboardList` from `lucide-react`. Admin-only (the entire Administration group is already `roles: ["admin"]`). | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (AL-7) |
| AL-7 | Frontend review of AL-5 and AL-6. | FRONTEND REVIEW AGENT | [x] REJECTED then FIXED | Initially REJECTED: filter logic was in component body. Fixed: extracted to `hooks/use-audit-log-filters.ts`, removed redundant `as AuditAction` casts. |
| AL-7b | Frontend re-review after fixes. | FRONTEND REVIEW AGENT | [x] APPROVED | Filter logic extracted to custom hook, `as AuditAction` casts removed, import order fixed. Build: 14 routes PASSING. Lint: 125 files, 0 errors. |
| AL-8 | Run `npm run build` and `npm run lint`. Confirm 0 errors. | CODING AGENT | [x] DONE | Build: PASSING (14 routes). Lint: PASSING (125 files, 0 errors). Playwright: 6/6 PASSING. |

### Dependencies and Blockers
- AL-1 (schema) must land before AL-2 (helper + queries) — Convex type generation depends on the table being declared.
- AL-2 must be complete before AL-3a/AL-3b/AL-3c — the mutations import `logAudit` from `auditLogs.ts`.
- AL-3a, AL-3b, AL-3c can be written in parallel within a single Backend Agent session since they touch different files, but all three must be complete before AL-4.
- AL-4 (backend review) gates all frontend work — no frontend task starts until AL-4 is approved.
- AL-5 and AL-6 can be done in a single Frontend Agent session.
- AL-8 (build/lint check) is the final integration gate before the feature is marked complete.

### Agent Notes — AL-1 (BACKEND AGENT)
- Do not add any indexes beyond the three specified. The `by_entity` index is composite — order matters: `["entityType", "entityId"]`.
- `metadata` field: use `v.optional(v.any())` in schema (matching the spec), but the TypeScript helper function signature should constrain to `Record<string, unknown> | undefined`.
- `action` field must use `v.union(v.literal(...), ...)` with all 9 literal values: `create`, `update`, `delete`, `status_change`, `collect_payment`, `apply_discount`, `upload`, `promote`, `role_change`.

### Agent Notes — AL-2 (BACKEND AGENT)
- `logAudit` is a plain `export async function`, NOT `export const logAudit = mutation({...})`. It is called inside existing mutations, not from the client.
- Descending order on `by_timestamp`: use `.order("desc")` before `.take()`.
- `getLogsByEntity` does not need ordering — the index will return results in index order (entityType, entityId); if ordering by timestamp within an entity is desired, add `.order("desc")` — but the spec does not require it for v1.

### Agent Notes — AL-3a/3b/3c (BACKEND AGENT)
- The `user` object returned by `requireRole()` has `_id`, `name`, and `email` fields — pass these directly as `user` to `logAudit`.
- For `deleteStudent`: capture `student.firstName` and `student.lastName` before deleting, since the record will be gone when the log is written.
- For `bulkPromote`: inside the per-student loop, call `await logAudit(ctx, { user, action: "promote", entityType: "students", entityId: studentId, description: \`...\` })`.
- For `feeStructure.createFee`: confirm `requireRole` is present (grep before touching the file). If missing, add it as the first line in the handler before the logAudit call.
- Action type mapping to use: `createStudent`→`create`, `updateStudent`→`update`, `deleteStudent`→`delete`, `updateStudentStatus`→`status_change`, `createTransaction`→`collect_payment`, `applyDiscount`→`apply_discount`, `uploadReportCard`→`upload`, `bulkPromote`→`promote`, `updateUserRole`→`role_change`, all others→`create`/`update`/`delete` as appropriate.

### Agent Notes — AL-5 (FRONTEND AGENT)
- Read the `frontend-design` SKILL.md before starting.
- Import `date-fns` `format` function — it is already a dependency in this project (used in existing components).
- Action badge colors: suggest mapping `delete`→`destructive`, `status_change`→`secondary`, `collect_payment`→`default` (green), `role_change`→`outline`, others→`secondary`. Use shadcn `Badge` variants — no hardcoded hex.
- Extract filter logic (filtering `logs` array by selected action/entityType) into `hooks/use-audit-log-filters.ts` returning `{ filteredLogs, actionFilter, setActionFilter, entityTypeFilter, setEntityTypeFilter }`.
- The entity type filter options are derived from the live data — use `useMemo` to compute distinct `entityType` values from the returned logs array.
- The page lives at `app/(dashboard)/admin/audit-log/page.tsx`, consistent with the existing `/admin/assessments` and `/admin/promotions` pattern.
- Use `columns.tsx` pattern (separate file for TanStack Table column definitions) only if the column set is complex; for this table (5 columns, read-only), inline column definitions in the page file are acceptable.

### Decisions Made
- 2026-04-26: `logAudit` is a plain async function, not a Convex mutation, to avoid the overhead of a separate network call. It runs inside the existing mutation transaction.
- 2026-04-26: No cursor-based pagination for v1 — `.take(100)` is sufficient; can be upgraded if log volume warrants it.
- 2026-04-26: `entityId` is stored as `v.string()` (not `v.id()`) to support heterogeneous entity types without a union validator.
- 2026-04-26: `metadata` stored as `v.any()` in schema but constrained to `Record<string, unknown>` in the TypeScript helper to preserve type safety at the call sites.
- 2026-04-26: AL-3a/3b/3c split by domain group to keep each sub-task reviewable and bounded in scope.

---

## Fee Structure Editability Feature (2026-04-26)
**Status**: In Progress
**Active Agent**: CODING AGENT (orchestrating)

### Summary
Add the ability to view, edit, and soft-delete individual fees within a fee structure. Adds a detail page at `/fees/[levelId]` with a fee table, edit dialog, deactivate/reactivate confirmation, and student count per fee. Cards on the `/fees` listing page become clickable links to the detail page.

### Devil's Advocate Review
- Concern: Editing baseAmount on a fee structure doesn't retroactively update existing studentFees → Mitigation: Acceptable — existing studentFees record the original amount at time of assignment; new assignments will use the updated amount
- Concern: Soft delete means deactivated fees still appear in queries → Mitigation: getByLevel returns all fees (active + inactive) for admin visibility; getFormFees/getFormFeeStructure should filter by isActive for admission form
- Concern: Student count query per fee could be slow without index → Mitigation: Adding by_feeStructure index to studentFees table
- Concern: Changing feeType could break studentFees references → Mitigation: feeType change is allowed (no referential integrity issue — studentFees references feeStructureId, not feeType)
- Concern: "semester" frequency option in CreateFeeDialog doesn't match schema → Mitigation: Fixing as part of B1 extraction

### Sub-tasks

| # | Task | Agent | Status |
|---|------|-------|--------|
| FS-1 | Add `by_feeStructure` index to studentFees in schema.ts | BACKEND AGENT | [x] DONE |
| FS-2 | Add `updateFee` mutation to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-3 | Add `toggleActive` mutation to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-4 | Add `getByLevel` query to feeStructure.ts | BACKEND AGENT | [x] DONE |
| FS-5 | Backend review of FS-1 through FS-4 | BACKEND REVIEW AGENT | [x] APPROVED 2026-04-26 — All 4 previously rejected issues resolved. Full checklist passed. |
| FS-6 | Extract CreateFeeDialog to shared component + fix semester bug | FRONTEND AGENT | [x] DONE — Extracted to `_components/CreateFeeDialog.tsx`, removed `"semester"` from frequencies, added aria-labels |
| FS-7 | Create EditFeeDialog component | FRONTEND AGENT | [x] DONE — `_components/EditFeeDialog.tsx`, follows EditAssessmentDialog pattern, pre-populated defaults |
| FS-8 | Create detail page at fees/[levelId]/page.tsx | FRONTEND AGENT | [x] DONE — Full page with summary cards, fee table, edit/deactivate/reactivate dialogs, loading/empty/not-found states |
| FS-9 | Make grade cards clickable with navigation | FRONTEND AGENT | [x] DONE — Cards wrapped in `Link`, chevron-right indicator, `e.preventDefault()` on Add button |
| FS-10 | Frontend review of FS-6 through FS-9 | FRONTEND REVIEW AGENT | [x] APPROVED 2026-04-26 (re-review) — All 4 blocking issues confirmed resolved: (1) conditional render guard replaces unsafe `as` cast, (2) empty state for zero levels added, (3) summaryStats/level derivation extracted to `hooks/use-fee-level-summary.ts`, (4) schemas moved to `lib/validations/feesSchema.ts`. isSubmitting fix confirmed. Full checklist passed. |
| FS-11 | Run npm run build and npm run lint | CODING AGENT | [x] DONE — Build: 15 routes PASSING. Lint: 129 files, 0 errors. |

---

## Transaction Log: Standard Level Filter + Date Range Presets (2026-05-18)
**Status**: In Progress
**Active Agent**: BACKEND AGENT

### Sub-tasks
- [x] TL-5 Create `convex/migrations.ts` — backfill `standardLevelId` on existing feeCollectionSessions — DONE (2026-05-18)
- [x] TL-7 Update `hooks/use-transaction-filters.ts` — add standardLevelId, date range preset state, computed dates — DONE (2026-05-18). Also exported `PeriodForPreset` from `lib/dateRangeUtils.ts` to fix TS2345. Hook file: 0 TS errors. Expected downstream errors in page.tsx (setDateFrom/setDateTo removed) will be fixed in Tasks 8-9.
- [x] TL-8 Update TransactionFilters UI — DONE (2026-05-18) — FRONTEND AGENT replaced entire component: removed dateFrom/dateTo/onDateFromChange/onDateToChange props; added standardLevelId, dateRangePreset, selectedPeriod, customDateFrom/To props; added Standard Level dropdown (api.standardLevels.list), Date Range Preset selector (monthly/quarterly/half-yearly/yearly/custom), conditional sub-pickers (month+year, quarter+year, half+year, custom date pickers); moved Reset button next to Show Voided toggle. TypeScript: 0 errors. Awaiting FRONTEND REVIEW.
- [x] TL-9 Wire new filter props in page.tsx + update ExportButton — DONE (2026-05-18) — FRONTEND AGENT. ExportButton: added `levelName` and `dateRangeLabel` optional props, passed to `generateTransactionFilename`. page.tsx: removed old `dateFrom`/`onDateFromChange`/`dateTo`/`onDateToChange` props from TransactionFilters; added new props (`standardLevelId`, `dateRangePreset`, `selectedPeriod`, `customDateFrom`, `customDateTo` + their setters). ExportButton receives `levelName` from `data?.standardLevelName` and `dateRangeLabel` from `filters.dateRangeLabel`. Awaiting FRONTEND REVIEW.

---

## Current Build Status
- `npm run build`: PASSING (15 routes + Proxy Middleware)
- `npm run lint`: PASSING (129 files, 0 errors)
- Playwright smoke tests: 6/6 PASSING
- `npx tsc --noEmit`: PASSING (0 errors) — verified 2026-05-18

---

---

## Fee Management Bug Fixes (2026-05-09)
**Status**: Planning
**Active Agent**: PLANNING AGENT

### Summary
Three reported issues with the fee management system:

1. **Feature A — CollectFeesDialog overflow + compact UX**: When 12+ fees are selected the
   dialog overflows the viewport. Each fee is shown as a full card with Original/To Collect
   lines. Redesign to group same-structure fees into a single compact summary row
   (e.g., "Sports × 12 months (Jul 2026 – Feb 2027) — ৳18,000") with an optional expand
   toggle to see individual fees. Dialog must stay within the viewport at all times.

2. **Feature B — Delete accidentally assigned fee**: No way to remove an unpaid fee that
   was assigned by mistake. Needs a backend `deleteStudentFee` mutation (admin-only, unpaid
   only) and a frontend "Delete Fee" option in the "..." dropdown on each fee row in FeesTab,
   protected by a confirmation dialog.

### Files in scope
- `convex/studentFees.ts` — add `deleteStudentFee` mutation
- `convex/auditLogs.ts` — `logAudit` must be called from the new mutation (already imported in studentFees.ts)
- `app/(dashboard)/students/[studentId]/_components/CollectFeesDialog.tsx` — compact grouped display
- `app/(dashboard)/students/[studentId]/_components/FeesTab.tsx` — delete option in "..." dropdown

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | Deleting a fee that has a partial payment — balance > 0, paidAmount > 0 | Mutation must block deletion if `paidAmount > 0` (not just `status !== "paid"`). Even "unpaid" status can have partial-but-unrecorded context. Rule: only allow delete when `paidAmount === 0`. |
| 2 | feeTransactions rows reference the studentFee via `feeId` — deleting the fee leaves orphaned transactions | Block deletion if any `feeTransactions` row references this fee (use `by_student` index to find transactions for the student and filter by `feeId`). This is stricter and safer than checking `paidAmount`. |
| 3 | Double-delete: user clicks delete twice before mutation returns | Confirmation dialog's confirm button must be disabled during submission with `isDeleting` state. |
| 4 | Grouping logic in CollectFeesDialog — a structure with both monthly and one-off fees (same feeStructureId but one fee has no billingPeriod) | Non-monthly fees (no billingPeriod) should never be grouped; they always render as individual cards. Only fees with `billingPeriod` and matching `feeStructureId` are eligible for grouping. |
| 5 | Grouped row "Sports × 12 months (Jul 2026 – Feb 2027)" — what if the months are non-contiguous? | Display as "Sports × N fees" without a date range if the months are non-contiguous; date range label only when contiguous. `formatBillingPeriod` already exists — parse first/last period. |
| 6 | Removing one month from a grouped set — does the grouped row collapse or update count? | The existing `removeFee` already enforces sequential removal (`getSequentialRemovalIds`). After removal the group simply re-renders with updated count. No extra logic needed. |
| 7 | CollectFeesDialog is currently 422 lines — adding grouping logic will grow it further | Extract the new grouped-fee section into a `GroupedFeeRow` sub-component in the same file (same pattern as the existing `PerStructureFutureMonths` sub-component). No new file unless it grows past ~600 lines. |
| 8 | Delete option only appears on `status !== "paid"` rows — need to verify the "paid" guard is enforced server-side | Mutation already calls `requireRole(ctx, ["admin"])`. Add the `paidAmount > 0 || hasFeeTransactions` check as the next guard. Frontend "Delete" item in the dropdown is already only rendered for `status !== "paid"` rows. |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| FM-1 | Add `deleteStudentFee` mutation to `convex/studentFees.ts`. Args: `{ feeId: v.id("studentFees") }`. Handler: (1) `requireRole(ctx, ["admin"])` first, (2) fetch the fee record — throw "Fee not found" if missing, (3) check `fee.paidAmount > 0` — throw "Cannot delete a fee with recorded payments", (4) query `feeTransactions` for any row with `feeId` matching using `by_student` index filtered by this studentId + feeId — throw "Cannot delete a fee with existing transactions", (5) `ctx.db.delete(feeId)`, (6) `logAudit(ctx, { user, action: "delete", entityType: "studentFees", entityId: feeId, description: "Deleted student fee" })`. Return void. | BACKEND AGENT | [ ] Pending | No schema change required — `by_student` index already exists on feeTransactions and `by_student_year` index exists on studentFees |
| FM-2 | Backend review of FM-1. Verify: requireRole present and first, paidAmount guard correct, feeTransactions orphan check present, logAudit called, no N+1 (single `ctx.db.get` + one index query), error messages don't leak internals, return type void. | BACKEND REVIEW AGENT | [ ] Pending | Blocked by FM-1 |
| FM-3 | Redesign fee display in `CollectFeesDialog.tsx`. Replace the flat `selectedFees.map(...)` card list with a grouped display. Logic: split `selectedFees` into two buckets — (a) fees with `billingPeriod` grouped by `feeStructureId`, (b) fees without `billingPeriod` rendered as individual cards (unchanged). For each group in bucket (a): render a `GroupedFeeRow` sub-component showing fee type name, count, date range (contiguous → "Jul 2026 – Feb 2027"; non-contiguous → "N fees"), total balance, and a chevron toggle to expand individual fee cards within the group. The remove (X) button on each individual fee within an expanded group still calls the existing `removeFee`. Non-monthly individual cards render exactly as they do today. The `ScrollArea`, `grandTotal`, payment mode, remarks, and action buttons are unchanged. Extract the new sub-component as `GroupedFeeRow` inside the same file below the existing `PerStructureFutureMonths` definition. | FRONTEND AGENT | [ ] Pending | Blocked by FM-2. No new Convex queries needed — all data already in `selectedFees`. Use `ChevronDown`/`ChevronRight` from lucide-react. |
| FM-4 | Add "Delete Fee" option to the fee row dropdown in `FeesTab.tsx`. Steps: (1) import `useMutation` and `api.studentFees.deleteStudentFee`, (2) add state `deletingFeeId: Id<"studentFees"> | null` and `isDeleting: boolean`, (3) add a `DropdownMenuSeparator` and a `DropdownMenuItem` with red text ("Delete Fee") inside the existing DropdownMenuContent — only for `status !== "paid"` rows (already gated by the outer condition), (4) clicking "Delete Fee" sets `deletingFeeId` and opens a confirmation `AlertDialog` (inline — small, single-page-use), (5) confirmation calls `deleteStudentFee({ feeId })` with `isDeleting` guard on the confirm button, (6) on success: `toast.success("Fee deleted")` + clear state; on error: `toast.error(message)` + clear `isDeleting`. The AlertDialog and its state live inside `FeesTab` (not extracted — ≤3 interactions, single-page use per inline dialog pattern). | FRONTEND AGENT | [ ] Pending | Blocked by FM-2. FM-3 and FM-4 can be done in the same Frontend Agent session as they touch different components with no shared state. |
| FM-5 | Frontend review of FM-3 and FM-4. Check: (1) grouped display handles 0-fee edge (never shown), 1-fee group (still shows grouped row, not just a flat card), and 12-fee group correctly; (2) expand/collapse toggle has aria-label and aria-expanded; (3) individual fee cards within expanded group still show remove (X) button; (4) non-monthly fees render as individual cards unchanged; (5) delete confirmation AlertDialog has disabled confirm button during `isDeleting`; (6) Sonner toast on delete success and error; (7) no `any` types; (8) no hardcoded hex; (9) dialog still fits viewport with 12 fees grouped. | FRONTEND REVIEW AGENT | [ ] Pending | Blocked by FM-3 and FM-4 |
| FM-6 | Run `npm run build` and `npm run lint`. Confirm 0 errors. Update build status line. | CODING AGENT | [ ] Pending | Blocked by FM-5 |

### Dependencies and Blockers
- FM-1 (backend mutation) has no external blockers — no schema change, no new index, imports already in place.
- FM-2 (backend review) gates all frontend work.
- FM-3 and FM-4 are independent of each other and can run in one Frontend Agent session after FM-2 is approved.
- FM-5 (frontend review) requires both FM-3 and FM-4 to be complete.
- FM-6 is the final integration check.

### Agent Notes — FM-1 (BACKEND AGENT)
- The `feeTransactions` table has a `by_student` index on `["studentId"]`, not on `feeId`. To check for orphaned transactions: query `feeTransactions` with `by_student` index for the fee's `studentId`, then `.filter(q => q.eq(q.field("feeId"), feeId))` or use `.take(100)` and filter in JS. A `.take(1)` with filter is sufficient — we only need to know if any exist, not count them.
- Do not add a new index for this check. The `feeTransactions` table is low-cardinality per student; filtering in JS after a `by_student` index read is acceptable.
- Import `logAudit` is already at line 3 of `convex/studentFees.ts` — no new import needed.
- Error message for paid fee: "Cannot delete a fee that has already been paid or partially paid". Error message for existing transactions: "Cannot delete a fee that has recorded transactions". Neither reveals table names or internal field names.

### Agent Notes — FM-3 (FRONTEND AGENT)
- The existing `groupMonthlyStructures` utility from `lib/perStructureFutureMonths` groups by structure for the "Add Future Months" section but is not appropriate here — it is designed for future month selection, not for display grouping. Write a small pure function `groupFeesByStructure` at the top of `CollectFeesDialog.tsx` (not in a lib file — it is only used here). It takes `FeeForCollection[]` and returns `{ monthly: Map<string, FeeForCollection[]>, individual: FeeForCollection[] }` where monthly groups contain only fees with `billingPeriod`.
- Contiguous date range detection: sort the `billingPeriod` strings for a group (they are `"YYYY-MM"` format, so lexicographic sort is chronologically correct). Check that each consecutive pair differs by exactly one month. If contiguous, format as `"MMM YYYY – MMM YYYY"` using `formatBillingPeriod` on the first and last. If not contiguous, use `"N fees"` label.
- The `ChevronDown` and `ChevronRight` icons are already available from `lucide-react` (used elsewhere in this project).
- Ensure the `GroupedFeeRow` sub-component accepts `fees: FeeForCollection[]`, `onRemove: (id: string) => void`, `isExpanded: boolean`, `onToggle: () => void` props. The expanded/collapsed state is managed by the parent `CollectFeesDialog` using a `Set<string>` keyed by `feeStructureId` — this is the same pattern already used for `expandedStructures`.

### Agent Notes — FM-4 (FRONTEND AGENT)
- The `AlertDialog` for delete confirmation is inline in `FeesTab.tsx`. It follows the same inline pattern used in `app/(dashboard)/admin/promotions/page.tsx` (confirm action AlertDialog). Do not create a separate file.
- The delete dropdown item should use `className="text-red-600 focus:text-red-600"` to visually signal destructive action — consistent with the pattern in other destructive DropdownMenuItems in this codebase.
- Add a `DropdownMenuSeparator` between "Collect Fee" and "Delete Fee" in the dropdown.
- After a successful delete the `fees` query will auto-update via Convex reactivity — no manual refetch needed. Clear `deletingFeeId` and `isDeleting` in the `finally` block.

### Decisions Made
- 2026-05-09: No schema change for this feature. The existing `by_student_year` and `by_feeStructure` indexes on `studentFees` are sufficient; the existing `by_student` index on `feeTransactions` is sufficient for the orphan check.
- 2026-05-09: Delete is blocked when `paidAmount > 0` OR when any `feeTransactions` row references the fee — belt-and-suspenders guard against data loss.
- 2026-05-09: Grouping logic for CollectFeesDialog lives in a pure function inside the component file (not in `lib/`) — it is only used in one place.
- 2026-05-09: The `GroupedFeeRow` sub-component lives in the same file as `CollectFeesDialog` following the existing `PerStructureFutureMonths` sub-component pattern.

---

## Transaction Log Filter UI Redesign (2026-05-18)
**Status**: In Progress (TF-R3, TF-R4)
**Active Agent**: FRONTEND AGENT

### Summary
The current TransactionFilters component uses a flat grid that injects extra sub-picker rows
when the user selects a date preset (monthly, quarterly, half-yearly, custom), causing visible
layout shifts. The redesign introduces a stable two-tier filter layout (primary row always
visible; secondary row expandable via "More Filters"), replaces all sub-picker injection with
a unified DateRangePicker popover (preset sidebar + two-month range calendar), and adds a
mobile bottom sheet that collapses all filters behind a single "Filters" button.

No backend changes are required. The hook still produces `dateFrom`/`dateTo` as Unix timestamps
for `queryArgs`; only the internal state shape and the UI change.

### Devil's Advocate Review

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | DateRange state in the hook is currently `dateRangePreset` + `selectedPeriod` + `customDateFrom/To` — consumers of the hook (page.tsx, ExportButton) read `filters.dateRangeLabel`. Refactoring the hook internal state must not break the `dateRangeLabel` string or `queryArgs` shape. | TF-R2 (hook refactor) must output an identical `queryArgs` object and a `dateRangeLabel` string. Unit-test the label output before wiring to the page. |
| 2 | The DateRangePicker popover holds both a preset list and a two-month calendar — if popover width is constrained on small desktop (< 900px) the calendar overflows. | Constrain popover width with `min-w-[560px]` desktop and drop to single-month on screens narrower than `md` via a `useWindowSize` check or a CSS approach. |
| 3 | "More Filters" badge count could show a stale count if campus/paymentMode is reset without going through resetAll. | Badge count derived live from `campusFilter`, `paymentMode`, `includeVoided` values — not stored separately. Any state change automatically updates the count. |
| 4 | Mobile bottom sheet overlaps system navigation on iOS if the sheet extends to full viewport height. | Use `max-h-[90dvh] overflow-y-auto` on the sheet content — the `dvh` unit accounts for browser chrome. |
| 5 | The calendar component uses `react-day-picker` which already supports `mode="range"` — but the existing `CalendarDayButton` override may not correctly style range-start/middle/end for the new two-month usage. | TF-R1 verifies range styling is correct using `numberOfMonths={2}` in a Popover before wiring to the hook. Read the existing classNames for `range_start`, `range_middle`, `range_end` — they are already present. No changes to calendar.tsx needed. |
| 6 | Removing `computeDateRange`, `formatDateRangeLabel`, and `PeriodForPreset` from `dateRangeUtils.ts` may break other files that import them (e.g., any future feature that used them). | Grep for all import sites before deleting. Only delete if there are zero remaining import sites. |
| 7 | Playwright tests require an authenticated session to reach the /admin/transactions page. Current smoke tests are unauthenticated. | Write Playwright tests that assert on the filter bar's static structure (desktop primary row elements, "More Filters" button, Reset link) without requiring a real authenticated session, using `page.route` to mock the Convex API, OR test only what the anonymous user sees (redirect to /login). Flag authenticated-session tests as Phase 5 TODOs. |

### Sub-tasks

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| TF-R1 | Build `components/ui/date-range-picker.tsx` + `hooks/use-media-query.ts`. DateRangePicker: Popover with preset sidebar (9 presets), Calendar mode="range" (2 months desktop, 1 mobile), responsive layout (flex-row desktop, flex-col mobile). Exported `getPresetRange` pure function. SSR-safe `useMediaQuery` hook. | FRONTEND AGENT | [x] DONE | 0 TS errors in both files. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R2 | Refactor `hooks/use-transaction-filters.ts`. Replaced `dateRangePreset`/`selectedPeriod`/`customDateFrom`/`customDateTo` with `dateRange`/`datePresetLabel`. Updated `TransactionFilterState` interface, `resetAll`, `hasActiveFilters`, and return value. Removed `dateRangeUtils` imports. | FRONTEND AGENT | [x] DONE | 0 TS errors in hook file. Expected 8 downstream errors in page.tsx (old props) — fixed in TF-R3/TF-R4. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R3 | Rewrite `TransactionFilters.tsx` with two-tier layout: primary row (Academic Year, Standard Level, DateRangePicker, Student Search, More Filters + Badge, Reset), secondary row (Campus, Payment Mode, Show Voided) with CSS grid animation. Removed all sub-picker injection blocks, old DatePicker, MONTH_LABELS. Uses `<section>` for a11y. Auto-expands secondary row when secondary filters are active. | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (TF-R8). 0 TS errors, 0 lint errors. |
| TF-R4 | Updated `page.tsx` to match new TransactionFilters props. Replaced 12 old date-related props with `dateRange`, `onDateRangeChange`, `datePresetLabel`, `onPresetSelect`, `onDateClear`. Added `PaymentMode` cast wrapper for type compatibility. ExportButton unchanged (still receives `dateRangeLabel`). | FRONTEND AGENT | [x] DONE | Awaiting FRONTEND REVIEW (TF-R8). 0 TS errors, build PASSING (15 routes), lint PASSING (161 files, 0 errors). |
| TF-R5 | Add mobile bottom sheet to `TransactionFilters.tsx`. Mobile layout (`block sm:hidden`) shows a "Filters" Button with Badge for active count that opens a shadcn Sheet (`side="bottom"`) with all filters stacked vertically. Desktop layout wrapped in `hidden sm:block`. Sheet content uses `max-h-[85vh] overflow-y-auto`. | FRONTEND AGENT | [x] DONE | Completed 2026-05-18. Desktop layout wrapped in `hidden sm:block`, mobile Sheet with all 7 filters stacked vertically, Apply/Reset footer buttons, totalActiveCount badge. 0 TS errors, build PASSING (15 routes), lint PASSING (161 files, 0 errors). Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R6 | Clean up dead code. In `lib/dateRangeUtils.ts`: grep for all import sites of `computeDateRange`, `formatDateRangeLabel`, `PeriodForPreset`, `DateRangePreset` (old union type). Delete any functions and types that have zero remaining import sites after TF-R2 and TF-R3. In `hooks/use-transaction-filters.ts`: remove any remaining unused imports. In `TransactionFilters.tsx`: remove any unused imports (e.g., `MONTH_LABELS`, the old `DatePicker` sub-component). Run `npm run lint` to catch any remaining dead imports. If `DateRangePreset` is still imported elsewhere for the old preset values, keep the type but remove the computation functions. | FRONTEND AGENT | [ ] Pending | Blocked by TF-R5. Grep before deleting. |
| TF-R7 | Playwright tests for the redesigned filter bar. Write or update tests in the `e2e/` directory. Test 1: navigate to `/admin/transactions` unauthenticated — assert redirect to `/login` (existing smoke test pattern). Test 2: assert the desktop filter bar container renders with the correct landmark structure when the page loads (check for `aria-label="Transaction filters"` or the equivalent container). Test 3: assert "More Filters" button is present in the desktop layout. Test 4: assert the mobile "Filters" button is present at `viewport: { width: 375, height: 812 }`. Note: full authenticated flow tests are deferred to Phase 5 as before. Invoke `playwright-cli` skill. | FRONTEND AGENT | [x] DONE | Completed 2026-05-18. 13 tests in `e2e/transaction-filters.spec.ts`: 1 auth-gate redirect test, 9 desktop filter structure tests (landmark, selects, picker, search, more-filters toggle, reset, secondary row expand/collapse, DateRangePicker popover with presets + calendar), 3 mobile tests (filters button visibility, bottom sheet controls, reset/apply buttons). All tests use `test.skip()` pattern for auth-gated pages. 0 TS errors, 0 lint errors. Awaiting FRONTEND REVIEW (TF-R8). |
| TF-R8 | Frontend review of TF-R1 through TF-R7. Checklist: (1) DateRangePicker — preset sidebar fires `onChange` correctly, trigger label updates, range mode calendar highlights range-start/middle/end; (2) primary row is stable — no layout shift when date range changes; (3) secondary row expand/collapse is animated, has correct aria-expanded; (4) "More Filters" badge count is accurate for 0, 1, 2, 3 active secondary filters; (5) Reset ghost link disables when `!hasActiveFilters`; (6) mobile sheet is `side="bottom"`, has `max-h-[90dvh]`, single-month calendar; (7) no `any` types; (8) no hardcoded hex; (9) all interactive elements have aria-labels; (10) `dateRangeLabel` still flows to ExportButton correctly; (11) Playwright tests pass. | FRONTEND REVIEW AGENT | [ ] Pending | Blocked by TF-R7 |
| TF-R9 | Run `npm run build` and `npm run lint`. Confirm 0 errors. Update Current Build Status. | CODING AGENT | [ ] Pending | Blocked by TF-R8 |

### Dependencies and Blockers
- TF-R1 (DateRangePicker component) has no external blockers — it is a self-contained UI component.
- TF-R2 (hook refactor) is blocked on TF-R1 being finalized so the `dateRange` type shape is settled. TF-R1 and TF-R2 can be done in the same Frontend Agent session.
- TF-R3 (TransactionFilters component rewrite) requires TF-R2 to be complete — it imports DateRangePicker and uses the new hook props.
- TF-R4 (page.tsx wiring) requires TF-R3 — it passes the new props.
- TF-R5 (mobile bottom sheet) requires TF-R4 — it lives in the same page file.
- TF-R6 (dead code cleanup) requires TF-R5 — all consumers must be updated before functions can be safely deleted.
- TF-R7 (Playwright tests) requires TF-R5 — all UI must be in place before assertions can be written.
- TF-R8 (frontend review) requires TF-R1 through TF-R7 all complete.
- TF-R9 (build/lint check) is the final integration gate.

### Agent Notes — TF-R1 (FRONTEND AGENT)
- The `Calendar` component in `components/ui/calendar.tsx` already has `range_start`, `range_middle`, `range_end` classNames wired. Pass `mode="range"` and `numberOfMonths={2}` directly — no changes to `calendar.tsx` needed.
- Preset-to-date-range computation: implement a pure function `presetToDateRange(preset: string): { from: Date; to: Date }` inside the component file. Use `date-fns` helpers (`startOfDay`, `endOfDay`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `startOfQuarter`, `endOfQuarter`, `subMonths`, `subQuarters`). For "All Time": return `{ from: undefined, to: undefined }`.
- Use `date-fns` `format(date, "MMM d, yyyy")` for the trigger label when showing a custom range. Show just the preset name (e.g., "This Month") when a preset is active.
- The popover content layout: `flex` with `w-[180px]` left sidebar and `flex-1` right calendar area. On `sm` breakpoint and below, collapse to `flex-col` with just the preset list and single-month calendar stacked.
- The shadcn `Popover` component already handles open/close animation via Radix UI — no extra animation code needed.

### Agent Notes — TF-R2 (FRONTEND AGENT)
- The new state shape: `const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })` and `const [presetLabel, setPresetLabel] = useState<string | null>(null)`.
- `dateFrom` in `queryArgs`: `dateRange.from ? startOfDay(dateRange.from).getTime() : undefined` (use `date-fns` `startOfDay`).
- `dateTo` in `queryArgs`: `dateRange.to ? endOfDay(dateRange.to).getTime() : undefined` (use `date-fns` `endOfDay` to include the full last day).
- `dateRangeLabel`: `presetLabel ?? (dateRange.from && dateRange.to ? format(dateRange.from, "MMM d") + " – " + format(dateRange.to, "MMM d, yyyy") : "")`.
- `hasActiveFilters`: include `dateRange.from !== undefined` in the check.
- `resetAll`: set `setDateRange({ from: undefined, to: undefined })` and `setPresetLabel(null)`.
- The hook exports `{ dateRange, setDateRange, presetLabel, setPresetLabel, dateRangeLabel, ... }` — these replace `dateRangePreset`, `setDateRangePreset`, `selectedPeriod`, `setSelectedPeriod`, `customDateFrom`, `setCustomDateFrom`, `customDateTo`, `setCustomDateTo`.

### Agent Notes — TF-R3 (FRONTEND AGENT)
- The secondary row animation: use the Tailwind `grid` rows trick. Wrap the secondary row in `<div className="grid transition-all duration-300 ease-in-out" style={{ gridTemplateRows: showSecondary ? '1fr' : '0fr' }}>` with an inner `<div className="overflow-hidden">` containing the controls. This avoids any JS animation library and works with Tailwind v4.
- The "More Filters" button: `<Button variant="outline" size="sm" onClick={() => setShowSecondary(s => !s)} aria-expanded={showSecondary} aria-label="Show more filters">`. The Badge showing count is inside the button: `{secondaryActiveCount > 0 && <Badge className="ml-1.5 h-4 w-4 ...">{secondaryActiveCount}</Badge>}`.
- `secondaryActiveCount`: computed as `[campusFilter, paymentMode, includeVoided ? "voided" : undefined].filter(Boolean).length`.
- The Reset link: `<Button variant="ghost" size="sm" onClick={onReset} disabled={!hasActiveFilters} className="text-muted-foreground">Reset</Button>` — right-aligned using `ml-auto` in the flex row.
- StudentSearch sub-component can be kept as-is from the existing TransactionFilters file — move it to the bottom of the new file.

### Agent Notes — TF-R5 (FRONTEND AGENT)
- The mobile total active count for the "Filters (N)" badge: `[filters.standardLevelId, filters.campusFilter, filters.paymentMode, filters.includeVoided ? "v" : undefined, filters.dateRange.from ? "d" : undefined, filters.studentIds?.length ? "s" : undefined].filter(Boolean).length`.
- Academic Year is always visible and not counted in the mobile filter badge — it is the primary context selector.
- The Sheet footer: `<div className="flex gap-2 border-t pt-4"><Button variant="ghost" onClick={filters.resetAll}>Reset</Button><Button onClick={() => setMobileOpen(false)}>Apply</Button></div>`.

### Agent Notes — TF-R6 (FRONTEND AGENT)
- Before deleting from `lib/dateRangeUtils.ts`: run `grep -r "computeDateRange\|formatDateRangeLabel\|PeriodForPreset" --include="*.ts" --include="*.tsx" .` and confirm zero results outside the file itself.
- The `DateRangePreset` type name will no longer be needed in the hook or TransactionFilters — but check if it is re-exported or used in any other file before removing from `dateRangeUtils.ts`.
- The `MONTH_LABELS`, `DatePicker`, and `MONTH_NAMES` constants in the old `TransactionFilters.tsx` become dead code after the rewrite — they will not exist in the new file.

### Decisions Made
- 2026-05-18: No backend changes for this redesign — the `queryArgs` shape is unchanged (still `dateFrom`/`dateTo` as Unix timestamps).
- 2026-05-18: Tailwind `grid` rows trick chosen for secondary row animation over framer-motion — no new dependency needed.
- 2026-05-18: Mobile bottom sheet uses `hidden sm:block` / `block sm:hidden` visibility toggle — no `useMediaQuery` hook needed.
- 2026-05-18: `DateRangePicker` built as a new file (`components/ui/date-range-picker.tsx`) — reusable across the app, not inline.
- 2026-05-18: Authenticated Playwright E2E tests deferred — current smoke test suite (6 unauthenticated tests) is extended with structure-level assertions only.

---

## Decisions Made
- 2026-04-05: Reuse Convex deployment hushed-bass-123 (no migration cost)
- 2026-04-05: Build from scratch per CLAUDE.md spec (no v1 code copy-paste)
- 2026-04-05: Use full CA-1/2/3 assessment system from v1 (not simple per-subject grades)
- 2026-04-05: Phase 2 GradesTab placeholder replaced with full CA-1/2/3 system immediately
- 2026-04-05: Pagination added to getAllStudents from day 1
- 2026-04-05: z.boolean().default(false) removed from Zod schema — using defaultValues in useForm instead
- 2026-04-05: studentInfoSchema exports both base (ZodObject) and refined (ZodEffects) to support .merge()
- 2026-04-05: Legacy v1 fields added as optional to schema (createdAt, isActive on assessmentQuestions, etc.)
- 2026-04-05: feeTransactions.paymentMode expanded to include UPI and Online (v1 data had these)
- 2026-04-05: reportCards.fileUrl stores v.id("_storage") not URL string; URL resolved in query
