"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isCollapsed: boolean;
}

export function SidebarItem({
  href,
  label,
  icon: Icon,
  isCollapsed,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-r-md",
        "hover:bg-gray-100 hover:text-gray-900",
        isActive
          ? "border-l-2 border-school-green text-school-green bg-green-50"
          : "text-gray-600 border-l-2 border-transparent"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}
