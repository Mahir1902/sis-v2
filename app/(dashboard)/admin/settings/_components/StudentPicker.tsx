"use client";

import { useQuery } from "convex/react";
import { Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface StudentPickerProps {
  /** The picked student's id, "" when none. */
  value: string;
  onChange: (studentId: string) => void;
}

/**
 * Pick the student record a student account belongs to — search by name or
 * student number. Must be rendered inside a `FormField` (it carries the
 * field's `FormControl`).
 */
export function StudentPicker({ value, onChange }: StudentPickerProps) {
  // ponytail: the whole roster (~400) filtered in the browser by cmdk; give
  // this a server-side search if the school outgrows getAllStudents' cap.
  const students = useQuery(api.students.getAllStudents, {});
  const [open, setOpen] = useState(false);

  if (students === undefined) {
    return (
      <>
        <Skeleton className="h-9 w-full" />
        <span className="sr-only">Loading students…</span>
      </>
    );
  }
  if (students.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-gray-500">
        There are no student records yet.{" "}
        <Link
          href="/students"
          className="font-medium text-school-green underline"
        >
          Admit a student first
        </Link>
        .
      </p>
    );
  }

  const picked = students.find((student) => student._id === value);

  return (
    // `modal` so the list scrolls with the wheel inside the (modal) sheet.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !picked && "text-gray-500",
            )}
          >
            <span className="truncate">
              {picked
                ? `${picked.studentFullName} · ${picked.studentNumber}`
                : "Select student…"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search by name or number…" />
          <CommandList>
            <CommandEmpty>No student matches.</CommandEmpty>
            <CommandGroup>
              {students.map((student) => (
                <CommandItem
                  key={student._id}
                  value={`${student.studentFullName} ${student.studentNumber}`}
                  onSelect={() => {
                    onChange(student._id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      student._id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{student.studentFullName}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {[student.studentNumber, student.standardLevelName]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
