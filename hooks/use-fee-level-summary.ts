import { useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

interface FeeWithCount {
  _id: Id<"feeStructure">;
  isActive: boolean;
  baseAmount: number;
  frequency: "one-time" | "monthly" | "yearly";
  studentCount: number;
}

interface LevelInfo {
  _id: Id<"standardLevels">;
  name: string;
}

/**
 * Derives the level info and summary stats from fee structure data.
 * Extracts business logic from the fee detail page component.
 */
export function useFeeLevelSummary(
  fees: FeeWithCount[] | undefined,
  levels: LevelInfo[] | undefined,
  levelId: Id<"standardLevels">,
) {
  const level = useMemo(() => {
    if (!levels) return undefined;
    return levels.find((l) => l._id === levelId);
  }, [levels, levelId]);

  const summaryStats = useMemo(() => {
    if (!fees || fees.length === 0)
      return { activeFees: 0, totalAnnualCost: 0, students: 0 };

    const activeFees = fees.filter((f) => f.isActive);
    const totalAnnualCost = activeFees.reduce((sum, f) => {
      if (f.frequency === "monthly") return sum + f.baseAmount * 12;
      return sum + f.baseAmount;
    }, 0);
    const students = Math.max(0, ...fees.map((f) => f.studentCount));

    return { activeFees: activeFees.length, totalAnnualCost, students };
  }, [fees]);

  return { level, summaryStats };
}
