"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  ArrowUpCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { SidebarItem } from "./SidebarItem";

type Role = "admin" | "teacher" | "student";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // if omitted, visible to all roles
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: Role[]; // if omitted, group visible to all roles
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Student Management",
    items: [
      { href: "/students", label: "Students", icon: Users },
      {
        href: "/student-fees",
        label: "Student Fees",
        icon: DollarSign,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Administration",
    roles: ["admin"],
    items: [
      { href: "/fees", label: "Fee Structures", icon: BookOpen },
      { href: "/admin/assessments", label: "Assessments", icon: GraduationCap },
      { href: "/admin/promotions", label: "Promotions", icon: ArrowUpCircle },
      { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
      { href: "/admin/audit-log", label: "Audit Log", icon: ClipboardList },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  role?: Role;
  email?: string;
}

export function Sidebar({ role, email }: SidebarProps) {
  const { isCollapsed, onToggle } = useSidebar();
  const { signOut } = useAuthActions();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const visibleGroups = navGroups
    .filter((g) => !g.roles || !role || g.roles.includes(role))
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => !item.roles || !role || item.roles.includes(role),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col z-40 transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-16" : "w-[300px] max-w-[300px]",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-gray-200 shrink-0",
            isCollapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          {!isCollapsed && (
            <span className="font-bold text-school-green text-lg truncate">
              SIS v2
            </span>
          )}
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "p-1 rounded hover:bg-gray-100 text-gray-500",
              !isCollapsed && "ml-auto",
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto py-4 space-y-4",
            isCollapsed && "px-2",
          )}
        >
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="px-4 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign-out footer */}
        <div
          className={cn(
            "shrink-0 border-t border-gray-200 flex items-center",
            isCollapsed ? "justify-center p-2" : "p-3 gap-2",
          )}
        >
          {!isCollapsed && (
            <span
              className="flex-1 truncate text-xs text-gray-500"
              title={email}
            >
              {email ?? ""}
            </span>
          )}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-colors shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
