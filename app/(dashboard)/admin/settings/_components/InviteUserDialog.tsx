"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Copy, Mail, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  type InviteUserValues,
  inviteUserSchema,
} from "@/lib/validations/inviteSchema";

// The two server guards from createInvite (#57). Anything else is unexpected.
type GuardCode = "ACCOUNT_EXISTS" | "PENDING_INVITE_EXISTS";
type Guard = { code: GuardCode; email: string };
type Reveal = { name: string; role: "admin" | "teacher"; link: string };

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
}: InviteUserDialogProps) {
  const createInvite = useMutation(api.invites.createInvite);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  const form = useForm<InviteUserValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { name: "", email: "", role: "teacher" },
  });

  function resetAll() {
    form.reset();
    setGuard(null);
    setReveal(null);
  }

  // Reset on every close so a reopened dialog is never stale.
  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  async function onSubmit(values: InviteUserValues) {
    setGuard(null);
    try {
      const invite = await createInvite(values);
      if (!invite?.token) {
        toast.error("Invite created but no link was returned. Try again.");
        return;
      }
      setReveal({
        name: values.name,
        role: values.role,
        link: `${window.location.origin}/invite/${invite.token}`,
      });
      toast.success(`Invite created for ${values.name}`);
    } catch (err) {
      const code =
        err instanceof ConvexError
          ? (err.data as { code?: string })?.code
          : undefined;
      // Guard rejections are non-blocking alerts (input preserved), not a crash.
      if (code === "ACCOUNT_EXISTS" || code === "PENDING_INVITE_EXISTS") {
        setGuard({ code, email: values.email.trim() });
        return;
      }
      toast.error("Couldn't create the invite. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {reveal ? (
          <InviteReveal
            reveal={reveal}
            onInviteAnother={resetAll}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite a user</DialogTitle>
              <DialogDescription>
                They&apos;ll get a one-time link to set their own password. No
                email is sent — you deliver the link.
              </DialogDescription>
            </DialogHeader>

            {guard && (
              <GuardAlert
                guard={guard}
                onAction={() => handleOpenChange(false)}
              />
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Fatima Sesay"
                          aria-label="Invitee full name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@school.edu"
                          aria-label="Invitee email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger
                            className="w-full"
                            aria-label="Invitee role"
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-school-green hover:bg-school-green/90 text-white"
                    disabled={form.formState.isSubmitting}
                  >
                    <Send className="h-4 w-4" />
                    {form.formState.isSubmitting
                      ? "Creating..."
                      : "Create invite"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The two server-detected guard cases, surfaced as a non-blocking alert above
 * the (still-filled) form. Action closes the dialog so the admin can act from
 * the settings page — the Users list (reactivate) is right there.
 * ponytail: deep-link into the Pending Invites tab lands with #53; closing here
 * is the honest action until that tab exists.
 */
function GuardAlert({
  guard,
  onAction,
}: {
  guard: Guard;
  onAction: () => void;
}) {
  if (guard.code === "ACCOUNT_EXISTS") {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">
            An account already exists for {guard.email}
          </p>
          <p className="text-amber-800">
            Active or deactivated — inviting again would create a duplicate.{" "}
            <button
              type="button"
              onClick={onAction}
              className="underline font-medium"
            >
              Reactivate them from the Users list →
            </button>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
      <Mail className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">
          A pending invite already exists for {guard.email}
        </p>
        <p className="text-blue-800">
          <button
            type="button"
            onClick={onAction}
            className="underline font-medium"
          >
            Manage it in Pending Invites →
          </button>{" "}
          to copy the link again, regenerate, or revoke it.
        </p>
      </div>
    </div>
  );
}

/** Copy-link-only reveal — no WhatsApp, no email (the school delivers it). */
function InviteReveal({
  reveal,
  onInviteAnother,
  onDone,
}: {
  reveal: Reveal;
  onInviteAnother: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reveal.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite ready</DialogTitle>
        <DialogDescription>
          Send this link to {reveal.name} ({reveal.role}). It&apos;s single-use
          and expires in 7 days.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 text-green-700">
        <Check className="h-4 w-4" />
        <span className="text-sm font-medium">Invite created</span>
      </div>

      <div className="flex gap-2">
        <Input
          readOnly
          value={reveal.link}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          aria-label="Copy invite link"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        No email is sent — deliver this link yourself (WhatsApp, SMS, in
        person).
      </p>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onInviteAnother}>
          Invite another
        </Button>
        <Button
          type="button"
          onClick={onDone}
          className="bg-school-green hover:bg-school-green/90 text-white"
        >
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
