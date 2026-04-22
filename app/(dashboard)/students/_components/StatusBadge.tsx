"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | "active"
  | "graduated"
  | "transferred"
  | "withdrawn"
  | "suspended"
  | "expelled";

const statusStyles: Record<Status, string> = {
  active: "bg-green-400/40 text-green-700",
  graduated: "bg-purple-400/40 text-purple-700",
  transferred: "bg-yellow-400/40 text-yellow-700",
  withdrawn: "bg-gray-400/40 text-gray-700",
  suspended: "bg-orange-400/40 text-orange-700",
  expelled: "bg-red-400/40 text-red-700",
};

const allStatuses: Status[] = [
  "active",
  "graduated",
  "transferred",
  "withdrawn",
  "suspended",
  "expelled",
];

interface StatusBadgeProps {
  studentId: Id<"students">;
  status: Status;
  readonly?: boolean;
}

export function StatusBadge({ studentId, status, readonly = false }: StatusBadgeProps) {
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const updateStatus = useMutation(api.students.updateStudentStatus);

  async function handleConfirm() {
    if (!pendingStatus) return;
    try {
      await updateStatus({ studentId, status: pendingStatus });
      toast.success(`Status updated to ${pendingStatus}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setPendingStatus(null);
    }
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status}
      {!readonly && <ChevronDown className="h-3 w-3" />}
    </span>
  );

  if (readonly) return badge;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none">{badge}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allStatuses.map((s) => (
            <DropdownMenuItem
              key={s}
              disabled={s === status}
              onClick={() => {
                if (s === "expelled" || s === "suspended") {
                  setPendingStatus(s);
                } else {
                  updateStatus({ studentId, status: s })
                    .then(() => toast.success(`Status updated to ${s}`))
                    .catch(() => toast.error("Failed to update status"));
                }
              }}
              className="capitalize"
            >
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pendingStatus} onOpenChange={() => setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark student as {pendingStatus}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will change the student&apos;s status to{" "}
              <strong>{pendingStatus}</strong>. This action can be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
