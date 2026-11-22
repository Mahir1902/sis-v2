"use client";

import { TriangleAlert } from "lucide-react";
import { useId, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  type AccessAccount,
  useUserAccessForm,
} from "@/hooks/use-user-access-form";
import {
  GRANTABLE_CAPABILITIES,
  GRANTABLE_FEATURES,
  ROLES,
  type Role,
} from "@/lib/accessPolicy";
import { StudentPicker } from "./StudentPicker";

const ROLE_SUMMARY: Record<Role, string> = {
  admin: "Admins can do everything, including fees and user accounts.",
  teacher: "Teachers see students, grades, report cards and attendance.",
  student: "A student account sees only its own profile, fees and grades.",
};

interface ManageAccessSheetProps {
  /** The account being edited; `null` closes the sheet. */
  account: AccessAccount | null;
  onClose: () => void;
}

/** Settings → Users: one account's role, linked student and extra features. */
export function ManageAccessSheet({
  account,
  onClose,
}: ManageAccessSheetProps) {
  // Keep the last account on screen while the sheet slides shut.
  const last = useRef(account);
  if (account) last.current = account;
  const shown = account ?? last.current;

  return (
    <Sheet open={account !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        {shown && (
          // Keyed so each account opens on its own values.
          <AccessForm key={shown._id} account={shown} onSaved={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AccessForm({
  account,
  onSaved,
}: {
  account: AccessAccount;
  onSaved: () => void;
}) {
  const {
    form,
    role,
    isSelf,
    droppedGrantCount,
    hasChanges,
    isSaving,
    changedElsewhere,
    reload,
    onSubmit,
  } = useUserAccessForm(account, onSaved);
  const extrasHeadingId = useId();

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetHeader>
          <SheetTitle>Access for {account.name}</SheetTitle>
          <SheetDescription className="break-all">
            {account.email}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {!account.isActive && (
            <p className="rounded-md border bg-gray-50 p-3 text-xs text-gray-600">
              This account is deactivated, so nothing here applies until it is
              reactivated. A teacher&apos;s extra features are kept and come
              back with the account.
            </p>
          )}

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSelf || isSaving}
                >
                  <FormControl>
                    <SelectTrigger className="w-40 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLES.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className="capitalize"
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  {isSelf
                    ? "You cannot change your own role."
                    : ROLE_SUMMARY[role]}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {role === "student" && (
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked student</FormLabel>
                  <ErrorBoundary
                    fallback={
                      <p role="alert" className="text-sm text-red-600">
                        Couldn&apos;t load the student list. Close this sheet
                        and try again.
                      </p>
                    }
                  >
                    <StudentPicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </ErrorBoundary>
                  <FormDescription className="text-xs">
                    The one student record this account can open.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {role === "teacher" && (
            <FormField
              control={form.control}
              name="grants"
              render={({ field }) => (
                <FormItem>
                  <div>
                    <p id={extrasHeadingId} className="text-sm font-medium">
                      Extra features
                    </p>
                    <p className="text-xs text-gray-500">
                      On top of the teacher role. Each one appears in their
                      sidebar.
                    </p>
                  </div>
                  {/* biome-ignore lint/a11y/useSemanticElements: a fieldset's legend cannot hold the two-line heading */}
                  <div
                    role="group"
                    aria-labelledby={extrasHeadingId}
                    className="divide-y rounded-md border"
                  >
                    {GRANTABLE_CAPABILITIES.map((capability) => {
                      const feature = GRANTABLE_FEATURES[capability];
                      return (
                        <div
                          key={capability}
                          className="flex items-start gap-3 p-3"
                        >
                          <div className="flex-1">
                            <Label
                              htmlFor={`grant-${capability}`}
                              className="text-sm font-medium"
                            >
                              {feature.label}
                            </Label>
                            <p
                              id={`grant-${capability}-about`}
                              className="text-xs text-gray-500"
                            >
                              {feature.description}
                            </p>
                          </div>
                          <Switch
                            id={`grant-${capability}`}
                            aria-describedby={`grant-${capability}-about`}
                            checked={field.value.includes(capability)}
                            onCheckedChange={(on) =>
                              field.onChange(
                                on
                                  ? [...field.value, capability]
                                  : field.value.filter(
                                      (held) => held !== capability,
                                    ),
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {changedElsewhere && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
            >
              <p className="flex-1">
                Someone else changed this account while it was open here. Reload
                to see it as it is now.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reload}
              >
                Reload
              </Button>
            </div>
          )}

          {droppedGrantCount > 0 && (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Saving removes {account.name}&apos;s{" "}
                {droppedGrantCount === 1
                  ? "extra feature"
                  : `${droppedGrantCount} extra features`}
                . They do not come back if you make this account a teacher
                again.
              </p>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            type="submit"
            disabled={!hasChanges || isSaving || changedElsewhere}
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            {isSaving ? "Saving…" : "Save access"}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}
