import {
  can,
  canOnStudent,
  type Role,
  type SchoolCapability,
  type StudentCapability,
  withoutSensitiveFields,
} from "../../lib/accessPolicy";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The server side of the Access Policy (`lib/accessPolicy.ts`): every Convex
 * function asks one of these, as the first thing in its handler, whether the
 * caller may proceed. Who may do what lives in the policy table — never in a
 * role list here or at a call site.
 *
 * All of them throw a plain `Error("Unauthenticated")` (no session) or
 * `Error("Unauthorized")` (signed in, not allowed); `app/(dashboard)/error.tsx`
 * tells the two apart by those words.
 */

type Ctx = MutationCtx | QueryCtx;

/**
 * The signed-in, active account behind this call.
 *
 * The Convex Auth JWT sub claim is "userId|sessionId". We extract the userId
 * (the _id from our users table, as returned by createOrUpdateUser) and do a
 * direct document lookup — no email needed from the JWT.
 */
async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const userId = identity.subject.split("|")[0] as Id<"users">;
  const user = await ctx.db.get(userId);
  if (!user?.isActive) throw new Error("Unauthorized");
  return user;
}

/**
 * Gate for anything that is not about one student record. Returns the caller.
 * (A student-scoped capability does not type-check here — use
 * `requireStudentAccess`, which needs the student.)
 */
export async function requireCapability(
  ctx: Ctx,
  capability: SchoolCapability,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!can(user.role, capability)) throw new Error("Unauthorized");
  return user;
}

/**
 * Gate for anything keyed by a student: staff reach every student, a student
 * account only the record it is linked to. Returns the caller.
 *
 * For a read keyed by something else (an enrollment, a fee), load that row
 * first and pass its `studentId`.
 */
export async function requireStudentAccess(
  ctx: Ctx,
  capability: StudentCapability,
  studentId: Id<"students">,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!canOnStudent(user, capability, studentId)) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * The student-scoped read: resolves the caller, refuses a student they may
 * not see, and returns the record already shaped for their role — identity
 * numbers and family income are present only for a `viewStudentSensitive`
 * holder. `student` is null when the record does not exist.
 */
export async function readStudent(
  ctx: Ctx,
  studentId: Id<"students">,
): Promise<{ caller: Doc<"users">; student: Doc<"students"> | null }> {
  const caller = await requireStudentAccess(ctx, "viewStudent", studentId);
  const student = await ctx.db.get(studentId);
  if (!student) return { caller, student: null };
  return {
    caller,
    student: canOnStudent(caller, "viewStudentSensitive", studentId)
      ? student
      : withoutSensitiveFields(student),
  };
}

/**
 * The one rule for `users.studentId`, used wherever an account gets its role
 * (invite redemption, an admin's role change): only a student account is
 * linked to a student record, and only to one that exists. Returns the value
 * to store — `undefined` clears the link. A student account with no link can
 * see nothing at all, so callers refuse to create one.
 *
 * Two accounts may link to the same student (there is no parent role yet).
 * ponytail: a link is not cleared when its student is deleted — own-only
 * reads of a missing record return nothing; add a `users.by_student` index
 * and unlink in `deleteStudent` if stale links ever need tidying.
 */
export async function studentLinkFor(
  db: MutationCtx["db"],
  role: Role,
  studentId: Id<"students"> | undefined,
): Promise<Id<"students"> | undefined> {
  if (role !== "student" || studentId === undefined) return undefined;
  return (await db.get(studentId)) ? studentId : undefined;
}
