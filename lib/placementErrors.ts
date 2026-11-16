import { ConvexError } from "convex/values";

/** Copy for the Placement module's ConvexError codes (convex/lib/placement.ts). */
const MESSAGES: Record<string, string> = {
  STUDENT_HAS_LEFT:
    "This student has left the school. Re-admit them to place them in a class.",
  ALREADY_PLACED: "This student is already in a class.",
  NOT_PLACED: "This student is not in a class. Re-admit them first.",
};

/** A friendly toast message for a placement mutation failure. */
export function placementErrorMessage(err: unknown, fallback: string): string {
  const code =
    err instanceof ConvexError
      ? (err.data as { code?: string } | undefined)?.code
      : undefined;
  return (code && MESSAGES[code]) || fallback;
}

/**
 * A toast message for a server error: a ConvexError's own string (the
 * placement checks on saveRegister and mark entry, the year-overlap guard),
 * else the error's message, else the fallback.
 */
export function serverErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    return typeof err.data === "string" ? err.data : fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
