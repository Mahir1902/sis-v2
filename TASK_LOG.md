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
