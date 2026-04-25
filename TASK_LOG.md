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

## Current Build Status
- `npm run build`: PASSING (11 routes)
- `npx convex dev --once`: PASSING
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
