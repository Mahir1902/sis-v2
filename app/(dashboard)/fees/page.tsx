"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/shared/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CreateFeeDialog } from "./_components/CreateFeeDialog";

export default function FeesPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <FeesPageContent />
    </RoleGate>
  );
}

function FeesPageContent() {
  const [createFor, setCreateFor] = useState<Id<"standardLevels"> | null>(null);

  const levels = useQuery(api.standardLevels.list);
  const allFees = useQuery(api.feeStructure.list);

  if (levels === undefined || allFees === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (levels.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Fee Structures</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <p className="text-gray-500 font-medium">No standard levels found</p>
          <p className="text-sm text-gray-400 mt-1">
            Add standard levels before managing fee structures.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Fee Structures</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {levels.map((level) => {
          const levelFees = allFees.filter(
            (f) => f.standardLevel === level._id,
          );
          const lastUpdated =
            levelFees.length > 0
              ? Math.max(...levelFees.map((f) => f._creationTime))
              : null;

          return (
            <Link
              key={level._id}
              href={`/fees/${level._id}`}
              className="block"
              aria-label={`View fee structure for ${level.name}`}
            >
              <div className="bg-white border rounded-lg p-4 space-y-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-gray-900">
                    {level.name}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-school-green/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-school-green">
                        {levelFees.length}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-500">
                    Total Fee Types: {levelFees.length}
                  </p>
                  {lastUpdated && (
                    <p className="text-xs text-gray-400">
                      Last updated:{" "}
                      {format(new Date(lastUpdated), "dd MMM yyyy")}
                    </p>
                  )}
                </div>
                {levelFees.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {levelFees.map((f) => (
                      <Badge
                        key={f._id}
                        variant="outline"
                        className="text-xs capitalize"
                      >
                        {f.feeType}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCreateFor(level._id);
                  }}
                  aria-label={`Add fee type for ${level.name}`}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Fee Type
                </Button>
              </div>
            </Link>
          );
        })}
      </div>

      {createFor && (
        <CreateFeeDialog
          open={true}
          onClose={() => setCreateFor(null)}
          standardLevelId={createFor}
        />
      )}
    </div>
  );
}
