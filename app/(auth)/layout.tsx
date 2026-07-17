"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

// The public auth pages (login + the invite acceptance page) need a Convex
// React client in the tree: the invite page calls `useQuery`/`useAuthActions`,
// and `useQuery` throws without a `ConvexProvider`. The dashboard group has its
// own provider; this mirrors it for the unauthenticated group.
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string,
);

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {children}
      </div>
    </ConvexAuthNextjsProvider>
  );
}
