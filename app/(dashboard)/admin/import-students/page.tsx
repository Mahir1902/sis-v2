"use client";

import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { RoleGate } from "@/components/shared/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countRows,
  type ImportPhase,
  type RowFilter,
  rowName,
  useFilteredRows,
  useStudentImport,
} from "@/hooks/use-student-import";
import { downloadIssuesCsv } from "@/lib/studentImportFile";
import type { PreviewField, PreviewRow } from "@/lib/studentImportMapping";

/**
 * The Excel student import surface (spec §7): one screen showing every parsed
 * row, with the field-level inspector as the product. Everything here happens
 * in the browser before a byte is written — this preview *is* the gate.
 *
 * Copy says "the student data file" / "the sheet", never "workbook".
 */

export default function ImportStudentsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <ImportSurface />
    </RoleGate>
  );
}

function ImportSurface() {
  const { phase, drop, reset } = useStudentImport();

  if (phase.kind === "preview") {
    return <Preview phase={phase} onReset={reset} />;
  }

  return (
    <div className="space-y-6">
      <Header />
      {phase.kind === "idle" && <DropZone onFile={drop} />}
      {phase.kind === "parsing" && (
        <div className="rounded-lg border bg-white p-8 sm:p-12">
          <ProgressBar fraction={phase.fraction} label={`${phase.label}…`} />
        </div>
      )}
      {phase.kind === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center sm:p-8">
          <AlertTriangle
            className="mx-auto mb-3 h-8 w-8 text-red-500"
            aria-hidden="true"
          />
          <p className="font-medium text-red-800">{phase.message}</p>
          <Button variant="outline" className="mt-4" onClick={reset}>
            Try another file
          </Button>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Import students</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload the school&apos;s student data file. Every sheet is read in one
        pass, and nothing is written until you have reviewed it.
      </p>
    </div>
  );
}

// ── Idle ──────────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  // No `accept` filter on purpose: a wrong file must be named and rejected
  // (§7.4), not silently ignored by the picker.
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: (files) => files[0] && onFile(files[0]),
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${
        isDragActive
          ? "border-school-green bg-school-green/5"
          : "border-gray-300 bg-white hover:border-gray-400"
      }`}
    >
      <input {...getInputProps()} aria-label="Choose the student data file" />
      <FileSpreadsheet
        className="mx-auto mb-3 h-8 w-8 text-gray-400"
        aria-hidden="true"
      />
      <p className="font-medium text-gray-900">
        Drop the student data file here
      </p>
      <p className="mt-1 text-sm text-gray-500">
        .xlsx · every sheet in the file is imported
      </p>
      <Button
        type="button"
        className="mt-4 bg-school-green hover:bg-school-green/90"
      >
        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
        Choose file
      </Button>
    </div>
  );
}

function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-school-green transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function Preview({
  phase,
  onReset,
}: {
  phase: Extract<ImportPhase, { kind: "preview" }>;
  onReset: () => void;
}) {
  const { preview, fileName } = phase;
  const [filter, setFilter] = useState<RowFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const counts = countRows(preview.rows);
  const rows = useFilteredRows(preview.rows, filter, search);
  const selected = rows.find((r) => rowKey(r) === selectedKey) ?? rows[0];
  const rejectedTabs = preview.tabs.filter((t) => t.rejected);

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-gray-900">{fileName}</h1>
        <span className="text-sm text-gray-500">
          {counts.all} rows · {preview.tabs.length - rejectedTabs.length} sheets
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadIssuesCsv(preview, fileName)}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Issues CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            Start over
          </Button>
        </div>
      </div>

      {preview.fileError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Nothing in this file can be imported — {preview.fileError}
        </p>
      )}

      {rejectedTabs.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {rejectedTabs.map((tab) => (
            <li key={tab.name}>
              <span className="font-medium">{tab.name}</span>: {tab.rejected}
            </li>
          ))}
        </ul>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <RowList
          rows={rows}
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          search={search}
          onSearch={setSearch}
          selectedKey={selected ? rowKey(selected) : null}
          onSelect={setSelectedKey}
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-4 sm:p-5">
          {selected ? (
            <Inspector row={selected} />
          ) : (
            <p className="text-sm text-gray-500">
              No row is selected. Clear the search or pick another filter.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-white px-4 py-3">
        <span className="text-sm text-gray-600">
          <strong className="font-medium text-gray-900">
            {counts.insert} new
          </strong>{" "}
          ·{" "}
          <strong className="font-medium text-gray-900">
            {counts.update} updates
          </strong>{" "}
          ·{" "}
          <strong className="font-medium text-gray-900">
            {counts.reject} rejected
          </strong>
        </span>
      </div>
    </div>
  );
}

/** Sheet + Excel row is the only identity a parsed row has of its own. */
const rowKey = (row: PreviewRow) => `${row.sheet}:${row.excelRow}`;

const FILTER_LABELS: Record<RowFilter, string> = {
  all: "All",
  insert: "New",
  update: "Updates",
  warned: "Warned",
  reject: "Rejected",
};

function RowList({
  rows,
  counts,
  filter,
  onFilter,
  search,
  onSearch,
  selectedKey,
  onSelect,
}: {
  rows: readonly PreviewRow[];
  counts: Record<RowFilter, number>;
  filter: RowFilter;
  onFilter: (filter: RowFilter) => void;
  search: string;
  onSearch: (search: string) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex max-h-[60vh] w-full flex-col rounded-lg border bg-white lg:max-h-none lg:max-w-sm">
      <div className="space-y-2 border-b p-3">
        <Input
          placeholder="Search name or ID"
          aria-label="Search rows by student name or ID"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8"
        />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(FILTER_LABELS) as RowFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => onFilter(key)}
              className={`rounded px-2 py-0.5 text-xs ${
                filter === key
                  ? "bg-school-green text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {FILTER_LABELS[key]} {counts[key]}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {rows.map((row) => {
          const key = rowKey(row);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={selectedKey === key}
                className={`w-full px-3 py-2 text-left ${
                  selectedKey === key
                    ? "bg-school-green/10"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">
                    {rowName(row) || "(no name)"}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${OUTCOME_DOT[row.outcome]}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex justify-between gap-2 text-xs text-gray-500">
                  <span className="font-mono">{row.studentNumber || "—"}</span>
                  <span className="shrink-0">
                    {row.sheet} · row {row.excelRow}
                    {row.warnings.length > 0 && (
                      <span className="ml-1 text-yellow-700">
                        ⚑{row.warnings.length}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-500">
            No rows match this search or filter.
          </li>
        )}
      </ul>
    </div>
  );
}

const OUTCOME_DOT: Record<PreviewRow["outcome"], string> = {
  insert: "bg-school-green",
  update: "bg-school-yellow",
  reject: "bg-red-500",
};

const OUTCOME_BADGE: Record<PreviewRow["outcome"], [string, string]> = {
  insert: ["bg-green-400/40 text-green-700", "New"],
  update: ["bg-yellow-400/40 text-yellow-700", "Update"],
  reject: ["bg-red-400/40 text-red-700", "Rejected"],
};

/**
 * The inspector — three columns per field: the SIS field, the sheet header it
 * came from, and the value. The header column is what makes a wrong mapping
 * findable without opening the file side by side.
 */
function Inspector({ row }: { row: PreviewRow }) {
  const [badgeClass, badgeLabel] = OUTCOME_BADGE[row.outcome];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {rowName(row) || "(no name)"}
          </h2>
          <p className="text-sm text-gray-500">
            {row.sheet} · Excel row {row.excelRow} ·{" "}
            {row.studentNumber || "no ID"}
          </p>
        </div>
        <Badge className={`${badgeClass} border-0 font-medium`}>
          {badgeLabel}
        </Badge>
      </div>

      {row.errors.length > 0 && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-800">
            This row will not be written
          </p>
          <ul className="mt-1 space-y-0.5 text-red-700">
            {row.errors.map((error) => (
              <li key={`${error.column}:${error.reason}`}>
                {error.column} — “{error.value}” — {error.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          {row.warnings.map((warning) => (
            <li key={warning.text}>⚑ {warning.text}</li>
          ))}
        </ul>
      )}

      <Table className="mt-5 text-sm">
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Sheet header</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {row.fields.map((field) => (
            <TableRow
              key={field.key}
              className={
                field.previous !== undefined ? "bg-school-yellow/5" : ""
              }
            >
              <TableCell className="w-32 py-1.5 pr-2 align-top whitespace-normal text-gray-500 sm:w-52">
                {fieldLabel(field.key)}
                {/* Narrow screens have no room for a third column, but the
                    header is the point of the inspector — so it stacks under
                    the field name rather than being dropped. */}
                <span className="block text-xs text-gray-400 sm:hidden">
                  {field.header}
                </span>
              </TableCell>
              <TableCell className="hidden w-40 py-1.5 pr-2 align-top whitespace-normal text-xs text-gray-400 sm:table-cell">
                {field.header}
              </TableCell>
              <TableCell className="py-1.5 whitespace-normal">
                <FieldValue field={field} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** `fatherPhoneNumber` → `Father phone number`. */
function fieldLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function FieldValue({ field }: { field: PreviewField }) {
  const changed = field.previous !== undefined;
  // §7.2: the marker lands on the no-source fields *and* on any blank mapped
  // cell — both import unset, and the header column beside it says which is
  // which. Nothing is hidden; a column of grey rows is the honest picture of
  // how thin an imported record is.
  const unset = field.value === null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {changed && (
        <>
          <s className="text-gray-400">{field.previous || "—"}</s>
          <span className="text-gray-400" aria-hidden="true">
            →
          </span>
        </>
      )}
      <span
        className={
          field.value
            ? changed
              ? "font-medium text-school-green"
              : "text-gray-900"
            : "text-gray-400"
        }
      >
        {field.value || "—"}
      </span>
      {unset ? (
        <span className="text-[10px] uppercase tracking-wide text-gray-400">
          not in sheet
        </span>
      ) : (
        field.source === "derived" && (
          <span
            className="rounded bg-school-yellow/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-school-yellow"
            title="Computed by the importer, not typed by the school"
          >
            derived
          </span>
        )
      )}
    </span>
  );
}
