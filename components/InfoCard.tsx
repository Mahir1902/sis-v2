import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InfoRow {
  label: string;
  value: React.ReactNode;
}

interface InfoCardProps {
  title: string;
  info?: InfoRow[];
  children?: React.ReactNode;
  className?: string;
  borderColor?: string;
}

export function InfoCard({
  title,
  info,
  children,
  className,
  borderColor,
}: InfoCardProps) {
  return (
    <Card
      className={cn(
        "h-full",
        borderColor && `border-l-4 ${borderColor}`,
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {info?.map((row) => (
          <div key={row.label} className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-xs font-semibold text-gray-500 sm:w-40 shrink-0">
              {row.label}
            </span>
            <span className="text-sm text-gray-900">{row.value ?? "—"}</span>
          </div>
        ))}
        {children}
      </CardContent>
    </Card>
  );
}
