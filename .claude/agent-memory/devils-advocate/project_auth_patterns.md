---
name: Auth Patterns and Logout Vulnerability
description: Known auth edge cases and vulnerability patterns in SIS v2's Convex + Next.js 16 auth setup
type: project
---

**Removing signOut() before redirect to /login creates an infinite loop.**
proxy.ts has a 30-day session cookie. If a redirect to /login happens without calling signOut() first, proxy.ts detects the valid cookie and redirects back to /dashboard. The app then errors again and loops. signOut() is mandatory before any redirect to /login from an authenticated state.

**Why:** proxy.ts (at project root) uses convexAuthNextjsMiddleware. The session cookie is separate from the JWT. JWT can expire and refresh; session cookie persists 30 days. These are independent mechanisms.

**How to apply:** Any plan that proposes replacing signOut() with a plain redirect must be rejected as a hard blocker. The fix for premature signOut() is retry logic BEFORE the signOut() call, not removal of signOut().

---

**Two independent auth-recovery mechanisms (error.tsx + DashboardWrapper) must not run simultaneously.**
error.tsx uses hasRetriedRef for retry counting. DashboardWrapper uses a grace period timer before redirecting. Both respond to the same auth failure event with no coordination. If DashboardWrapper fires its redirect during the error boundary's backoff period, the retry is discarded mid-flight, creating flaky behavior.

**How to apply:** Flag any plan that adds retry logic to both components. One component must own the retry decision.

---

**isAuthenticated ? queryArgs : "skip" guard protects against error boundary triggers during JWT refresh.**
When the JWT expires on the Convex server, queries using requireRole() throw "Unauthenticated" immediately. Client-side, isAuthenticated becomes false after ~2.5s. The skip guard suppresses the subscription before the error fires, buying protection. Removing this guard increases error boundary trigger frequency. This pattern should be applied consistently across ALL pages with requireRole() queries, not just students.

**How to apply:** Treat the isAuthenticated skip as a defensive pattern that should be extended to other pages, not removed.

---

**Cached me in DashboardWrapper creates role-staleness if using useRef with no TTL.**
An admin can change a user's role via updateUserRole mutation. The getMe subscription reactively updates, but a useRef cache in DashboardWrapper will hold the stale role for the entire session. The sidebar (which reads from DashboardWrapper's me) will show stale navigation. RoleGate calls useQuery(api.users.getMe) independently and will update correctly, creating an inconsistency between sidebar and page content.

---

**isLoading from useConvexAuth stays false during normal token refresh.**
Per @convex-dev/auth internals: isLoading only becomes true during the initial auth determination, not during token refresh. Any guard that waits for isLoading=true will not fire during a mid-session JWT refresh. This is the scenario that causes the "transient Unauthenticated" errors.

---

**The student detail page (`/students/[studentId]`) has NO route-level role gate — but its tabs call admin/teacher-only queries.**
As of 2026-07 there is no middleware/proxy role check keeping a `student` role off the student detail page. Yet the Grades and Academic History tabs call Convex queries that hard-gate on `requireRole(["admin","teacher"])`. Confirmed admin/teacher-only in `convex/computedGrades.ts`: getGradesByEnrollmentSemester, getLongitudinalSubjectPerformance, and ALL Phase B analytics (getClassAverages, getPerCaClassBaseline, getClassPositions, getGradeSpread). A student reaching this page makes those queries throw "Unauthorized".

**Why:** the permission matrix in CLAUDE.md promises students can "view own grades", but the queries backing the detail-page tabs don't allow the student role at all. The UI has no client-side role gate around these sections either.

**How to apply:** For any Phase C+ work on student-facing grade/analytics views, flag this as a design gap — either gate the section client-side to admin/teacher, or Backend must relax specific queries to let a student read their OWN row. Do not assume students can view the Academic History or Grades tabs.

---

**CLAUDE.md "KEY FILES" references `getTrendIndicator` in lib/gradeUtils.ts — it does NOT exist there.**
gradeUtils.ts exports only getLetterGradeBadgeColor, formatPercentage, calculateLetterGrade. The Improving/Declining trend logic (getTrend/TrendIcon) lives LOCALLY inside AcademicHistoryTab.tsx, not in gradeUtils, and has no external consumers. Deleting it (ADR-0005 Phase C.5) is safe cross-file, but breaks the local SubjectStats "Overall Trend" cell if not removed together.

**How to apply:** Don't trust the CLAUDE.md KEY FILES table as authoritative for gradeUtils exports — grep the file. When asked whether trend logic is safe to delete, the answer is yes (isolated to the one component).
