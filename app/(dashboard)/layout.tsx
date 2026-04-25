"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { DashboardWrapper } from "@/components/layout/DashboardWrapper";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string,
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <DashboardWrapper>{children}</DashboardWrapper>
    </ConvexAuthNextjsProvider>
  );
}
