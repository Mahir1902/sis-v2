"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convex wraps thrown errors: "[CONVEX Q(...)] Server Error\nUncaught Error: Unauthorized..."
  // "Unauthenticated" = not logged in → retry with backoff, then sign out as last resort
  // "Unauthorized"    = logged in but wrong role/missing account → show access denied, do NOT sign out
  const isUnauthenticated = error.message.includes("Unauthenticated");
  const isUnauthorized =
    !isUnauthenticated && error.message.includes("Unauthorized");

  useEffect(() => {
    if (!isUnauthenticated) return;

    // Auth state is still loading — token refresh is in progress, wait
    if (isLoading) return;

    // If authenticated and we haven't exhausted retries, schedule a retry
    // with exponential backoff. The token refresh needs ~2.5s so we give it
    // up to 7s total (1s + 2s + 4s) across 3 retries.
    if (isAuthenticated && retryCountRef.current < MAX_RETRIES) {
      const delay =
        BACKOFF_MS[retryCountRef.current] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      retryCountRef.current += 1;
      setIsRetrying(true);

      timerRef.current = setTimeout(() => {
        setIsRetrying(false);
        reset();
      }, delay);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // All retries exhausted or confirmed unauthenticated — sign out and
    // redirect. We must call signOut() to clear the 30-day session cookie;
    // without it, proxy.ts would redirect /login back to /dashboard in a loop.
    let cancelled = false;

    async function handleUnauthenticated() {
      setIsRetrying(false);
      setIsSigningOut(true);
      try {
        await signOut();
      } finally {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    }

    handleUnauthenticated();

    return () => {
      cancelled = true;
    };
  }, [isUnauthenticated, isAuthenticated, isLoading, signOut, router, reset]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (isRetrying) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-school-green border-t-transparent" />
          <output className="text-muted-foreground text-sm">
            Re-establishing connection...
          </output>
        </div>
      </div>
    );
  }

  if (isUnauthenticated || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <output className="text-muted-foreground text-sm">
          Signing you out...
        </output>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h2 className="text-xl font-semibold text-gray-900">Access denied</h2>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          Your account does not have permission to view this page. Contact an
          administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-semibold text-school-green">
          Something went wrong
        </h2>
        <p className="text-muted-foreground text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button onClick={reset} aria-label="Try again to reload the page">
          Try again
        </Button>
      </div>
    </div>
  );
}
