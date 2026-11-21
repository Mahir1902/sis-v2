"use client";

import { useQuery } from "convex/react";
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
  const me = useQuery(api.users.getMe);

  // `getMe` is briefly null while the auth token refreshes; keep the last
  // known account so gated UI does not flash "denied" (as DashboardWrapper).
  const lastMe = useRef(me);
  if (me) lastMe.current = me;
  const account = me ?? lastMe.current;

  // A deactivated account is refused by every Convex function: no capabilities.
  const caller = account?.isActive ? account : undefined;

  return {
    /** The account, `null` when signed out. */
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
