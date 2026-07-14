"use client";

import { useQuery } from "convex/react";
import { ShieldAlert, UserX } from "lucide-react";
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

  // Deactivated account: every server query/mutation rejects these users
  // (requireRole checks isActive), so deny at the gate too. Otherwise a
  // still-"admin"-by-role but deactivated user renders admin content whose
  // queries then throw Unauthorized — e.g. the settings page's ErrorBoundary
  // showing "Something went wrong". Give an honest message instead.
  if (me && !me.isActive) {
    return (
      <GateMessage
        icon={<UserX className="h-10 w-10 text-red-400 mb-3" />}
        title="Account Deactivated"
        message="Your account has been deactivated. Contact an administrator."
      />
    );
  }

  if (!me || !allowedRoles.includes(me.role as Role)) {
    return (
      <GateMessage
        icon={<ShieldAlert className="h-10 w-10 text-red-400 mb-3" />}
        title="Access Denied"
        message="You do not have permission to view this page."
      />
    );
  }

  return <>{children}</>;
}

function GateMessage({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon}
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{message}</p>
    </div>
  );
}
