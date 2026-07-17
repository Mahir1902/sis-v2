"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Copy, Inbox, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatInviteCountdown, isExpiringSoon } from "@/lib/inviteStatus";

type InviteRow = FunctionReturnType<typeof api.invites.listInvites>[number];

/**
 * Pending-invites management tab (spec #55 / ticket #60). Renders outstanding
 * invites — `listInvites` already excludes accepted ones (they're real users in
 * the Users tab). Row status/actions branch on the server-derived `displayStatus`
 * so this list can never disagree with the acceptance page about "expired".
 * The parent (settings page) owns the query + its loading/error boundary; this
 * component only renders and mutates. `invites === undefined` → loading.
 */
export function PendingInvitesTable({
  invites,
}: {
  invites: InviteRow[] | undefined;
}) {
  const regenerate = useMutation(api.invites.regenerateInvite);
  const revoke = useMutation(api.invites.revokeInvite);
  // Disable a row's actions while its mutation is in flight (no double-submit).
  const [busyId, setBusyId] = useState<Id<"invites"> | null>(null);
  const [copiedId, setCopiedId] = useState<Id<"invites"> | null>(null);

  async function handleCopy(invite: InviteRow) {
    // Rebuild the link client-side from the persisted token — no new mutation.
    const link = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Couldn't copy — check clipboard permissions.");
    }
  }

  async function handleRegenerate(invite: InviteRow) {
    setBusyId(invite._id);
    try {
      await regenerate({ id: invite._id });
      toast.success(
        `Fresh link created for ${invite.name} — the old one is dead`,
      );
    } catch (err) {
      toast.error(inviteErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(invite: InviteRow) {
    // ponytail: no confirm dialog — revoke is recoverable (re-invite issues a new
    // link) and the action is explicit. Add a confirm if accidental clicks bite.
    setBusyId(invite._id);
    try {
      await revoke({ id: invite._id });
      toast.success(`Invite for ${invite.name} revoked`);
    } catch (err) {
      toast.error(inviteErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (invites === undefined) return <InvitesLoading />;
  if (invites.length === 0) return <InvitesEmpty />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Invitee</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => {
            const revoked = invite.displayStatus === "revoked";
            return (
              <TableRow
                key={invite._id}
                className={revoked ? "opacity-60" : ""}
              >
                <TableCell>
                  <p className="font-medium text-sm text-gray-900">
                    {invite.name}
                  </p>
                  <p className="text-xs text-gray-500">{invite.email}</p>
                </TableCell>
                <TableCell className="text-sm text-gray-700 capitalize">
                  {invite.role}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {invite.invitedByName}
                </TableCell>
                <TableCell>
                  <StatusBadge invite={invite} />
                </TableCell>
                <TableCell className="text-right">
                  <InviteActions
                    invite={invite}
                    busy={busyId === invite._id}
                    copied={copiedId === invite._id}
                    onCopy={() => handleCopy(invite)}
                    onRegenerate={() => handleRegenerate(invite)}
                    onRevoke={() => handleRevoke(invite)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Guard-coded ConvexErrors carry a stable `code`; anything else is generic. */
function inviteErrorMessage(err: unknown): string {
  const code =
    err instanceof ConvexError
      ? (err.data as { code?: string })?.code
      : undefined;
  if (code === "INVITE_NOT_REGENERATABLE" || code === "INVITE_NOT_REVOCABLE") {
    return "This invite already changed — refresh and try again.";
  }
  return "Something went wrong. Please try again.";
}

function StatusBadge({ invite }: { invite: InviteRow }) {
  if (invite.displayStatus === "revoked") {
    return (
      <Badge className="bg-gray-100 text-gray-500 border-gray-200">
        Revoked
      </Badge>
    );
  }
  if (invite.displayStatus === "expired") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>
    );
  }
  // valid — green, or amber under 48h left
  const soon = isExpiringSoon(invite.expiresAt, Date.now());
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        className={
          soon
            ? "bg-amber-100 text-amber-700 border-amber-200 w-fit"
            : "bg-green-100 text-green-700 border-green-200 w-fit"
        }
      >
        Pending
      </Badge>
      <span className={`text-xs ${soon ? "text-amber-600" : "text-gray-400"}`}>
        expires {formatInviteCountdown(invite.expiresAt, Date.now())}
      </span>
    </div>
  );
}

function InviteActions({
  invite,
  busy,
  copied,
  onCopy,
  onRegenerate,
  onRevoke,
}: {
  invite: InviteRow;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
}) {
  if (invite.displayStatus === "revoked") {
    return <span className="text-xs text-gray-400 italic">No actions</span>;
  }

  // Copy is hidden when expired — the link is dead; regenerate first.
  const canCopy = invite.displayStatus === "valid";
  return (
    <div className="flex items-center justify-end gap-1.5">
      {canCopy && (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy}
          aria-label={`Copy invite link for ${invite.name}`}
          onClick={onCopy}
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          {copied ? "Copied" : "Copy link"}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={busy}
        aria-label={`Regenerate invite for ${invite.name}`}
        onClick={onRegenerate}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1" />
        Regenerate
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
        disabled={busy}
        aria-label={`Revoke invite for ${invite.name}`}
        onClick={onRevoke}
      >
        <XCircle className="h-3.5 w-3.5 mr-1" />
        Revoke
      </Button>
    </div>
  );
}

function InvitesLoading() {
  return (
    <div className="divide-y">
      {Array.from({ length: 3 }, (_, i) => `sk-${i}`).map((key) => (
        <div key={key} className="flex items-center gap-4 p-4">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </div>
  );
}

function InvitesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Inbox className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No pending invites</p>
      <p className="text-sm text-gray-400 mt-1 max-w-sm">
        Invited staff appear here until they accept. Use “Invite user” to create
        one.
      </p>
    </div>
  );
}
