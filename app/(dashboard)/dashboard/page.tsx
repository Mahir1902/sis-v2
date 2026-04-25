"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowRight,
  BookOpen,
  DollarSign,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { RoleGate } from "@/components/shared/RoleGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <DashboardContent />
    </RoleGate>
  );
}

function DashboardContent() {
  const me = useQuery(api.users.getMe);
  const stats = useQuery(api.dashboard.getSummaryStats);

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {me?.name ?? "Admin"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(new Date(), "EEEE, dd MMMM yyyy")}
        </p>
      </div>

      {/* Stats Cards */}
      {stats === undefined ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon={Users}
            accent="bg-school-green/10 text-school-green"
          />
          <StatCard
            label="Active Students"
            value={stats.activeStudents}
            icon={UserCheck}
            accent="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            label="Outstanding Fees"
            value={`৳${stats.totalOutstanding.toLocaleString()}`}
            subtitle={
              stats.overdueCount > 0
                ? `${stats.overdueCount} overdue`
                : "All on time"
            }
            icon={DollarSign}
            accent={
              stats.totalOutstanding > 0
                ? "bg-red-100 text-red-600"
                : "bg-green-100 text-green-700"
            }
          />
          <StatCard
            label="Active Assessments"
            value={stats.assessmentCount}
            icon={BookOpen}
            accent="bg-blue-100 text-blue-700"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/students">
            <Button
              variant="outline"
              className="gap-2"
              aria-label="View all students"
            >
              <Users className="h-4 w-4" />
              View Students
              <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </Link>
          <Link href="/student-fees">
            <Button
              variant="outline"
              className="gap-2"
              aria-label="Manage student fees"
            >
              <DollarSign className="h-4 w-4" />
              Collect Fees
              <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </Link>
          <Link href="/admin/assessments">
            <Button
              variant="outline"
              className="gap-2"
              aria-label="View assessments"
            >
              <BookOpen className="h-4 w-4" />
              Assessments
              <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
