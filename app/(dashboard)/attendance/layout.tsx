"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleGate } from "@/components/shared/RoleGate";
import { cn } from "@/lib/utils";

/** The three rooms behind the one "Attendance" sidebar door (spec §5.2). */
const tabs = [
  { href: "/attendance", label: "Register" },
  { href: "/attendance/today", label: "Today's call list" },
  { href: "/attendance/report", label: "Term report" },
];

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <RoleGate allowedRoles={["admin", "teacher"]}>
      <div className="space-y-4">
        <nav
          aria-label="Attendance sections"
          className="flex gap-1 overflow-x-auto border-b border-gray-200"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-school-green text-school-green"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </RoleGate>
  );
}
