"use client";

import { ShieldAlert, UserX } from "lucide-react";
import { useCapabilities } from "@/hooks/use-capabilities";
import type { Capability } from "@/lib/accessPolicy";

interface RoleGateProps {
  /** What the signed-in role must be able to do to see the children. */
  capability: Capability;
  children: React.ReactNode;
}

/**
 * Client-side page gate. Renders children only if the current user's role
 * holds the capability in the Access Policy table (`lib/accessPolicy.ts`).
 * Shows "Access Denied" otherwise.
 *
 * Note: this is a UI guard only. Server-side mutations/queries
 * enforce the same table via requireCapability() independently.
 */
export function RoleGate({ capability, children }: RoleGateProps) {
  const { me, isLoading, can } = useCapabilities();

  // Still loading — DashboardWrapper already shows a spinner,
  // so return null to avoid a flash of "Access Denied"
  if (isLoading) return null;

  // Deactivated account: every server query/mutation rejects these users
  // (requireCapability checks isActive), so deny at the gate too. Otherwise a
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

  if (!can(capability)) {
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
