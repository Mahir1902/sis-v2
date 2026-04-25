"use client";

import { useQuery } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";

type Role = "admin" | "teacher" | "student";

interface RoleGateProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

/**
 * Client-side role gate. Renders children only if the current user
 * has one of the allowed roles. Shows "Access Denied" otherwise.
 *
 * Note: this is a UI guard only. Server-side mutations/queries
 * enforce permissions via requireRole() independently.
 */
export function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const me = useQuery(api.users.getMe);

  // Still loading — DashboardWrapper already shows a spinner,
  // so return null to avoid a flash of "Access Denied"
  if (me === undefined) return null;

  if (!me || !allowedRoles.includes(me.role as Role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-1">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
