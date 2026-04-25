"use client";

import { useMutation, useQuery } from "convex/react";
import { Shield, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/shared/RoleGate";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <AdminSettingsPageContent />
    </RoleGate>
  );
}

function AdminSettingsPageContent() {
  const users = useQuery(api.users.listUsers);
  const updateRole = useMutation(api.users.updateUserRole);
  const deactivate = useMutation(api.users.deactivateUser);
  const reactivate = useMutation(api.users.reactivateUser);

  const [deactivateId, setDeactivateId] = useState<Id<"users"> | null>(null);

  async function handleRoleChange(
    userId: Id<"users">,
    role: "admin" | "teacher" | "student",
  ) {
    try {
      await updateRole({ userId, role });
      toast.success("Role updated");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update role";
      toast.error(message);
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await deactivate({ userId: deactivateId });
      toast.success("User deactivated");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to deactivate user";
      toast.error(message);
    } finally {
      setDeactivateId(null);
    }
  }

  async function handleReactivate(userId: Id<"users">) {
    try {
      await reactivate({ userId });
      toast.success("User reactivated");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reactivate user";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-school-green" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
      </div>

      {/* User management */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage user roles and account status.
          </p>
        </div>

        {users === undefined ? (
          <div className="divide-y">
            {Array.from({ length: 4 }, (_, i) => `sk-${i}`).map((key) => (
              <div key={key} className="flex items-center gap-4 p-4">
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) =>
                          handleRoleChange(
                            user._id,
                            v as "admin" | "teacher" | "student",
                          )
                        }
                      >
                        <SelectTrigger
                          className="w-32 h-8 text-xs"
                          aria-label={`Change role for ${user.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Deactivate ${user.name}`}
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200 h-8"
                          onClick={() => setDeactivateId(user._id)}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Reactivate ${user.name}`}
                          className="text-green-600 hover:bg-green-50 border-green-200 h-8"
                          onClick={() => handleReactivate(user._id)}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Reactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Deactivate confirm dialog */}
      <AlertDialog
        open={!!deactivateId}
        onOpenChange={() => setDeactivateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent the user from logging in. You can reactivate
              them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
