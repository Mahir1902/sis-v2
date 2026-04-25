"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center text-sm font-medium transition-colors",
        "hover:bg-gray-100 hover:text-gray-900",
        isCollapsed
          ? cn(
              "justify-center w-10 h-10 rounded-md mx-auto",
              isActive ? "bg-green-50 text-school-green" : "text-gray-600",
            )
          : cn(
              "gap-3 px-4 py-2.5 rounded-r-md",
              isActive
                ? "border-l-2 border-school-green text-school-green bg-green-50"
                : "text-gray-600 border-l-2 border-transparent",
            ),
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
