"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRef } from "react";
import { api } from "@/convex/_generated/api";
import {
  type Capability,
  can,
  canOnStudent,
  type StudentCapability,
} from "@/lib/accessPolicy";

/**
 * The signed-in account's capabilities, from the Access Policy table — the
 * client's one way to ask "may I show this?" or "may I call this query?".
 *
 * A role-dependent `useQuery` should pass `"skip"` unless the capability is
 * granted, so a page never subscribes to a function the server will refuse:
 *
 *   const { canOnStudent } = useCapabilities();
 *   const fees = useQuery(
 *     api.studentFees.getByStudent,
 *     canOnStudent("viewStudentFees", studentId) ? { studentId } : "skip",
 *   );
 *
 * UI guard only — every Convex function enforces the same table itself.
 */
export function useCapabilities() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe);

  // `getMe` is briefly null while the auth token refreshes; keep the last
  // known account so gated UI does not flash "denied" (as DashboardWrapper).
  const lastMe = useRef(me);
  if (me) lastMe.current = me;

  // No session → no account, so every gated query skips instead of reaching
  // the server with no identity. Until an account is known we are loading,
  // never "denied": DashboardWrapper owns the redirect to /login.
  const account = isAuthenticated
    ? (me ?? lastMe.current ?? undefined)
    : undefined;

  // A deactivated account is refused by every Convex function: no capabilities.
  const caller = account?.isActive ? account : undefined;

  return {
    /** The signed-in account, `null` while it is not known. */
    me: account ?? null,
    /** True until the account is known — render nothing role-dependent yet. */
    isLoading: account === undefined,
    /** May this role ever use the capability? (nav, page gates, actions) */
    can: (capability: Capability) => can(caller, capability),
    /** May this account use the capability on this particular student? */
    canOnStudent: (capability: StudentCapability, studentId: string) =>
      canOnStudent(caller, capability, studentId),
  };
}
