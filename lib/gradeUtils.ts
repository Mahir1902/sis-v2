/**
 * Returns Tailwind CSS classes for a letter grade badge.
 */
export function getLetterGradeBadgeColor(grade: string): string {
  switch (grade) {
    case "A+":
    case "A":
      return "bg-green-100 text-green-700 border-green-300";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "C":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "D":
      return "bg-orange-100 text-orange-700 border-orange-300";
    default:
      return "bg-red-100 text-red-700 border-red-300";
  }
}

/**
 * Returns icon, color class, and label for a performance trend.
 */
export function getTrendIndicator(trend: string) {
  switch (trend) {
    case "improving":
      return { icon: "↗", color: "text-green-600", label: "Improving" };
    case "declining":
      return { icon: "↘", color: "text-orange-600", label: "Declining" };
    case "stable":
      return { icon: "→", color: "text-blue-600", label: "Stable" };
    default:
      return { icon: "—", color: "text-gray-400", label: "Insufficient Data" };
  }
}

/**
 * Format a percentage number to 1 decimal place with % sign.
 */
export function formatPercentage(num: number | null | undefined): string {
  if (num == null) return "N/A";
  return `${num.toFixed(1)}%`;
}

/**
 * Calculate letter grade from percentage (server-side formula replica for previews).
 */
export function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}
