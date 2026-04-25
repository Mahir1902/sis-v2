"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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
  const hasRetriedRef = useRef(false);

  // Convex wraps thrown errors: "[CONVEX Q(...)] Server Error\nUncaught Error: Unauthorized..."
  // "Unauthenticated" = not logged in → sign out + redirect to login
  // "Unauthorized"    = logged in but wrong role/missing account → show access denied, do NOT sign out
  const isUnauthenticated = error.message.includes("Unauthenticated");
  const isUnauthorized =
    !isUnauthenticated && error.message.includes("Unauthorized");

  useEffect(() => {
    if (!isUnauthenticated) return;

    // Auth state is still loading — wait before acting
    if (isLoading) return;

    // If confirmed authenticated AND this is the first Unauthenticated error,
    // it's likely a transient race condition where the Convex client had a stale
    // cached error before re-subscribing with the new token. Reset once to retry.
    if (isAuthenticated && !hasRetriedRef.current) {
      hasRetriedRef.current = true;
      reset();
      return;
    }

    // Confirmed unauthenticated (or retry also failed) — sign out and redirect.
    let cancelled = false;

    async function handleUnauthenticated() {
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
