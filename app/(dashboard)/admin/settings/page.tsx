"use client";

import { useMutation, useQuery } from "convex/react";
import { Shield, UserCheck, UserPlus, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AccessAccount } from "@/hooks/use-user-access-form";
import { isGrantable } from "@/lib/accessPolicy";
import { InviteUserDialog } from "./_components/InviteUserDialog";
import { ManageAccessSheet } from "./_components/ManageAccessSheet";
import { PendingInvitesTable } from "./_components/PendingInvitesTable";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <RoleGate capability="manageUsers">
      {/* Boundary catches a listUsers/listInvites throw → "Try again" (spec #60). */}
      <ErrorBoundary>
        <AdminSettingsPageContent />
      </ErrorBoundary>
    </RoleGate>
  );
}

function AdminSettingsPageContent() {
  const users = useQuery(api.users.listUsers);
  const invites = useQuery(api.invites.listInvites);
  const deactivate = useMutation(api.users.deactivateUser);
  const reactivate = useMutation(api.users.reactivateUser);

  const [deactivateId, setDeactivateId] = useState<Id<"users"> | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // The account whose "Manage access" sheet is open — looked up in the live
  // list, so the sheet always works from the account as it is now.
  const [accessId, setAccessId] = useState<Id<"users"> | null>(null);
  const accessAccount = users?.find((u) => u._id === accessId) ?? null;

  // Outstanding = still awaiting the invitee; revoked/accepted don't count
  // (accepted is already excluded server-side). undefined while loading.
  const outstandingCount = invites?.filter(
    (i) => i.displayStatus !== "revoked",
  ).length;

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
        <Tabs defaultValue="users">
          {/* Segmented toggle: Users ↔ Pending Invites (spec #60) */}
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="invites" className="gap-1.5">
                Pending Invites
                {outstandingCount !== undefined && outstandingCount > 0 && (
                  <span className="rounded-full bg-school-green/10 px-1.5 text-xs text-school-green">
                    {outstandingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={() => setInviteOpen(true)}
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              <UserPlus className="h-4 w-4" />
              Invite user
            </Button>
          </div>

          <TabsContent value="users" className="mt-0">
            {users === undefined ? (
              <div className="divide-y">
                {Array.from({ length: 4 }, (_, i) => `sk-${i}`).map((key) => (
                  <div key={key} className="flex items-center gap-4 p-4">
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-8 w-28" />
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
                      <TableHead>Access</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user._id}
                        className={
                          user._id === accessAccount?._id
                            ? "bg-green-50/50"
                            : undefined
                        }
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AccessSummary user={user} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              aria-label={`Manage access for ${user.name}`}
                              onClick={() => setAccessId(user._id)}
                            >
                              Manage access
                            </Button>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="invites" className="mt-0">
            <PendingInvitesTable invites={invites} />
          </TabsContent>
        </Tabs>
      </div>

      <ManageAccessSheet
        account={accessAccount}
        onClose={() => setAccessId(null)}
      />

      {/* Invite user dialog */}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

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

/** The Access cell: the role, and what else the account's access rests on. */
function AccessSummary({ user }: { user: AccessAccount }) {
  // Only grantable names count — a stale stored one gives the teacher nothing.
  const extras = user.grants.filter(isGrantable).length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="capitalize">
        {user.role}
      </Badge>
      {user.role === "teacher" && extras > 0 && (
        <span className="text-xs text-gray-600">+ {extras} extra</span>
      )}
      {user.role === "student" &&
        (user.linkedStudent ? (
          <span className="text-xs text-gray-600">
            {user.linkedStudent.studentFullName} ·{" "}
            {user.linkedStudent.studentNumber}
          </span>
        ) : (
          <span className="text-xs text-amber-700">Needs a student</span>
        ))}
      {!user.isActive && (
        <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>
      )}
    </div>
  );
}
