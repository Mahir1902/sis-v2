# Audit Log Design Spec

## Context

The SIS v2 app handles sensitive student and financial data. The school admin needs visibility into who performed what actions and when — for accountability and dispute resolution. Every mutation already calls `requireRole()` which returns the acting user, so we have the actor identity available at every write site.

## Scope

- **In scope:** Read-only audit trail logging every mutation, admin-only audit log page with filtering
- **Out of scope:** Undo/recovery, per-entity activity sections, compliance export, external log drains

## Data Model

One new table in `convex/schema.ts`:

```ts
auditLogs: defineTable({
  userId: v.id("users"),
  userEmail: v.string(),
  userName: v.string(),
  action: v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("delete"),
    v.literal("status_change"),
    v.literal("collect_payment"),
    v.literal("apply_discount"),
    v.literal("upload"),
    v.literal("promote"),
    v.literal("role_change"),
  ),
  entityType: v.string(),
  entityId: v.string(),
  description: v.string(),
  metadata: v.optional(v.any()),
  timestamp: v.float64(),
})
  .index("by_timestamp", ["timestamp"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_user", ["userId"])
```

### Design decisions

- **Denormalized user name/email** — avoids joins on every log view; preserves identity even if user is later deactivated.
- **`description` is human-readable** — admin page displays it directly without formatting logic.
- **`metadata` is optional `v.any()`** — flexible bag for context (e.g., `{ oldStatus: "active", newStatus: "expelled" }`, `{ amount: 5000, paymentMode: "cash" }`). Not queried, only displayed.
- **3 indexes** — cover browsing by time (main page), by entity (future per-entity view), and by user (filter by actor).

## Backend

### New file: `convex/auditLogs.ts`

**Internal helper (not a mutation — called inside existing mutations):**

```ts
export async function logAudit(
  ctx: MutationCtx,
  params: {
    user: { _id: Id<"users">; email: string; name: string };
    action: "create" | "update" | "delete" | "status_change" | "collect_payment" | "apply_discount" | "upload" | "promote" | "role_change";
    entityType: string;
    entityId: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
)
```

Inserts one row into `auditLogs` with `timestamp: Date.now()`.

**Two queries:**

1. `getRecentLogs({ limit?: number })` — admin-only, returns logs ordered by `by_timestamp` descending, `.take(limit || 100)`. No cursor pagination in v1 — simple `.take()` with a reasonable limit.
2. `getLogsByEntity({ entityType, entityId })` — admin-only, returns logs for a specific entity using `by_entity` index. Reserved for future per-entity activity sections.

### Mutations to instrument (~25 mutations)

| Domain | Mutations | Action type |
|--------|-----------|-------------|
| Students | `createStudent` | `create` |
| Students | `updateStudent` | `update` |
| Students | `deleteStudent` | `delete` |
| Students | `updateStudentStatus` | `status_change` |
| Enrollments | `createEnrollment` | `create` |
| Enrollments | `updateEnrollmentExit` | `update` |
| Fee Structures | `createFee` | `create` |
| Student Fees | `createStudentFee` | `create` |
| Student Fees | `updateStudentFee` | `update` |
| Fee Transactions | `createTransaction` | `collect_payment` |
| Discount Rules | `create` | `create` |
| Discount Rules | `toggleActive` | `update` |
| Student Discounts | `applyDiscount` | `apply_discount` |
| Assessments | `createAssessment` | `create` |
| Assessments | `bulkCreateAssessments` | `create` |
| Assessments | `updateAssessment` | `update` |
| Assessments | `deleteAssessment` | `delete` |
| Questions | `createQuestion` | `create` |
| Questions | `bulkCreateQuestions` | `create` |
| Questions | `updateQuestion` | `update` |
| Questions | `deleteQuestion` | `delete` |
| Grades | `bulkMarkEntry` | `update` |
| Grades | `computeGradesForStudent` | `create` |
| Report Cards | `uploadReportCard` | `upload` |
| Report Cards | `deleteReportCard` | `delete` |
| Users | `updateUserRole` | `role_change` |
| Users | `deactivateUser` | `status_change` |
| Users | `reactivateUser` | `status_change` |
| Promotions | `bulkPromote` | `promote` |
| Academic Years | `create` | `create` |

### Integration pattern

Every mutation already calls `requireRole()` which returns the user object. After the main operation, call `logAudit()`:

```ts
const user = await requireRole(ctx, ["admin"]);
// ... main mutation logic ...
await logAudit(ctx, {
  user,
  action: "delete",
  entityType: "students",
  entityId: args.studentId,
  description: `Deleted student ${student.firstName} ${student.lastName}`,
});
```

For bulk operations (e.g., `bulkPromote`), log one entry per affected entity within the loop.

## Frontend

### New page: `app/(dashboard)/admin/audit-log/page.tsx`

- **RoleGate:** admin-only
- **DataTable** with columns: Timestamp (formatted with date-fns), User (name), Action (badge), Entity Type, Description
- **Filters:** Action type dropdown, Entity type dropdown
- **Pagination:** `.take(100)` with "Load more" or page-based (matching existing DataTable patterns)
- **Loading skeleton** during query fetch
- **Empty state** when no logs exist

### Sidebar entry

Add "Audit Log" to the Administration group in `components/layout/Sidebar.tsx`, admin-only, with `ClipboardList` icon from lucide-react.

## Verification

1. `npm run build` passes
2. `npm run lint` passes
3. Create a student → audit log shows "Created student X" entry
4. Delete a student → audit log shows "Deleted student X" entry
5. Collect a fee → audit log shows the payment entry
6. Non-admin users cannot access `/admin/audit-log`
7. Audit log page handles loading, empty state, and filtering
