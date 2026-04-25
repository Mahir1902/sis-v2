"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ReportCardsTabProps {
  studentId: Id<"students">;
}

export function ReportCardsTab({ studentId }: ReportCardsTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"reportCards"> | null>(null);

  const reportCards = useQuery(api.reportCards.getByStudent, { studentId });
  const enrollments = useQuery(api.enrollments.getEnrollmentHistory, {
    studentId,
  });
  const deleteCard = useMutation(api.reportCards.deleteReportCard);

  if (reportCards === undefined || enrollments === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    );
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteCard({ reportCardId: deleteId });
      toast.success("Report card deleted");
    } catch {
      toast.error("Failed to delete report card");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {reportCards.length} report card{reportCards.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          onClick={() => setUploadOpen(true)}
          className="bg-school-green hover:bg-school-green/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>

      {/* Grid of cards */}
      {reportCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No report cards yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload a PDF report card for this student.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {reportCards.map((card) => (
            <div
              key={card._id}
              className="border rounded-lg p-4 space-y-2 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-8 w-8 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {card.fileName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {card.yearName} &bull; {card.levelName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Semester {card.semester}
                </Badge>
                <span className="text-xs text-gray-400">
                  {format(new Date(card.uploadedAt), "dd MMM yyyy")}
                </span>
              </div>
              {card.notes && (
                <p className="text-xs text-gray-500 italic">{card.notes}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() =>
                    card.resolvedUrl && window.open(card.resolvedUrl, "_blank")
                  }
                  disabled={!card.resolvedUrl}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                  onClick={() => setDeleteId(card._id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <UploadReportCardDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        studentId={studentId}
        enrollments={enrollments ?? []}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the report card. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Upload Dialog ─────────────────────────────────────────────────────────────

interface Enrollment {
  _id: Id<"enrollments">;
  academicYearDoc?: { name: string } | null;
  standardLevelDoc?: { name: string } | null;
}

function UploadReportCardDialog({
  open,
  onClose,
  studentId,
  enrollments,
}: {
  open: boolean;
  onClose: () => void;
  studentId: Id<"students">;
  enrollments: Enrollment[];
}) {
  const [enrollmentId, setEnrollmentId] = useState<string>("");
  const [semester, setSemester] = useState<"1" | "2">("1");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const generateUrl = useMutation(api.reportCards.generateUploadUrl);
  const uploadCard = useMutation(api.reportCards.uploadReportCard);

  async function handleSubmit() {
    if (!enrollmentId || !file) {
      toast.error("Please select an enrollment and a PDF file");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be 5MB or smaller");
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();

      await uploadCard({
        studentId,
        enrollmentId: enrollmentId as Id<"enrollments">,
        semester: parseInt(semester, 10) as 1 | 2,
        storageId: storageId as Id<"_storage">,
        fileName: file.name,
        notes: notes || undefined,
      });

      toast.success("Report card uploaded successfully");
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(
        message.includes("already exists")
          ? message
          : "Failed to upload report card",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleClose() {
    setEnrollmentId("");
    setSemester("1");
    setNotes("");
    setFile(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Report Card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Enrollment</Label>
            <Select value={enrollmentId} onValueChange={setEnrollmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select enrollment" />
              </SelectTrigger>
              <SelectContent>
                {enrollments.map((e) => (
                  <SelectItem key={e._id} value={e._id}>
                    {e.academicYearDoc?.name} – {e.standardLevelDoc?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select
              value={semester}
              onValueChange={(v) => setSemester(v as "1" | "2")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Semester 1</SelectItem>
                <SelectItem value="2">Semester 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>PDF File</Label>
            {/* biome-ignore lint/a11y/useSemanticElements: div with role="button" used for dropzone styling */}
            <div
              role="button"
              aria-label="Click to upload PDF file"
              tabIndex={0}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                file
                  ? "border-school-green bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => document.getElementById("rc-file-input")?.click()}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                document.getElementById("rc-file-input")?.click()
              }
            >
              <input
                id="rc-file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
              {file ? (
                <p className="text-sm text-school-green font-medium">
                  {file.name}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Click to select PDF (max 5MB)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this report card…"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isUploading || !file || !enrollmentId}
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
