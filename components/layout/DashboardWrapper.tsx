"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

const AUTH_GRACE_PERIOD_MS = 10_000;

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isCollapsed } = useSidebar();
  const me = useQuery(api.users.getMe);

  // Cache the last valid user so we don't flash a loading spinner when `me`
  // briefly returns null during a JWT refresh (subscription re-evaluation).
  const lastMeRef = useRef(me);
  if (me) {
    lastMeRef.current = me;
  }

  // Track whether the user was ever authenticated in this session.
  // On initial load (never authenticated), redirect immediately.
  // On auth loss after being authenticated, apply a grace period to let the
  // error boundary's retry logic handle it first (~7s). This 10s timeout is
  // a safety net for cases where auth fails silently without subscription errors.
  const wasAuthenticatedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (isAuthenticated) {
    wasAuthenticatedRef.current = true;
  }

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Never was authenticated — redirect immediately (initial load)
      if (!wasAuthenticatedRef.current) {
        router.replace("/login");
        return;
      }

      // Was authenticated before — give the token refresh time to recover.
      // The error boundary handles the primary retry logic; this is a fallback.
      if (!redirectTimerRef.current) {
        redirectTimerRef.current = setTimeout(() => {
          router.replace("/login");
        }, AUTH_GRACE_PERIOD_MS);
      }
    }

    // Auth recovered — cancel the safety-net timer
    if (isAuthenticated && redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, [isLoading, isAuthenticated, router]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Use the cached user during transient auth gaps to avoid loading flash.
  // Show the spinner only on initial load (no cached user yet).
  const displayUser = me ?? lastMeRef.current;

  if (isLoading || !displayUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-school-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      <Sidebar role={displayUser.role} email={displayUser.email} />
      <main
        className={cn(
          "transition-all duration-300 h-full flex flex-col overflow-hidden",
          isCollapsed ? "pl-16" : "pl-[300px]",
        )}
      >
        <div className="flex-1 min-h-0 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
