import { Award, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type OverallSuppressedReason,
  overallPositionCopy,
  type Rank,
} from "@/lib/academicHistoryView";

type OverallPositionHeadlineProps = {
  overall: Rank | null;
  reason: OverallSuppressedReason;
  loading?: boolean;
};

/**
 * Headline card for the Academic History tab (C.4).
 * Renders the student's overall class position via `overallPositionCopy` — a
 * ranked result is accented with an Award icon and the brand `school-green`
 * token; a suppressed result is muted with an optional Info icon. Purely
 * presentational: no data fetching, no copy logic of its own.
 */
export function OverallPositionHeadline({
  overall,
  reason,
  loading = false,
}: OverallPositionHeadlineProps) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          {/* <output> carries an implicit ARIA "status" role. */}
          <output
            aria-label="Loading class position"
            aria-busy="true"
            className="flex items-center gap-3"
          >
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-6 w-56" />
          </output>
        </CardContent>
      </Card>
    );
  }

  const { headline, detail } = overallPositionCopy(overall, reason);
  const ranked = overall !== null;

  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        {ranked ? (
          <Award
            data-testid="award-icon"
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-school-green"
          />
        ) : (
          <Info
            data-testid="info-icon"
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-muted-foreground"
          />
        )}
        <div className="min-w-0">
          <h2
            aria-label="Overall class position"
            className={`text-xl font-semibold sm:text-2xl ${
              ranked ? "text-school-green" : "text-muted-foreground"
            }`}
          >
            {headline}
          </h2>
          {detail !== null ? (
            <p
              data-testid="position-detail"
              className="mt-1 text-sm text-muted-foreground"
            >
              {detail}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
