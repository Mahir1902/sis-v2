"use client";

/**
 * Public invite-acceptance page (spec #55 / ticket #58). An admin-issued link
 * `/invite/<token>` lands here; the invitee sets a password and is signed in.
 *
 * The token is resolved by the ONE public query `getInviteByToken`, which returns
 * a non-leaky state (identity only on `valid`). Five screens: `valid` → the split
 * welcome + password form (Variant B); the four dead states → a centred message
 * with no CTA except `used` (→ sign in). Submit runs the invite-only `signUp`
 * gate — email/role/name come from the token server-side, the form supplies only
 * the password. Route reachability is opened in `proxy.ts` (`/invite/(.*)`).
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Ban,
  Check,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  LogIn,
  ShieldQuestion,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

/** The valid-token welcome + password form (Variant B: split panel → one card on mobile). */
function AcceptForm({
  name,
  email,
  role,
  token,
}: {
  name: string;
  email: string;
  role: Doc<"invites">["role"];
  token: string;
}) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [show, setShow] = useState(false);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: PasswordValues) {
    try {
      // email/role/name are taken from the token server-side; email is echoed
      // only to bind the credential id (the gate rejects a mismatch).
      await signIn("password", {
        email,
        password: values.password,
        inviteToken: token,
        flow: "signUp",
      });
      toast.success("Account created — welcome!");
      router.push("/students");
    } catch {
      toast.error(
        "We couldn't set up your account. Your invite link may no longer be valid.",
      );
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="w-full max-w-3xl grid md:grid-cols-2 rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="bg-school-green text-white p-8 flex flex-col justify-center gap-3">
        <GraduationCap className="h-8 w-8" />
        <h1 className="text-2xl font-bold leading-tight">
          Welcome,
          <br />
          {name.split(" ")[0]}
        </h1>
        <p className="text-white/80 text-sm">
          You&apos;ve been invited as a{" "}
          <span className="font-semibold">{roleLabel(role)}</span>. Set a
          password to finish setting up your account.
        </p>
        <div className="mt-2 rounded-lg bg-white/10 p-3 text-sm">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> {email}
          </div>
          <p className="text-white/60 text-xs mt-0.5">
            This is your login — set by your admin.
          </p>
        </div>
      </div>
      <div className="p-8 flex flex-col justify-center">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Create password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={show ? "text" : "password"}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {show ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type={show ? "text" : "password"}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-school-green hover:bg-school-green/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
                </>
              ) : (
                <>
                  Create account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

/** Terminal, non-leaky screens — nothing here reveals identity or why a token died. */
function DeadTokenScreen({
  state,
}: {
  state: "expired" | "used" | "revoked" | "invalid";
}) {
  const router = useRouter();
  const cfg = {
    expired: {
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      tint: "bg-amber-100",
      title: "This invite has expired",
      body: "Invite links are valid for 7 days. Ask your administrator to send you a new one.",
      cta: null,
    },
    used: {
      icon: <Check className="h-6 w-6 text-gray-600" />,
      tint: "bg-gray-100",
      title: "This invite has already been used",
      body: "An account has already been set up with this link. Sign in with your email and password.",
      cta: (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          <LogIn className="h-4 w-4" /> Go to sign in
        </Button>
      ),
    },
    revoked: {
      icon: <Ban className="h-6 w-6 text-gray-600" />,
      tint: "bg-gray-100",
      title: "This invite is no longer active",
      body: "This invite link can no longer be used. Contact your administrator if you still need access.",
      cta: null,
    },
    invalid: {
      icon: <ShieldQuestion className="h-6 w-6 text-gray-600" />,
      tint: "bg-gray-100",
      title: "This invite link isn't valid",
      body: "Check that you copied the full link, or contact your administrator for a new invite.",
      cta: null,
    },
  }[state];

  return (
    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
      <div className="text-center space-y-4 py-4">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${cfg.tint}`}
        >
          {cfg.icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{cfg.title}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            {cfg.body}
          </p>
        </div>
        {cfg.cta}
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm space-y-4">
      <Skeleton className="h-12 w-12 rounded-full mx-auto" />
      <Skeleton className="h-6 w-40 mx-auto" />
      <Skeleton className="h-4 w-56 mx-auto" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const invite = useQuery(api.invites.getInviteByToken, { token });

  if (invite === undefined) return <LoadingCard />;
  if (invite.state === "valid") {
    return (
      <AcceptForm
        name={invite.name}
        email={invite.email}
        role={invite.role}
        token={token}
      />
    );
  }
  return <DeadTokenScreen state={invite.state} />;
}
