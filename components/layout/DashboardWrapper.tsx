"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isCollapsed } = useSidebar();
  const me = useQuery(api.users.getMe);

  // When auth is definitively lost (not just loading), redirect to login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Block children until the Convex WebSocket is fully authenticated:
  //  - isLoading = true  → auth state not yet determined
  //  - me === undefined  → getMe subscription hasn't resolved yet
  //  - me === null       → WebSocket responded but without auth (JWT not sent yet)
  //                        This happens briefly because isAuthenticated becomes true
  //                        before the WebSocket actually delivers the JWT to the server.
  //
  // Only when me is a real user object do we know the server has verified the token.
  if (isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-school-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={me?.role} email={me?.email} />
      <main
        className={cn(
          "transition-all duration-300 min-h-screen",
          isCollapsed ? "pl-16" : "pl-[300px]",
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
