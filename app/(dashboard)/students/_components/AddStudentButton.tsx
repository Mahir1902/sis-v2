"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddStudentForm } from "./AddStudentForm";

export function AddStudentButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-school-green hover:bg-school-green/90 text-white gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Student
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-t-4 border-school-green">
          <DialogHeader>
            <DialogTitle className="text-xl">Student Admission Form</DialogTitle>
          </DialogHeader>
          <AddStudentForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
