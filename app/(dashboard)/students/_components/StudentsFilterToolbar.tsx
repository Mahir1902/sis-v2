"use client";

import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { DataTableFacetedFilter } from "@/components/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export interface StudentsFilters {
  standardLevel: Set<string>;
  status: Set<string>;
  gender: Set<string>;
  academicYear: Set<string>;
}

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Graduated", value: "graduated" },
  { label: "Transferred", value: "transferred" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Suspended", value: "suspended" },
  { label: "Expelled", value: "expelled" },
];

const GENDER_OPTIONS = [
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
];

interface StudentsFilterToolbarProps {
  filters: StudentsFilters;
  onFiltersChange: (filters: StudentsFilters) => void;
}

export function StudentsFilterToolbar({
  filters,
  onFiltersChange,
}: StudentsFilterToolbarProps) {
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);

  const levelOptions =
    levels?.map((l) => ({ label: l.name, value: l._id })) ?? [];
  const yearOptions =
    years?.map((y) => ({ label: y.name, value: y._id })) ?? [];

  const hasActiveFilters =
    filters.standardLevel.size > 0 ||
    filters.status.size > 0 ||
    filters.gender.size > 0 ||
    filters.academicYear.size > 0;

  const resetFilters = () =>
    onFiltersChange({
      standardLevel: new Set(),
      status: new Set(),
      gender: new Set(),
      academicYear: new Set(),
    });

  return (
    <>
      <DataTableFacetedFilter
        title="Standard Level"
        options={levelOptions}
        selected={filters.standardLevel}
        onSelectionChange={(selected) =>
          onFiltersChange({ ...filters, standardLevel: selected })
        }
        disabled={!levels}
      />
      <DataTableFacetedFilter
        title="Status"
        options={STATUS_OPTIONS}
        selected={filters.status}
        onSelectionChange={(selected) =>
          onFiltersChange({ ...filters, status: selected })
        }
      />
      <DataTableFacetedFilter
        title="Gender"
        options={GENDER_OPTIONS}
        selected={filters.gender}
        onSelectionChange={(selected) =>
          onFiltersChange({ ...filters, gender: selected })
        }
      />
      <DataTableFacetedFilter
        title="Academic Year"
        options={yearOptions}
        selected={filters.academicYear}
        onSelectionChange={(selected) =>
          onFiltersChange({ ...filters, academicYear: selected })
        }
        disabled={!years}
      />
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 lg:px-3"
          onClick={resetFilters}
        >
          Reset
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </>
  );
}
