"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { DollarSign, Search } from "lucide-react";
import { RoleGate } from "@/components/shared/RoleGate";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const statusStyles: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
};

export default function StudentFeesPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <StudentFeesPageContent />
    </RoleGate>
  );
}

function StudentFeesPageContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedYearId, setSelectedYearId] = useState<string>("all");
  const [selectedLevelId, setSelectedLevelId] = useState<string>("all");

  const years = useQuery(api.academicYears.list);
  const levels = useQuery(api.standardLevels.list);
  // Get all students with fee summary
  const studentsResult = useQuery(api.students.getAllStudents, { paginationOpts: { numItems: 200, cursor: null } });

  if (!studentsResult || years === undefined || levels === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full max-w-sm" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const students = studentsResult.page;

  // Filter students
  const filtered = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.studentFullName.toLowerCase().includes(search.toLowerCase()) ||
      s.studentNumber.toLowerCase().includes(search.toLowerCase());
    const matchesYear = selectedYearId === "all" || s.academicYear === selectedYearId;
    const matchesLevel = selectedLevelId === "all" || s.standardLevel === selectedLevelId;
    return matchesSearch && matchesYear && matchesLevel;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Student Fees</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedYearId} onValueChange={setSelectedYearId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years?.map((y) => (
              <SelectItem key={y._id} value={y._id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels?.map((l) => (
              <SelectItem key={l._id} value={l._id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border text-center">
          <DollarSign className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No students found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Student</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Total Fees</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <StudentFeeRow
                  key={student._id}
                  student={student}
                  onClick={() => router.push(`/students/${student._id}?tab=fees`)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Student Fee Row ───────────────────────────────────────────────────────────

function StudentFeeRow({
  student,
  onClick,
}: {
  student: {
    _id: Id<"students">;
    studentFullName: string;
    studentNumber: string;
    studentPhotoUrl?: string | null;
    standardLevelDoc?: { name: string } | null;
    academicYearDoc?: { name: string } | null;
  };
  onClick: () => void;
}) {
  const fees = useQuery(api.studentFees.getByStudent, { studentId: student._id });

  const totalFees = fees?.reduce((s, f) => s + f.originalAmount, 0) ?? 0;
  const totalPaid = fees?.reduce((s, f) => s + f.paidAmount, 0) ?? 0;
  const totalBalance = fees?.reduce((s, f) => s + f.balance, 0) ?? 0;

  const overallStatus =
    fees === undefined
      ? "loading"
      : totalBalance <= 0
      ? "paid"
      : totalPaid > 0
      ? "partial"
      : "unpaid";

  return (
    <TableRow
      onClick={onClick}
      className="cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={typeof student.studentPhotoUrl === "string" ? student.studentPhotoUrl : undefined}
              alt={student.studentFullName}
            />
            <AvatarFallback className="text-xs bg-school-green/10 text-school-green">
              {getInitials(student.studentFullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-gray-900">{student.studentFullName}</p>
            <p className="text-xs text-gray-500">{student.studentNumber}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {student.standardLevelDoc?.name ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {student.academicYearDoc?.name ?? "—"}
      </TableCell>
      <TableCell className="text-right text-sm">
        {fees === undefined ? "—" : `৳${totalFees.toLocaleString()}`}
      </TableCell>
      <TableCell className="text-right text-sm text-green-700">
        {fees === undefined ? "—" : `৳${totalPaid.toLocaleString()}`}
      </TableCell>
      <TableCell className={`text-right text-sm font-medium ${totalBalance > 0 ? "text-red-600" : "text-gray-900"}`}>
        {fees === undefined ? "—" : `৳${totalBalance.toLocaleString()}`}
      </TableCell>
      <TableCell>
        {overallStatus !== "loading" && (
          <Badge variant="outline" className={statusStyles[overallStatus]}>
            {overallStatus}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
