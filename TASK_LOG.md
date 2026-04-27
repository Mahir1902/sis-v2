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

## Current Build Status
- `npm run build`: PASSING (15 routes + Proxy Middleware)
- `npm run lint`: PASSING (129 files, 0 errors)
- Playwright smoke tests: 6/6 PASSING

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
